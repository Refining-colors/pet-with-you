const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createConnectionCheck}=require('../connection.cjs');
const {startServer}=require('../server.cjs');

test('manual hook checks bypass stale requests, pending trust refreshes and errors can retry',async()=>{
  let time=100,requests=[];
  const check=createConnectionCheck(()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),()=>time);
  const old=check.read();await Promise.resolve();
  const fresh=check.read({fresh:true});await Promise.resolve();
  requests[1].resolve({ready:true});await fresh;
  requests[0].resolve({needsReview:9});await old;
  assert.deepEqual(await check.read(),{ready:true});
  check.invalidate();const pending=check.read();await Promise.resolve();requests[2].resolve({needsReview:9});await pending;
  time+=5001;const retry=check.read();await Promise.resolve();requests[3].reject(Error('offline'));await assert.rejects(retry,/offline/);
  const recovered=check.read();await Promise.resolve();requests[4].resolve({ready:true});assert.deepEqual(await recovered,{ready:true});
});

test('pure mode disables hooks and monitoring; connection setup survives an unavailable inspector',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-connection-'));
  let installs=0,inspections=0,fail=true;
  const service=await startServer({dataDir:dir,monitorSessions:true,sessionRoot:path.join(dir,'sessions'),hooksAdapter:{install(){installs++;},async inspect(){inspections++;if(fail)throw Error('fixture runtime unavailable');return {ready:true,installed:9};}}});
  t.after(()=>{service.close();fs.rmSync(dir,{recursive:true,force:true});});
  const req=async(route,body,method=body?'PUT':'GET')=>fetch(service.base+route,{method,...(body?{body:JSON.stringify(body)}:{})}).then(r=>r.json());
  const setup=await req('/connect',{},'POST');assert.equal(setup.configured,true);assert.equal(setup.ready,false);assert.ok(setup.inspectionError);assert.equal(installs,1);
  fail=false;assert.equal((await req('/connection?fresh=1')).ready,true);assert.equal(installs,1);
  await req('/preferences',{mode:'pet'});
  const before=inspections;
  assert.equal((await req('/connection?fresh=1')).disabled,true);assert.equal(inspections,before);
  assert.equal((await req('/hook',{hook_event_name:'Stop',session_id:'fixture'},'POST')).disabled,true);
  assert.equal((await req('/work-status')).state,null);
  assert.equal((await req('/health')).monitor.enabled,false);
  assert.ok((await req('/review-hooks',{},'POST')).error);
});
