const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Positions}=require('../positions.cjs');
const {TaskState}=require('../state.cjs');
test('positions persist independently for multiple pets across process restarts',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-positions-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const first=new Positions(dir);first.set('one',{x:-750,feet:920});first.set('two',{x:1800,feet:600});first.flush();
  const second=new Positions(dir);assert.deepEqual(second.get('one'),{x:-750,feet:920});assert.deepEqual(second.get('two'),{x:1800,feet:600});
  second.set('one',{x:NaN,feet:0});assert.deepEqual(second.get('one'),first.get('one'));
});
test('multiple tasks show urgent state and counts, completed task does not mask active task',()=>{
  const s=new TaskState(()=>1000);
  s.accept({session_id:'a',hook_event_name:'PreToolUse'});s.accept({session_id:'b',hook_event_name:'UserPromptSubmit'});
  assert.equal(s.snapshot().activeCount,2);assert.equal(s.snapshot().state,'working');assert.ok(s.snapshot().task.includes('2'));
  s.accept({session_id:'b',hook_event_name:'PermissionRequest'});assert.equal(s.snapshot().state,'waiting');
  s.accept({session_id:'b',hook_event_name:'Stop'});assert.equal(s.snapshot().state,'working');assert.equal(s.snapshot().activeCount,1);
});
test('same-clock updates still show the most recently received task',()=>{
  const s=new TaskState(()=>1000);
  s.accept({session_id:'first',hook_event_name:'UserPromptSubmit'});
  s.accept({session_id:'second',hook_event_name:'UserPromptSubmit'});
  assert.equal(s.snapshot().state,'thinking');
  assert.equal(s.snapshot().ts,1002);
});
