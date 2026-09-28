const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {launchLinkedClient,createClientLauncher,createClientLauncherWithDialogs,clientLauncherStatus,validateTarget}=require('../client-launcher.cjs');
const {SettingsStore}=require('../settings-store.cjs');
const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pet launcher ' paths-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
test('joint launcher rejects both pet shortcut names to prevent recursive launches',t=>{
  const dir=fixture(t);
  for(const name of ['pet-with-u.lnk','pet-with-u (2).lnk','pet-with-you.lnk','Codex withu.lnk','Codex withu (2).lnk','GPT 联动启动.lnk']){
    const file=path.join(dir,name);fs.writeFileSync(file,'fixture');
    assert.throws(()=>validateTarget({kind:'file',file}),/原始启动程序/);
  }
  const file=path.join(dir,'Codex.lnk');fs.writeFileSync(file,'fixture');
  assert.equal(validateTarget({kind:'file',file}).file,file);
});
test('client launch settings distinguish an enabled switch from a saved launch target',t=>{
  const dir=fixture(t),store=new SettingsStore(dir);
  store.set('preferences',{mode:'connected',followClientStart:true});
  assert.deepEqual(clientLauncherStatus(dir),{configured:false});
  fs.writeFileSync(path.join(dir,'client-launcher.local.json'),JSON.stringify({kind:'appId',appId:'Fixture.Package!App',name:'Fixture'}));
  assert.deepEqual(clientLauncherStatus(dir),{configured:true,name:'Fixture'});
  fs.writeFileSync(path.join(dir,'client-launcher.local.json'),'{broken');
  assert.deepEqual(clientLauncherStatus(dir),{configured:false});
});
test('joint launcher always opens both apps, ignores retired switches and preserves the selected mode',async t=>{
  const dir=fixture(t),store=new SettingsStore(dir),calls=[];
  fs.writeFileSync(path.join(dir,'client-launcher.local.json'),JSON.stringify({kind:'appId',appId:'Fixture.Package!App'}));
  const options={dataDir:dir,executable:'fixture-pet.exe',packaged:true,open:async(...args)=>calls.push(args)};
  for(const [mode,enabled] of [['connected',true],['connected',false],['pet',false]]){
    store.set('preferences',{mode,followClientStart:enabled});calls.length=0;
    const result=await launchLinkedClient(options);assert.equal(calls.length,2);assert.equal(result.startedPet,true);
    assert.equal(calls[0][1][0],'shell:AppsFolder\\Fixture.Package!App');
    assert.deepEqual(calls[1][1],['--background']);
    assert.equal(store.get('preferences').mode,mode);
  }
});
test('joint launcher creates a custom-folder link with its own icon and preserves name collisions',{skip:process.platform!=='win32'},t=>{
  const dir=fixture(t),directory=path.join(dir,'custom 中文 🌊');fs.mkdirSync(directory);
  const root=path.resolve(__dirname,'..'),executable=process.execPath;
  const options={dataDir:dir,root,executable,packaged:true,directory,target:{kind:'appId',appId:'Fixture.Package!App'}};
  const first=createClientLauncher(options),bytes=fs.readFileSync(first.file);
  const second=createClientLauncher(options);
  assert.equal(path.basename(first.file),'Codex withu.lnk');
  assert.equal(path.basename(second.file),'Codex withu (2).lnk');
  assert.deepEqual(fs.readFileSync(first.file),bytes);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'client-launcher.local.json'))).shortcuts,[first.file,second.file]);
  const {execFileSync}=require('node:child_process');
  for(const link of [first.file,second.file]){
    const result=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',". '"+path.join(__dirname,'../shell-shortcut.ps1').replaceAll("'","''")+"';$s=New-PetShortcut '"+link.replaceAll("'","''")+"';@{target=$s.TargetPath;args=$s.Arguments;icon=$s.IconLocation}|ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});
    const value=JSON.parse(result);assert.equal(value.args,'--launch-client');assert.equal(value.target,executable);
    assert.equal(value.icon,path.join(root,'build','codex-withu.ico')+',0');
  }
});
test('joint launcher dialog respects cancellation and forwards the selected directory',async t=>{
  const dir=fixture(t),target={kind:'appId',appId:'Fixture.Package!App'},calls=[];
  const options={dataDir:dir,desktop:dir,discover:()=>[target],create:value=>{calls.push(value);return {ok:true};},dialog:{showMessageBox:async()=>({response:0}),showOpenDialog:async()=>({canceled:true,filePaths:[]})}};
  assert.equal((await createClientLauncherWithDialogs(options)).canceled,true);assert.equal(calls.length,0);
  assert.equal((await createClientLauncherWithDialogs({...options,dialog:{...options.dialog,showOpenDialog:async()=>({canceled:false,filePaths:[dir]})}})).ok,true);
  assert.equal(calls[0].directory,dir);assert.equal(calls[0].target.appId,target.appId);
  assert.equal((await createClientLauncherWithDialogs({...options,dialog:{showMessageBox:async()=>({response:2})}})).canceled,true);
});
test('uninstall removes recorded custom-folder launchers only when they still target this installation',{skip:process.platform!=='win32'},t=>{
  const dir=fixture(t),root=path.join(dir,'installed','resources','app'),directory=path.join(dir,'links 中文 🌊'),dataDir=path.join(dir,'data');
  fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.mkdirSync(directory);fs.mkdirSync(dataDir);
  const executable=path.join(dir,'installed','pet-with-you.exe');fs.writeFileSync(executable,'fixture');
  fs.copyFileSync(path.resolve(__dirname,'../shell-shortcut.ps1'),path.join(root,'shell-shortcut.ps1'));
  fs.copyFileSync(path.resolve(__dirname,'../build/codex-withu.ico'),path.join(root,'build/codex-withu.ico'));
  const options={dataDir,root,executable,packaged:true,directory,target:{kind:'appId',appId:'Fixture.Package!App'}};
  const own=createClientLauncher(options),changed=createClientLauncher(options);
  const {execFileSync}=require('node:child_process'),quote=s=>"'"+s.replaceAll("'","''")+"'";
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',`. ${quote(path.join(__dirname,'../shell-shortcut.ps1'))};$s=New-PetShortcut ${quote(changed.file)};$s.TargetPath=${quote(process.execPath)};$s.Save()`],{windowsHide:true});
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.resolve(__dirname,'../cleanup-startup.ps1'),'-Root',root],{windowsHide:true,env:{...process.env,PET_TEST_DATA_DIR:dataDir}});
  assert.equal(fs.existsSync(own.file),false);assert.equal(fs.existsSync(changed.file),true);
});
test('retired follow-client preference is removed without changing close or mode settings',t=>{
  const dir=fixture(t),store=new SettingsStore(dir);
  store.set('preferences',{mode:'connected',followClientStart:true,followClientClose:true});
  const preferences=new (require('../preferences.cjs').Preferences)(dir);
  assert.equal(preferences.value.followClientStart,undefined);
  assert.equal(store.get('preferences').followClientStart,undefined);
  assert.equal(preferences.value.followClientClose,true);assert.equal(preferences.value.mode,'connected');
});
test('first-connection prompt state persists, creation failures remain retryable and other onboarding survives',async t=>{
  const dir=fixture(t),store=new SettingsStore(dir);store.set('onboarding',{shortcutPrompted:true});
  let fail=true;
  const service=await require('../server.cjs').startServer({dataDir:dir,onClientLauncher:async()=>{if(fail)throw new Error('fixture');return {ok:true,file:'fixture.lnk'};}});t.after(()=>service.close());
  const status=()=>fetch(service.base+'/client-launcher').then(r=>r.json());
  assert.equal((await status()).prompted,false);
  await fetch(service.base+'/client-launcher',{method:'POST'});assert.equal((await status()).prompted,false);
  fail=false;await fetch(service.base+'/client-launcher',{method:'POST'});assert.equal((await status()).prompted,true);
  store.set('onboarding',{shortcutPrompted:true});
  await fetch(service.base+'/client-launcher/dismiss',{method:'POST'});
  assert.deepEqual(store.get('onboarding'),{shortcutPrompted:true,clientLauncherPrompted:true});
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
