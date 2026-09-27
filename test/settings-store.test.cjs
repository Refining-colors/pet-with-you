const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SettingsStore}=require('../settings-store.cjs');
const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-settings-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
test('migrates old settings once, preserves ciphertext locally, and shares no credentials',t=>{
  const dir=fixture(t),other=fixture(t);
  fs.writeFileSync(path.join(dir,'preferences.json'),JSON.stringify({mode:'connected',followClientClose:false}));
  fs.writeFileSync(path.join(dir,'api-settings.json'),JSON.stringify({baseUrl:'https://example.test/v1',model:'fixture',secret:'encrypted-fixture'}));
  fs.writeFileSync(path.join(dir,'api-settings.json.profiles'),JSON.stringify([{id:'one',name:'Fixture',baseUrl:'https://example.test/v1',secret:'encrypted-profile'}]));
  const store=new SettingsStore(dir);
  assert.equal(store.get('preferences').followClientClose,false);
  assert.equal(store.get('api').secret,'encrypted-fixture');
  assert.ok(fs.existsSync(path.join(dir,'legacy-settings','preferences.json')));
  const text=fs.readFileSync(store.file,'utf8');assert.ok(!text.includes('encrypted-'));
  fs.copyFileSync(store.file,path.join(other,'settings.json'));
  const shared=new SettingsStore(other);
  assert.equal(shared.get('api').secret,undefined);assert.equal(shared.get('apiProfiles')[0].secret,undefined);
  assert.equal(shared.get('api').model,'fixture');
  store.set('api',{...store.get('api'),secret:''});
  assert.ok(!fs.readFileSync(store.vault,'utf8').includes('encrypted-fixture'));
  assert.equal(store.get('apiProfiles')[0].secret,'encrypted-profile');
});
test('independent modules merge writes and changed service URLs cannot reuse a credential reference',t=>{
  const dir=fixture(t),a=new SettingsStore(dir),b=new SettingsStore(dir);
  a.set('preferences',{mode:'pet'});b.set('positions',{maid:{x:3,feet:4}});
  assert.equal(a.get('preferences').mode,'pet');assert.equal(a.get('positions').maid.feet,4);
  a.set('quota',{proxy:{endpoint:'https://quota.example.test',secret:'fixture-cipher'}});
  const raw=JSON.parse(fs.readFileSync(a.file));raw.sections.quota.proxy.endpoint='https://different.example.test';fs.writeFileSync(a.file,JSON.stringify(raw));
  assert.equal(b.get('quota').proxy.secret,undefined);
});
test('invalid or future settings fail without overwriting the original',t=>{
  const dir=fixture(t),file=path.join(dir,'settings.json');
  for(const input of ['{broken',JSON.stringify({schemaVersion:999,sections:{}})]){
    fs.writeFileSync(file,input);assert.throws(()=>new SettingsStore(dir));assert.equal(fs.readFileSync(file,'utf8'),input);
  }
});
test('a copied settings file restores API and quota profile fields while requiring the recipient key',t=>{
  const sender=fixture(t),recipient=fixture(t),protect=value=>'cipher:'+value,unprotect=value=>value.slice(7);
  const {ApiSettings}=require('../api-client.cjs'),{QuotaService}=require('../quota.cjs');
  const api=new ApiSettings(sender,{protect,unprotect});api.save({baseUrl:'https://api.example.test/v1',model:'fixture',apiKey:'sender-only'});const [a]=api.saveProfile('API');
  const quota=new QuotaService({dataDir:sender,client:{},protect,unprotect});quota.save({selected:'proxy',proxy:{endpoint:'https://quota.example.test',credential:'manual',header:'Authorization',format:'remaining',valuePath:'data.balance',key:'quota-sender-only'}});const [q]=quota.saveProfile('Quota');
  fs.copyFileSync(api.file,path.join(recipient,'settings.json'));
  const otherApi=new ApiSettings(recipient,{protect,unprotect}),otherQuota=new QuotaService({dataDir:recipient,client:{},protect,unprotect});
  assert.equal(otherApi.loadProfile(a.id).baseUrl,'https://api.example.test/v1');assert.equal(otherApi.publicValue().configured,false);
  assert.equal(otherQuota.loadProfile(q.id).proxy.endpoint,'https://quota.example.test/');assert.equal(otherQuota.publicSettings().proxy.hasSecret,false);
  assert.equal(api.key(),'sender-only');
});
test('settings locate route selects only the unified file without returning its contents',async t=>{
  const dir=fixture(t);let located;
  const service=await require('../server.cjs').startServer({dataDir:dir,onSettingsLocate:file=>{located=file;}});t.after(()=>service.close());
  const info=await fetch(service.base+'/settings-file').then(r=>r.json());assert.equal(info.name,'settings.json');assert.equal(info.sections,undefined);
  await fetch(service.base+'/settings-file/locate',{method:'POST'});assert.equal(located,path.join(dir,'settings.json'));
  assert.equal(fs.existsSync(path.join(dir,'main-config.json')),false);
});
