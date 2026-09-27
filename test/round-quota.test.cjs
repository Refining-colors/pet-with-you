const test=require('node:test'),assert=require('node:assert/strict');
const {TaskState}=require('../state.cjs');
test('task summary has two lines and counts each completed round independently of display priority',()=>{
  let now=1000;const state=new TaskState(()=>now);
  const event=(id,name)=>state.accept({session_id:id,hook_event_name:name});
  event('a','PreToolUse');event('b','UserPromptSubmit');
  assert.equal(state.snapshot().task,'已知 2 个任务进行中\n执行工具');
  event('b','Stop');assert.equal(state.snapshot().state,'working');assert.equal(state.snapshot().completedTurns,1);
  event('b','Stop');assert.equal(state.snapshot().completedTurns,1);
  now+=13000;state.snapshot();event('b','Stop');assert.equal(state.snapshot().completedTurns,1,'duplicate completion remains deduplicated after its card expires');
  event('b','UserPromptSubmit');event('b','Stop');assert.equal(state.snapshot().completedTurns,2);
  event('a','Interrupt');assert.equal(state.snapshot().completedTurns,2,'interrupt is not a completed round');
});

test('round-end requests refresh cached usage and coalesce requests from multiple pets',async t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-round-quota-'));
  const service=await require('../server.cjs').startServer({dataDir:dir,defaultMode:'connected'});
  t.after(()=>{service.close();fs.rmSync(dir,{recursive:true,force:true});});
  const request=async(route,body,method='PUT')=>{const r=await fetch(service.base+route,{method:body?method:'GET',body:body?JSON.stringify(body):undefined});assert.equal(r.status,200);return r.json();};
  let calls=0;service.client.limits=async()=>{const count=++calls;await new Promise(r=>setTimeout(r,15));return {rateLimits:{primary:{usedPercent:count,windowDurationMins:60}}};};
  await request('/balance');assert.equal(calls,1);
  await request('/preferences',{quotaAfterTurn:true});
  await request('/hook',{session_id:'a',hook_event_name:'Stop'},'POST');
  const replies=await Promise.all([request('/balance?round=1'),request('/balance?round=1'),request('/balance?round=1')]);
  assert.equal(calls,2);for(const value of replies)assert.equal(value.windows[0].percent,2);
  await request('/balance?round=1');assert.equal(calls,2);
  await request('/hook',{session_id:'a',hook_event_name:'UserPromptSubmit'},'POST');await request('/hook',{session_id:'a',hook_event_name:'Stop'},'POST');
  assert.equal((await request('/balance?round=2')).windows[0].percent,3);
  await request('/preferences',{quotaAfterTurn:false});await request('/hook',{session_id:'b',hook_event_name:'Stop'},'POST');
  await request('/balance?round=3');assert.equal(calls,3,'disabled automation does not force a cache refresh');
});

test('event mute suppresses notifications and automatic queries but preserves tracking and manual quota',async t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-event-mute-'));let notifications=0,queries=0;
  const service=await require('../server.cjs').startServer({dataDir:dir,defaultMode:'connected',onNotify:()=>notifications++});
  t.after(()=>{service.close();fs.rmSync(dir,{recursive:true,force:true});});
  const request=async(route,body,method='PUT')=>{const r=await fetch(service.base+route,{method:body?method:'GET',body:body?JSON.stringify(body):undefined});assert.equal(r.status,200);return r.json();};
  const config=(await request('/config')).main;config.notificationsEnabled=true;await request('/config',config);
  service.client.limits=async()=>{queries++;return {rateLimits:{primary:{usedPercent:20,windowDurationMins:300}}};};
  await request('/preferences',{disableEventResponse:true,quotaAfterTurn:true});
  for(const event of ['UserPromptSubmit','PermissionRequest','Stop'])await request('/hook',{session_id:'a',hook_event_name:event},'POST');
  assert.equal(notifications,0);assert.equal((await request('/work-status')).completedTurns,1);
  assert.equal((await request('/balance?round=1')).reason,'disabled');assert.equal(queries,0);
  assert.equal((await request('/balance')).ok,true);assert.equal(queries,1);
  await request('/preferences',{disableEventResponse:false});await request('/hook',{session_id:'a',hook_event_name:'PermissionRequest'},'POST');assert.equal(notifications,1);
});
