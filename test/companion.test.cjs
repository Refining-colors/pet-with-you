const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {TaskState}=require('../state.cjs');
const {startServer}=require('../server.cjs');

test('multi-session status priority, interrupted removal, terminal expiry',()=>{
  let now=100;const s=new TaskState(()=>now);
  s.accept({session_id:'a',hook_event_name:'UserPromptSubmit'});now++;
  s.accept({session_id:'b',hook_event_name:'PermissionRequest'});
  assert.equal(s.snapshot().state,'waiting');
  s.accept({session_id:'b',hook_event_name:'Interrupt'});assert.equal(s.snapshot().state,'thinking');
  now++;s.accept({session_id:'a',hook_event_name:'Stop'});assert.equal(s.snapshot().state,'success');
  now+=13000;assert.equal(s.snapshot().state,null);
  assert.equal(s.accept({session_id:'a',hook_event_name:'Unknown'}),false);
  s.accept({session_id:'a',hook_event_name:'PreToolUse'});now+=660000;
  assert.equal(s.snapshot().state,'working');
  s.accept({session_id:'a',hook_event_name:'PostToolUse',tool_failed:true});
  assert.equal(s.snapshot().state,'error');
});
test('companion serves all configured animations and protects mutations',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-test-'));const service=await startServer({dataDir:dir,defaultMode:'connected'});
  t.after(()=>service.close());
  const base=service.base;
  const config=await(await fetch(base+'/config')).json();const a=config.main.animations;
  const names=[...a.idle,...a.turn,...a.drag,...a.clicks,...a.moves.actions.map(x=>x.name),...a.categories.flatMap(c=>c.actions),...Object.values(a.events).flat(2)];
  for(const name of new Set(names)){
    const r=await fetch(base+'/thumb/main/'+encodeURIComponent(name)+'.webm',{headers:{Range:'bytes=0-31'}});
    assert.equal(r.status,206,name);assert.equal((await r.arrayBuffer()).byteLength,32);
  }
  assert.equal((await fetch(base+'/config',{method:'PUT',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base.replace(/\/[a-f0-9]{48}\//,'/wrong/')+'/config')).status,404);
  assert.equal((await fetch(base+'/pic/%2e%2e%2fpackage.json')).status,404);
  let r=await fetch(base+'/hook',{method:'POST',body:JSON.stringify({session_id:'test',hook_event_name:'PermissionRequest'})});assert.equal((await r.json()).ok,true);
  assert.equal((await(await fetch(base+'/work-status')).json()).state,'waiting');
  const next=structuredClone(config.main);next.pets[0].size=500;next.animations.categories[0].weight=0;
  r=await fetch(base+'/config',{method:'PUT',body:JSON.stringify(next)});assert.equal(r.status,200);
  assert.equal((await r.json()).main.pets[0].size,500);
  next.pets[0].size=99999;assert.equal((await fetch(base+'/config',{method:'PUT',body:JSON.stringify(next)})).status,400);
  next.pets=[];assert.equal((await fetch(base+'/config',{method:'PUT',body:JSON.stringify(next)})).status,400);
  const chatConfig=structuredClone(config.main);chatConfig.chatMemoryRounds=0;chatConfig.chatImageEnabled=true;
  assert.equal((await fetch(base+'/config',{method:'PUT',body:JSON.stringify(chatConfig)})).status,200);
  const meme=Object.keys(chatConfig.memes)[0];const prompts=[];
  await fetch(base+'/preferences',{method:'PUT',body:JSON.stringify({chatSource:'gpt',chatSourceChosen:true})});
  service.client.chat=async prompt=>{prompts.push(prompt);return JSON.stringify({reply:'测试回复',image:meme});};
  for(const text of ['FIRST_UNIQUE_MESSAGE','第二条']){
    const reply=await(await fetch(base+'/chat',{method:'POST',body:JSON.stringify({text})})).json();
    assert.equal(reply.reply,'测试回复');assert.equal(reply.image,meme);
  }
  assert.equal(prompts[1].includes('FIRST_UNIQUE_MESSAGE'),false);
  service.client.limits=async()=>({rateLimits:{primary:{usedPercent:42,windowDurationMins:60,resetsAt:2000000000}},rateLimitResetCredits:{availableCount:2}});
  const quota=await(await fetch(base+'/balance')).json();
  assert.equal(quota.kind,'codex');assert.deepEqual(quota.windows,[{percent:42,minutes:60,resetsAt:new Date(2000000000000).toISOString()}]);
  assert.equal(quota.availableResetCount,2);assert.ok(quota.queriedAt>0);
  assert.equal((await(await fetch(base+'/balance')).json()).queriedAt,quota.queriedAt,'cached usage must keep its original update time');
});
