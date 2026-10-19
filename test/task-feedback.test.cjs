const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Diagnostics,issue}=require('../diagnostics.cjs'),{TaskState}=require('../state.cjs'),{ThreadMetadata}=require('../thread-metadata.cjs');
test('two conversations keep independent turns despite delayed start, tools and old completion',()=>{
  let now=100;const tasks=new TaskState(()=>now);
  const send=(id,turn,event,extra={})=>tasks.accept({session_id:id,turn_id:turn,hook_event_name:event,...extra});
  send('a','a1','UserPromptSubmit');send('b','b1','UserPromptSubmit',{title:'Literature'});
  send('a','a1','Stop');now+=13000;tasks.snapshot();
  for(const name of ['UserPromptSubmit','PreToolUse','PermissionRequest','PostCompact'])assert.equal(send('a','a1',name),false);
  assert.equal(send('a','','UserPromptSubmit',{inferred:true}),false);
  assert.equal(tasks.snapshot().activeCount,1);assert.equal(tasks.snapshot().items[0].title,'Literature');
  send('a','a2','UserPromptSubmit',{inferred:true});assert.equal(send('a','a1','Stop'),false);
  assert.equal(tasks.snapshot().activeCount,2);
  send('a','a2','Stop');send('b','b1','Stop');assert.equal(tasks.completedTurns,3);
});
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-feedback-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('internal subagent hooks do not become separate conversations or complete the parent',async t=>{
  const dir=temp(t),{DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(dir,'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT, source TEXT, title TEXT)');
  db.prepare('INSERT INTO threads VALUES(?,?,?)').run('parent','vscode','Real conversation');
  db.prepare('INSERT INTO threads VALUES(?,?,?)').run('child',JSON.stringify({subagent:{thread_spawn:{parent_thread_id:'parent'}}}),'');
  db.close();
  const service=await require('../server.cjs').startServer({dataDir:path.join(dir,'pet'),sessionRoot:path.join(dir,'sessions'),defaultMode:'connected'});t.after(()=>service.close());
  const send=(id,event)=>fetch(service.base+'/hook',{method:'POST',body:JSON.stringify({session_id:id,hook_event_name:event})});
  await send('parent','UserPromptSubmit');
  for(const event of ['UserPromptSubmit','PreToolUse','PostToolUse','Stop'])await send('child',event);
  const state=await fetch(service.base+'/work-status').then(r=>r.json());
  assert.equal(state.activeCount,1);assert.equal(state.trackedCount,1);assert.equal(state.completedTurns,0);assert.equal(state.items[0].title,'Real conversation');
});
test('unprompted hook events do not add phantom conversations beside a real task',async t=>{
  const service=await require('../server.cjs').startServer({dataDir:temp(t),defaultMode:'connected'});t.after(()=>service.close());
  const send=(id,event)=>fetch(service.base+'/hook',{method:'POST',body:JSON.stringify({session_id:id,hook_event_name:event})});
  await send('real','UserPromptSubmit');
  for(const event of ['PreToolUse','PostToolUse','PostCompact','PermissionRequest','Stop'])await send('background',event);
  const state=await fetch(service.base+'/work-status').then(r=>r.json());
  assert.equal(state.activeCount,1);assert.equal(state.trackedCount,1);assert.equal(state.items[0].sessionId,'real');
  await send('background','UserPromptSubmit');
  assert.equal((await fetch(service.base+'/work-status').then(r=>r.json())).activeCount,2);
});
test('account timeout ignore hides historical errors, skips new logs and preserves API and other failures',t=>{
  const dir=temp(t);let ignore=false;const logs=new Diagnostics(dir,{ignoreAccountTimeouts:()=>ignore});
  logs.record('quota-context',Object.assign(issue('workspace-routing'),{stage:'account/read'}));assert.equal(logs.summary().count,1);
  ignore=true;assert.equal(logs.summary().count,0);assert.equal(logs.summary().ignoredCount,1);assert.equal(JSON.parse(logs.exportText()).errors.length,0);
  assert.equal(logs.record('quota-account',issue('gpt-timeout')).ignored,true);
  logs.record('chat-api',issue('timeout'));logs.record('chat-gpt',issue('workspace-routing'));logs.record('quota-proxy',issue('timeout'));logs.record('quota-context',issue('permission'));
  assert.equal(logs.summary().count,4);ignore=false;assert.equal(logs.summary().count,5);
});
test('native task data preserves actual titles across hooks and sorts multiple conversations',()=>{
  let now=100;const state=new TaskState(()=>++now);
  state.accept({session_id:'a',title:'First conversation',hook_event_name:'PreToolUse',tool_name:'exec_command'});
  state.accept({session_id:'b',title:'Second conversation',hook_event_name:'PermissionRequest'});
  state.accept({session_id:'a',hook_event_name:'PostToolUse'});
  const snapshot=state.snapshot();assert.equal(snapshot.items[0].title,'Second conversation');assert.equal(snapshot.items[1].title,'First conversation');assert.equal(snapshot.activeCount,2);
});
test('late tool completion cannot reopen a completed turn',()=>{
  let now=100;const state=new TaskState(()=>++now);
  state.accept({session_id:'a',hook_event_name:'PreToolUse'});
  state.accept({session_id:'a',hook_event_name:'Stop'});
  assert.equal(state.accept({session_id:'a',hook_event_name:'PostToolUse'}),false);
  assert.equal(state.snapshot().state,'success');
  state.accept({session_id:'a',hook_event_name:'UserPromptSubmit'});
  assert.equal(state.accept({session_id:'a',hook_event_name:'PostToolUse'}),true);
  assert.equal(state.snapshot().state,'result');
});
test('direct hooks resolve a local title without waiting for a session append',async t=>{
  const dir=temp(t),sessions=path.join(dir,'sessions');fs.mkdirSync(sessions);
  fs.writeFileSync(path.join(dir,'session_index.jsonl'),JSON.stringify({id:'fixture',thread_name:'Known task'})+'\n');
  const service=await require('../server.cjs').startServer({dataDir:path.join(dir,'pet'),defaultMode:'connected',sessionRoot:sessions});t.after(()=>service.close());
  await fetch(service.base+'/hook',{method:'POST',body:JSON.stringify({session_id:'fixture',hook_event_name:'UserPromptSubmit'})});
  const work=await fetch(service.base+'/work-status').then(r=>r.json());
  assert.equal(work.items[0].title,'Known task');
});
test('thread title reads only local title metadata, prefers user name and falls back to index',t=>{
  const dir=temp(t),{DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(dir,'state_5.sqlite'));
  db.exec('CREATE TABLE threads(id TEXT, title TEXT, name TEXT, first_user_message TEXT)');db.prepare('INSERT INTO threads VALUES(?,?,?,?)').run('fixture','Generated name','Renamed conversation','private message');db.close();
  fs.writeFileSync(path.join(dir,'session_index.jsonl'),JSON.stringify({id:'fallback',thread_name:'Index title'})+'\n');
  const reader=new ThreadMetadata(dir);assert.equal(reader.title('fixture'),'Renamed conversation');assert.equal(reader.title('fallback'),'Index title');assert.equal(reader.title('unknown'),'');
});
test('ignoring account timeouts skips automatic lookups and opening tasks accepts only known IDs',async t=>{
  const dir=temp(t);let opened;
  const service=await require('../server.cjs').startServer({dataDir:dir,defaultMode:'connected',onOpenThread:async id=>{opened=id;}});t.after(()=>service.close());
  const req=async(route,method='GET',body)=>{const res=await fetch(service.base+route,{method,body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json()};};
  assert.equal((await req('/quota/context')).body.skipped,true);assert.ok(!service.client.child);
  service.client.limits=async()=>{throw issue('gpt-timeout');};const result=await req('/quota/query?source=account');assert.equal(result.body.ignored,true);assert.equal(service.diagnostics.summary().count,0);
  const id='12345678-1234-1234-1234-123456789abc';await req('/hook','POST',{session_id:id,hook_event_name:'UserPromptSubmit'});
  assert.equal((await req('/work/open','POST',{id})).body.ok,true);assert.equal(opened,id);
  assert.equal((await req('/work/open','POST',{id:'not-a-thread'})).status,400);
});
