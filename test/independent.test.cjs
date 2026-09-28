const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {ApiSettings,ApiClient,normalizeBase}=require('../api-client.cjs');
const {startServer}=require('../server.cjs');
const {snapPosition}=require('../runtime/snap.js');
const protect=v=>Buffer.from(v).toString('base64'),unprotect=v=>Buffer.from(v,'base64').toString();
test('API allows IPv4 and IPv6 loopback HTTP but requires HTTPS for remote hosts',()=>{
  for(const host of ['localhost','127.0.0.1','[::1]'])assert.equal(normalizeBase('http://'+host+':1234/v1/'),'http://'+host+':1234/v1');
  for(const host of ['example.test','192.168.1.20','[2001:db8::1]'])assert.throws(()=>normalizeBase('http://'+host+'/v1'),/HTTPS/);
});
test('API transport uses configured endpoint and model, rejects redirects and never returns secret',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-api-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const settings=new ApiSettings(dir,{protect,unprotect});settings.save({baseUrl:'https://example.test/v1',model:'custom-model',apiKey:'fixture-secret'});
  assert.equal(JSON.stringify(settings.publicValue()).includes('fixture-secret'),false);
  assert.throws(()=>settings.save({baseUrl:'https://different.test/v1',model:'custom-model'}));
  assert.throws(()=>normalizeBase('https://user:secret@example.test/v1'));
  const client=new ApiClient(settings,{fetcher:async(url,options)=>{
    assert.equal(url,'https://example.test/v1/chat/completions');assert.equal(options.redirect,'error');
    assert.equal(JSON.parse(options.body).model,'custom-model');assert.equal(options.headers.Authorization,'Bearer fixture-secret');
    return new Response(JSON.stringify({choices:[{message:{content:'hello'}}]}));
  }});
  assert.equal(await client.chat('test'),'hello');
  settings.save({baseUrl:'https://example.test/v1',model:'custom-model',clearKey:true});
  await assert.rejects(client.chat('test'),/密钥/);
});
test('pure mode supports independent chat and whisper without starting Codex, clears task state on mode changes',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-independent-'));
  const remote=http.createServer((req,res)=>{req.resume();res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'independent reply'}}]}));});
  await new Promise(r=>remote.listen(0,'127.0.0.1',r));
  const service=await startServer({dataDir:dir,protect,unprotect});
  t.after(()=>{service.close();remote.close();fs.rmSync(dir,{recursive:true,force:true});});
  service.client.start=async()=>{throw new Error('Codex must not start in pure mode');};
  const call=async(route,body)=>{const r=await fetch(service.base+route,body?{method:'PUT',body:JSON.stringify(body)}:undefined);return r.json();};
  assert.equal((await call('/preferences')).mode,'pet');
  await call('/api/settings',{baseUrl:`http://127.0.0.1:${remote.address().port}/v1`,model:'fixture',apiKey:'local-fixture'});
  const chat=await fetch(service.base+'/chat',{method:'POST',body:JSON.stringify({text:'hello'})}).then(r=>r.json());
  assert.equal(chat.reply,'independent reply');
  assert.equal((await call('/whisper/trigger')).reply,'independent reply');
  assert.equal((await call('/quota/query?source=account')).ok,false);
  await call('/preferences',{mode:'connected'});
  assert.equal((await fetch(service.base+'/chat',{method:'POST',body:JSON.stringify({text:'hello'})})).status,409);
  await call('/preferences',{chatSource:'api',chatSourceChosen:true});
  assert.equal((await fetch(service.base+'/chat',{method:'POST',body:JSON.stringify({text:'hello'})}).then(r=>r.json())).reply,'independent reply');
  assert.equal((await call('/whisper/trigger')).repeated,true);
  service.client.chat=async()=> 'gpt reply';
  await call('/preferences',{chatSource:'gpt',chatSourceChosen:true});
  assert.equal((await call('/whisper')).reply,'gpt reply');
  assert.equal((await fetch(service.base+'/chat',{method:'POST',body:JSON.stringify({text:'hello'})}).then(r=>r.json())).reply,'gpt reply');
  await fetch(service.base+'/hook',{method:'POST',body:JSON.stringify({session_id:'fixture',hook_event_name:'PermissionRequest'})});
  assert.equal((await call('/work-status')).state,'waiting');
  await call('/preferences',{mode:'pet'});await call('/preferences',{mode:'connected'});
  assert.equal((await call('/work-status')).state,null);
});

