const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawn} = require('node:child_process');
const {hookCommand, ownsHook} = require('../hook-command.cjs');

function run(shell, args, env, input = '{}') {
  return new Promise((resolve,reject) => {
    const child = spawn(shell,args,{env,windowsHide:true,timeout:10000});
    let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b); child.stderr.on('data',b=>stderr+=b);
    child.on('error',reject); child.on('close',code=>resolve({code,stdout,stderr}));
    child.stdin.on('error',()=>{}); child.stdin.end(input);
  });
}

test('Windows registered commands execute literally, forward stdin and stay silent', {skip:process.platform!=='win32'}, async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"pet hooks ' $literal 中文-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const result=path.join(root,'received.json');
  fs.writeFileSync(path.join(root,'hook.cjs'),`let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{require('fs').writeFileSync(process.env.PET_HOOK_RESULT,s);console.log('must stay silent');console.error('also silent');});`);
  fs.writeFileSync(path.join(root,'hook.cmd'),'@echo off\r\n"'+process.execPath+'" "%~dp0hook.cjs"\r\n');
  const env={...process.env,PET_HOOK_RESULT:result};
  const old=await run('powershell.exe',['-NoProfile','-Command','"fixture/hook.cmd"'],env);
  assert.equal(old.stdout.trim(),'fixture/hook.cmd');
  for(const packaged of [false,true]){
    const {command}=hookCommand({root,packaged,executable:process.execPath});
    assert.ok(ownsHook(command,root));
    assert.equal(ownsHook(command,root+'-other'),false);
    for(const [shell,args] of [['powershell.exe',['-NoProfile','-NonInteractive','-Command',command]],[process.env.ComSpec,['/d','/c',command]]]){
      const payload=JSON.stringify({session_id:'fixture',hook_event_name:'UserPromptSubmit'});
      assert.deepEqual(await run(shell,args,env,payload),{code:0,stdout:'',stderr:''});
      assert.equal(fs.readFileSync(result,'utf8'),payload);
      fs.unlinkSync(result);
    }
  }
  // Exercise the real forwarder with no companion, not just a quiet fixture.
  for(const file of ['hook.cjs','project.cjs'])fs.copyFileSync(path.join(__dirname,'..',file),path.join(root,file));
  const {command}=hookCommand({root,packaged:true});
  const closedEnv={...env,PET_TEST_DATA_DIR:root};
  assert.deepEqual(await run('powershell.exe',['-NoProfile','-Command',command],closedEnv),{code:0,stdout:'',stderr:''});
  fs.writeFileSync(path.join(root,'connection.json'),JSON.stringify({base:'http://127.0.0.1:1/closed'}));
  assert.deepEqual(await run('powershell.exe',['-NoProfile','-Command',command],closedEnv),{code:0,stdout:'',stderr:''});
  let received;
  const server=require('node:http').createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;received=JSON.parse(body);res.end('{}');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    fs.writeFileSync(path.join(root,'connection.json'),JSON.stringify({base:'http://127.0.0.1:'+server.address().port}));
    assert.deepEqual(await run('powershell.exe',['-NoProfile','-Command',command],closedEnv,JSON.stringify({session_id:'fixture',hook_event_name:'PostToolUse',tool_response:{exit_code:1},prompt:'private-fixture'})),{code:0,stdout:'',stderr:''});
    assert.equal(received.session_id,'fixture');assert.equal(received.tool_failed,true);
    assert.equal(JSON.stringify(received).includes('private-fixture'),false);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('hook installation replaces old definitions without duplicating or touching unrelated hooks',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-hooks-config-'));
  const previous=process.env.CODEX_HOME;process.env.CODEX_HOME=dir;
  t.after(()=>{if(previous===undefined)delete process.env.CODEX_HOME;else process.env.CODEX_HOME=previous;fs.rmSync(dir,{recursive:true,force:true});});
  const root=path.resolve('fixture resources');
  const old='"'+path.join(root,'hook.cmd').replaceAll('\\','/')+'"';
  const unrelated={type:'command',command:'echo unrelated'};
  const file=path.join(dir,'hooks.json');
  fs.writeFileSync(file,JSON.stringify({hooks:{Stop:[{matcher:'',hooks:[{type:'command',command:old},unrelated,{type:'command',command:old}]}]}}));
  const {installHooks}=require('../install-hooks.cjs');
  installHooks({root,packaged:true});
  const first=fs.readFileSync(file,'utf8');
  const config=JSON.parse(first);
  const hooks=Object.values(config.hooks).flatMap(gs=>gs.flatMap(g=>g.hooks));
  assert.equal(hooks.filter(h=>ownsHook(h.command,root)).length,9);
  assert.deepEqual(config.hooks.Stop[0],{matcher:'',hooks:[unrelated]});
  assert.equal(fs.readdirSync(dir).filter(n=>n.includes('pet-backup')).length,1);
  installHooks({root,packaged:true});
  assert.equal(fs.readFileSync(file,'utf8'),first);
});
