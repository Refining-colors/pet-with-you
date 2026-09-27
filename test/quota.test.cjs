const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {QuotaService,validate}=require('../quota.cjs');
const {normalizeStats}=require('../crs.cjs');
const base={endpoint:'https://quota.example.test/balance',credential:'manual',header:'Authorization',bearer:true,format:'remaining',valuePath:'data.balance',totalPath:'',scale:1,unit:'USD',name:'Test'};
function service(fetcher){return new QuotaService({dataDir:fs.mkdtempSync(path.join(os.tmpdir(),'pet-quota-')),client:{},protect:s=>Buffer.from(s).toString('base64'),unprotect:s=>Buffer.from(s,'base64').toString(),fetcher});}
test('manual key stays out of public settings; only explicit endpoint receives it, cached without model calls',async()=>{
  let calls=0;const s=service(async(url,options)=>{calls++;assert.equal(url,base.endpoint);assert.equal(options.headers.Authorization,'Bearer fake-test-key');assert.equal(options.redirect,'error');return new Response(JSON.stringify({data:{balance:12.5}}));});
  const saved=s.save({selected:'proxy',proxy:{...base,key:'fake-test-key'}});
  assert.equal(saved.proxy.secret,undefined);assert.equal(saved.proxy.hasSecret,true);assert.equal(JSON.stringify(saved).includes('fake-test-key'),false);
  assert.equal((await s.queryProxy()).value,12.5);assert.equal((await s.queryProxy()).percent,undefined);assert.equal(calls,1);
  assert.throws(()=>s.save({selected:'proxy',proxy:{...base,endpoint:'https://other.example.test/balance'}}),/重新输入/);
});
test('HTML and bad numeric responses fail without leaking response or credentials',async()=>{
  const s=service(async()=>new Response('<html>private response</html>'));s.save({selected:'proxy',proxy:{...base,key:'fake-test-key'}});
  const q=await s.queryProxy();assert.equal(q.ok,false);assert.equal(q.message.includes('private response'),false);
  s.fetcher=async()=>new Response(JSON.stringify({data:{balance:null}}));assert.equal((await s.queryProxy()).ok,false);
  assert.throws(()=>validate({...base,endpoint:'http://example.test/balance'}),/HTTPS/);
  assert.throws(()=>validate({...base,endpoint:'https://example.test/balance?key=secret'}),/HTTPS/);
});
test('saved query fields and seven-character key preview persist; clear removes only query configuration',async()=>{
  const s=service(async()=>new Response(JSON.stringify({data:{balance:3}})));
  s.save({selected:'proxy',proxy:{...base,key:'preview-private-key'}});
  s.settings=JSON.parse(fs.readFileSync(s.file,'utf8'));
  const saved=s.publicSettings();assert.equal(saved.proxy.endpoint,base.endpoint);
  assert.equal(saved.proxy.keyPreview,'preview…');assert.ok(!JSON.stringify(saved).includes('private-key'));
  s.save({selected:'proxy',proxy:{...base,name:'Renamed'}});
  assert.equal(s.publicSettings().proxy.keyPreview,'preview…');
  assert.equal(s.clear().proxy,null);assert.equal(JSON.parse(fs.readFileSync(s.file,'utf8')).proxy,null);
  assert.equal((await s.queryProxy()).reason,'credential-missing');
});
test('clearing during a pending query cannot restore stale quota cache',async()=>{
  let release;const s=service(()=>new Promise(resolve=>{release=()=>resolve(new Response(JSON.stringify({data:{balance:3}})));}));
  s.save({selected:'proxy',proxy:{...base,key:'fake-test-key'}});
  const pending=s.queryProxy();await new Promise(r=>setImmediate(r));s.clear();release();await pending;
  assert.equal(s.cache,null);assert.equal((await s.queryProxy()).reason,'credential-missing');
});
test('query profiles restore encrypted keys and fields, while clear and delete remain independent',async()=>{
  const s=service(async()=>new Response(JSON.stringify({data:{balance:3}})));
  s.save({selected:'proxy',proxy:{...base,key:'profile-secret-test',totalPath:'data.total'}});
  const [entry]=s.saveProfile('Daily');s.saveProfile('Daily');assert.equal(s.profiles().length,1);
  assert.ok(!JSON.stringify(s.profiles()).includes('secret'));assert.ok(!fs.readFileSync(s.file+'.profiles','utf8').includes('profile-secret-test'));
  s.select('account');assert.equal(s.publicSettings().proxy.endpoint,base.endpoint);
  s.clear();assert.equal(s.profiles().length,1);
  s.loadProfile(entry.id);assert.equal(s.settings.selected,'proxy');assert.equal(await s.key(s.settings.proxy),'profile-secret-test');assert.equal(s.settings.proxy.totalPath,'data.total');
  s.deleteProfile(entry.id);assert.deepEqual(s.profiles(),[]);assert.equal(s.publicSettings().proxy.keyPreview,'profile…');
  assert.throws(()=>s.loadProfile(entry.id),/找不到/);
});
test('provider credential selection is independent of ChatGPT account login',async()=>{
  const s=service(async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer env-test-key');return new Response(JSON.stringify({data:{balance:25,total:100}}));});
  process.env.PET_TEST_QUOTA_KEY='env-test-key';
  s.client={start:async()=>{},request:async()=>({config:{model_provider:'proxy',model_providers:{proxy:{env_key:'PET_TEST_QUOTA_KEY',requires_openai_auth:true}}}})};
  try{s.save({selected:'proxy',proxy:{...base,credential:'provider',totalPath:'data.total'}});const q=await s.queryProxy();assert.equal(q.percent,75);}finally{delete process.env.PET_TEST_QUOTA_KEY;}
});
test('repeated connect preserves exact hook definitions and other handlers',()=>{
  const {installHooks}=require('../install-hooks.cjs');const previous=process.env.CODEX_HOME;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-hooks-'));process.env.CODEX_HOME=dir;
  const target=path.join(dir,'hooks.json');fs.writeFileSync(target,JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command:'other-command'}]}]}}));
  try{installHooks();const before=fs.readFileSync(target,'utf8');installHooks();assert.equal(fs.readFileSync(target,'utf8'),before);assert.ok(before.includes('other-command'));}finally{if(previous===undefined)delete process.env.CODEX_HOME;else process.env.CODEX_HOME=previous;}
});
test('CRS stats normalize into compact monitoring rows without fabricating total quota',()=>{
  const q=normalizeStats({limits:{currentDailyCost:2.5,dailyCostLimit:10,currentTotalCost:4},usage:{total:{requests:12,allTokens:345}}},'CRS');
  assert.equal(q.percent,25);assert.deepEqual(q.rows,['今日 $2.5000 / $10.0000','累计 $4.0000（未设总限额）','请求 12 · Token 345']);
});