test('API profiles persist encrypted, can load and delete, and clearing current settings survives restart',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-profiles-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const settings=new ApiSettings(dir,{protect,unprotect});
  settings.save({baseUrl:'https://example.test/v1',model:'fixture',apiKey:'private-fixture-key'});
  const [profile]=settings.saveProfile('Daily');assert.equal(profile.name,'Daily');
  assert.ok(!JSON.stringify(settings.profiles()).includes('private-fixture-key'));
  assert.ok(!fs.readFileSync(settings.file,'utf8').includes('private-fixture-key'));
  settings.clear();const reopened=new ApiSettings(dir,{protect,unprotect});assert.deepEqual(reopened.publicValue(),{profileName:'',baseUrl:'',model:'',configured:false});
  reopened.loadProfile(profile.id);assert.equal(reopened.key(),'private-fixture-key');
  reopened.deleteProfile(profile.id);assert.deepEqual(reopened.profiles(),[]);assert.equal(reopened.publicValue().configured,true);
  reopened.clear();assert.equal(reopened.key(),null);
});
test('snap respects separate screens, gaps and full animation canvas, keeps horizontal position',()=>{
  const target={id:'work',x:-1920,y:1040,width:1920,top:0};
  const input={x:-900,y:730,width:460,height:259,canvasHeight:281,targets:[target],gap:6};
  const result=snapPosition(input);assert.equal(result.x,-900);assert.equal(result.y+281,1034);assert.equal(result.attachment,'work');
  assert.equal(snapPosition({...input,x:100}).attachment,null);
  assert.equal(snapPosition({...input,y:400}).attachment,null);
  assert.equal(snapPosition({...input,attachment:'work',targets:[{...target,y:800}]}).y,513);
  assert.equal(snapPosition({...input,attachment:'work',targets:[]}).attachment,null);
});
test('client lifecycle ignores pure mode, disabled switches and detection errors',()=>{
  const l=new (require('../client-lifecycle.cjs').ClientLifecycle)();
  const p={mode:'connected',followClientClose:true};
  for(let i=0;i<8;i++)assert.equal(l.update(p,false),false);
  l.update(p,true);l.update(p,false);l.update(p,undefined);
  assert.equal(l.update(p,false),false);assert.equal(l.update(p,false),false);assert.equal(l.update(p,false),true);
  l.update({...p,mode:'pet'},false);assert.equal(l.update(p,false),false);
  l.update(p,true);assert.equal(l.update({...p,followClientClose:false},false),false);
});
test('Startup shortcut uses current paths with spaces and is removable without admin', {skip:process.platform!=='win32'},t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pet startup ' paths-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const {syncStartup,psString}=require('../autostart.cjs');
  const opts={dataDir:dir,shortcutDir:dir,root:path.resolve(__dirname,'..'),executable:process.execPath,preferences:{mode:'pet',autostart:true}};
  syncStartup(opts);const shortcut=path.join(dir,'DSH Pet Companion.lnk');assert.ok(fs.existsSync(shortcut));
  const read=`$s=(New-Object -ComObject WScript.Shell).CreateShortcut(${psString(shortcut)});$s.Arguments`;
  const args=require('node:child_process').execFileSync('powershell.exe',['-NoProfile','-Command',read],{encoding:'utf8',windowsHide:true});
  assert.ok(args.includes('"'+dir+'"'));assert.ok(args.includes('startup-watch.ps1'));
  syncStartup({...opts,preferences:{...opts.preferences,autostart:false}});assert.equal(fs.existsSync(shortcut),false);
});
