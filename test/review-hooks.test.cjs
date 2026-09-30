const test=require('node:test');
const assert=require('node:assert/strict');
const {startReview,quote,args}=require('../review-hooks.cjs');

test('hook review allocates a separate Windows console when launched without a TTY',()=>{
  const calls=[];const child={on(){return child;}};
  startReview({locate:()=>String.raw`C:\Program Files\Codex\codex.exe`,spawnProcess:(...call)=>{calls.push(call);return child;},tty:false});
  assert.equal(calls.length,1);assert.match(calls[0][0],/powershell\.exe$/i);
  assert.ok(calls[0][1].includes('-NonInteractive'));
  const command=calls[0][1].at(-1);
  assert.match(command,/Start-Process/);assert.doesNotMatch(command,/-NoNewWindow|Program Files/);
  assert.deepEqual(JSON.parse(calls[0][2].env.PET_REVIEW_ARGS),args.map(quote));
  assert.equal(calls[0][2].env.PET_REVIEW_EXE,String.raw`C:\Program Files\Codex\codex.exe`);
  assert.equal(calls[0][2].env.TERM,'xterm-256color');
  assert.equal(calls[0][2].env.ELECTRON_RUN_AS_NODE,undefined);
  assert.equal(calls[0][2].windowsHide,true);
});

test('fallback review receives real console handles without touching a Codex account',{skip:process.platform!=='win32',timeout:20000},async t=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {once}=require('node:events');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-review-console-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'console.json');
  const command="@{inputRedirected=[Console]::IsInputRedirected;outputRedirected=[Console]::IsOutputRedirected}|ConvertTo-Json|Set-Content -LiteralPath '"+output.replaceAll("'","''")+"'";
  const child=startReview({tty:false,locate:()=>path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),reviewArgs:['-NoProfile','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')]});
  const [code]=await once(child,'exit');assert.equal(code,0);
  const result=JSON.parse(fs.readFileSync(output,'utf8').replace(/^\uFEFF/,''));
  assert.equal(result.inputRedirected,false);assert.equal(result.outputRedirected,false);
});
