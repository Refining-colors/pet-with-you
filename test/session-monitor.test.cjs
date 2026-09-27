const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {SessionMonitor,eventMetadata}=require('../session-monitor.cjs');
test('connecting recovers recent completion without counting a new quota-triggering turn',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  let now=Date.now();const tasks=new (require('../state.cjs').TaskState)(()=>now);
  const file=path.join(root,'rollout-history.jsonl');
  const line=(event,at)=>JSON.stringify({timestamp:new Date(at).toISOString(),type:'event_msg',payload:{type:event}})+'\n';
  fs.writeFileSync(file,JSON.stringify({type:'session_meta',payload:{id:'history',source:'vscode'}})+'\n'+line('task_complete',now-2000));
  const monitor=new SessionMonitor({root,clock:()=>now,onEvent:e=>tasks.accept(e)});monitor.active=true;t.after(()=>monitor.close());
  await monitor.poll();assert.equal(tasks.completedTurns,0);
  now++;fs.appendFileSync(file,line('task_started',now));await monitor.poll();
  now++;fs.appendFileSync(file,line('task_complete',now));await monitor.poll();assert.equal(tasks.completedTurns,1);
});
test('server connects session events to pet states and stops monitoring in pure mode',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-session-server-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const sessions=path.join(root,'sessions');fs.mkdirSync(sessions);
  const file=path.join(sessions,'rollout-test.jsonl');fs.writeFileSync(file,JSON.stringify({type:'session_meta',payload:{id:'fixture',source:'vscode'}})+'\n'+JSON.stringify({timestamp:new Date().toISOString(),type:'event_msg',payload:{type:'task_started'}})+'\n');
  const service=await require('../server.cjs').startServer({dataDir:root,defaultMode:'connected',monitorSessions:true,sessionRoot:sessions});t.after(()=>service.close());
  const read=async()=>await(await fetch(service.base+'/health')).json();
  let health;for(let i=0;i<30;i++){health=await read();if(health.monitor.lastEvent)break;await new Promise(r=>setTimeout(r,30));}
  assert.equal(health.work.state,'thinking');assert.equal(health.work.trackedCount,1);
  await fetch(service.base+'/hook',{method:'POST',body:JSON.stringify({session_id:'fixture',hook_event_name:'PermissionRequest'})});
  assert.equal((await read()).work.trackedCount,1);
  await fetch(service.base+'/preferences',{method:'PUT',body:JSON.stringify({mode:'pet'})});
  health=await read();assert.equal(health.monitor.enabled,false);assert.equal(health.work.state,null);
});
test('local monitor follows desktop events, partial appends, multiple tasks and completion without forwarding contents',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-monitor-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let now=Date.now();const events=[];
  const m=new SessionMonitor({root,onEvent:e=>events.push(e),clock:()=>now});m.active=true;t.after(()=>m.close());
  const record=(type,payload)=>JSON.stringify({timestamp:new Date(now).toISOString(),type,payload})+'\n';
  const a=path.join(root,'rollout-a.jsonl'),b=path.join(root,'rollout-b.jsonl');
  fs.writeFileSync(a,record('session_meta',{id:'a',source:'vscode',originator:'Codex Desktop'})+record('event_msg',{type:'task_started',prompt:'private-prompt'}));
  fs.writeFileSync(b,record('session_meta',{id:'b',source:'vscode'})+record('event_msg',{type:'task_complete',last_agent_message:'private-reply'}));
  await m.poll();assert.equal(events.find(e=>e.session_id==='a').hook_event_name,'UserPromptSubmit');assert.equal(events.find(e=>e.session_id==='b').hook_event_name,'Stop');
  const count=events.length;await m.poll();assert.equal(events.length,count);
  now++;const line=record('response_item',{type:'custom_tool_call',name:'exec_command',input:'private-key'});fs.appendFileSync(a,line.slice(0,-3));await m.poll();assert.equal(events.length,count);
  fs.appendFileSync(a,line.slice(-3));await m.poll();assert.equal(events.at(-1).hook_event_name,'PreToolUse');
  now++;fs.appendFileSync(a,record('event_msg',{type:'task_complete',last_agent_message:'private-reply'}));await m.poll();assert.equal(events.at(-1).hook_event_name,'Stop');
  assert.ok(!JSON.stringify(events).includes('private-'));
  m.setEnabled(false);now++;fs.appendFileSync(a,record('event_msg',{type:'task_started'}));const stopped=events.length;await m.poll();assert.equal(events.length,stopped);
});
test('monitor excludes CLI, ignores stale completion, expires stalled tasks and recognizes approval calls',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-monitor-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));let now=Date.now();const events=[];
  const m=new SessionMonitor({root,onEvent:e=>events.push(e),clock:()=>now});m.active=true;t.after(()=>m.close());
  const create=(id,source,event,age)=>{const file=path.join(root,'rollout-'+id+'.jsonl');fs.writeFileSync(file,JSON.stringify({type:'session_meta',payload:{id,source}})+'\n'+JSON.stringify({timestamp:new Date(now-age).toISOString(),type:'event_msg',payload:{type:event}})+'\n');};
  create('cli','cli','task_started',0);create('done','vscode','task_complete',60000);create('active','vscode','task_started',0);
  await m.poll();assert.equal(events.length,1);assert.equal(events[0].session_id,'active');now+=900001;await m.poll();assert.equal(events.at(-1).hook_event_name,'SessionEnd');
  const mapped=eventMetadata({timestamp:new Date(now).toISOString(),type:'response_item',payload:{type:'function_call',name:'request_user_input',arguments:'private'}});
  assert.equal(mapped.tool_name,'request_user_input');assert.equal(mapped.hook_event_name,'PreToolUse');
});
