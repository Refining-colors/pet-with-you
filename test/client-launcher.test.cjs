const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {launchLinkedClient,createClientLaunchers}=require('../client-launcher.cjs');
const {SettingsStore}=require('../settings-store.cjs');
const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pet launcher ' paths-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
test('joint launcher rereads switches each launch and pure mode never follows the client',async t=>{
  const dir=fixture(t),store=new SettingsStore(dir),calls=[];
  fs.writeFileSync(path.join(dir,'client-launcher.local.json'),JSON.stringify({kind:'appId',appId:'Fixture.Package!App'}));
  const options={dataDir:dir,executable:'fixture-pet.exe',packaged:true,open:async(...args)=>calls.push(args)};
  for(const [mode,enabled,count] of [['connected',true,2],['connected',false,1],['pet',true,1]]){
    store.set('preferences',{mode,followClientStart:enabled});calls.length=0;
    const result=await launchLinkedClient(options);assert.equal(calls.length,count);assert.equal(result.startedPet,count===2);
    assert.equal(calls[0][1][0],'shell:AppsFolder\\Fixture.Package!App');
    if(count===2)assert.deepEqual(calls[1][1],['--background']);
  }
});
test('joint launcher creates movable desktop and Start Menu links without altering client binaries',{skip:process.platform!=='win32'},t=>{
  const dir=fixture(t),desktop=path.join(dir,'desktop'),programs=path.join(dir,'menu');fs.mkdirSync(desktop);fs.mkdirSync(programs);
  const executable=path.join(dir,'pet-with-you.exe');
  createClientLaunchers({dataDir:dir,root:dir,executable,packaged:true,desktop,programs,target:{kind:'appId',appId:'Fixture.Package!App'}});
  const {execFileSync}=require('node:child_process');
  for(const folder of [desktop,programs]){
    const link=path.join(folder,'GPT 联动启动.lnk');assert.ok(fs.existsSync(link));
    const result=execFileSync('powershell.exe',['-NoProfile','-Command',"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('"+link.replaceAll("'","''")+"');$s.Arguments"],{encoding:'utf8',windowsHide:true});
    assert.equal(result.trim(),'--launch-client');
  }
});
test('client-close confirmation honors newly saved opt-out, pure mode, failed saves and restarted clients',async()=>{
  const {ClientLifecycle}=require('../client-lifecycle.cjs');
  for(const scenario of ['opt-out','pure','save-failed','restarted','unknown','close']){
    const lifecycle=new ClientLifecycle();let pref={mode:'connected',followClientClose:true},running=false;
    const result=await lifecycle.confirmClose({flush:async()=>{if(scenario==='opt-out')pref.followClientClose=false;if(scenario==='pure')pref.mode='pet';if(scenario==='restarted')running=true;if(scenario==='unknown')running=null;return scenario!=='save-failed';},getPreferences:()=>pref,getRunning:()=>running});
    assert.equal(result,scenario==='close',scenario);
  }
});
test('follow-client startup alone creates no login watcher',{skip:process.platform!=='win32'},t=>{
  const dir=fixture(t);
  require('../autostart.cjs').syncStartup({dataDir:dir,shortcutDir:dir,root:path.resolve(__dirname,'..'),executable:process.execPath,preferences:{mode:'connected',autostart:false,followClientStart:true}});
  assert.equal(fs.existsSync(path.join(dir,'DSH Pet Companion.lnk')),false);
});
