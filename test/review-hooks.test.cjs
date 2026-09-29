const test=require('node:test');
const assert=require('node:assert/strict');
const {startReview,quote,args}=require('../review-hooks.cjs');

test('hook review allocates a separate Windows console when launched without a TTY',()=>{
  const calls=[];const child={on(){return child;}};
  startReview({locate:()=>String.raw`C:\Program Files\Codex\codex.exe`,spawnProcess:(...call)=>{calls.push(call);return child;},tty:false});
  assert.equal(calls.length,1);assert.match(calls[0][0],/cmd\.exe$/i);
  assert.deepEqual(calls[0][1].slice(0,2),['/d','/c']);
  assert.match(calls[0][1][2],/^start "pet-with-you Hooks" \/wait /);assert.match(calls[0][1][2],/Codex.*codex\.exe/i);
  assert.ok(args.every(value=>calls[0][1][2].includes(quote(value))));
  assert.equal(calls[0][2].windowsHide,false);
});
