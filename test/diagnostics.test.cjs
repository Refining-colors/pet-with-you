const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {Diagnostics,issue}=require('../diagnostics.cjs');
const {ApiClient}=require('../api-client.cjs');
const {startServer}=require('../server.cjs');
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-diagnostics-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
const settings={key:()=> 'private-key-fixture',value:{baseUrl:'https://fixture.invalid/v1',model:'fixture-model'}};
test('API classifies model, HTTP, DNS, timeout, malformed and oversized errors without returning provider text',async()=>{
  for(const [status,body,expected] of [
    [404,{error:{code:'model_not_found',message:'private-key-fixture private-prompt'}},'model-not-found'],
    [400,{error:{message:'The model fixture-model does not exist. private-key-fixture'}},'model-not-found'],
    [404,{},'endpoint'],[401,{},'authentication'],[403,{},'permission'],[429,{},'rate-limit'],[503,{},'upstream'],[400,{},'bad-request'],[200,{},'empty-reply']
  ]){
    const client=new ApiClient(settings,{fetcher:async()=>new Response(JSON.stringify(body),{status})});
    await assert.rejects(client.chat('private-prompt'),e=>e.code===expected&&!e.message.includes('private-'));
  }
  for(const [error,code] of [[Object.assign(new Error('private-key-fixture'),{cause:{code:'ENOTFOUND'}}),'dns'],[Object.assign(new Error(),{name:'TimeoutError'}),'timeout'],[Object.assign(new Error(),{cause:{code:'ECONNREFUSED'}}),'refused']]){
    await assert.rejects(new ApiClient(settings,{fetcher:async()=>{throw error;}}).chat('private-prompt'),e=>e.code===code);
  }
  await assert.rejects(new ApiClient(settings,{fetcher:async()=>new Response('<html>private-key-fixture</html>')}).chat('private-prompt'),e=>e.code==='invalid-json');
  await assert.rejects(new ApiClient(settings,{fetcher:async()=>new Response('x'.repeat(1048577))}).chat('private-prompt'),e=>e.code==='response-large');
});
test('diagnostics rotates, deduplicates, persists, exports only safe fields and clears',t=>{
  const dir=temp(t),logs=new Diagnostics(dir,{maxBytes:650});
  const first=logs.record('chat-api',Object.assign(issue('model-not-found',404),{message:'private-key-fixture',url:'https://secret.invalid/token',prompt:'private-prompt'}));
  assert.equal(logs.record('chat-api',issue('model-not-found',404)).id,first.id);
  for(const code of ['authentication','permission','timeout','network','dns','upstream','empty-reply'])logs.record('chat-api',issue(code));
  const files=fs.readdirSync(logs.dir);assert.ok(files.length<=3);assert.ok(files.includes('errors.2.jsonl'));
  const reopened=new Diagnostics(dir);assert.ok(reopened.summary().count>0);
  reopened.record('settings',new Error('private-key-fixture private-prompt'));
  const exported=reopened.exportText();assert.ok(!/private-key|private-prompt|secret.invalid/.test(exported));
  assert.equal(JSON.parse(exported).errors.at(-1).code,'operation-failed');
  assert.equal(reopened.clear().count,0);assert.equal(fs.readdirSync(logs.dir).length,0);
});
test('log disk failures are explicit and do not suppress a retry',t=>{
  const dir=temp(t);fs.writeFileSync(path.join(dir,'logs'),'blocked');const logs=new Diagnostics(dir);
  assert.equal(logs.record('chat-api',issue('timeout')).persisted,false);
  assert.equal(logs.writeFailed,true);fs.unlinkSync(path.join(dir,'logs'));
  assert.equal(logs.record('chat-api',issue('timeout')).persisted,true);assert.equal(logs.writeFailed,false);
});
test('chat, whisper, quota and configuration failures have IDs; log routes export and clear only diagnostics',async t=>{
  const dir=temp(t);let exported,opened;
  const upstream=http.createServer((req,res)=>{res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'model_not_found',message:'private-key-fixture private-prompt'}}));});
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));t.after(()=>upstream.close());
  const service=await startServer({dataDir:dir,protect:v=>'encrypted:'+v,unprotect:v=>v.slice(10),onLogsOpen:async v=>{opened=v;},onLogsExport:async v=>{exported=v;return {ok:true};}});t.after(()=>service.close());
  const req=async(route,method='GET',body)=>{const res=await fetch(service.base+route,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return res.json();};
  await req('/api/settings','PUT',{baseUrl:'http://127.0.0.1:'+upstream.address().port+'/v1',model:'fixture',apiKey:'private-key-fixture'});
  for(const route of ['/chat','/whisper/trigger']){const result=await req(route,'POST',{text:'private-prompt'});assert.equal(result.ok,false);assert.match(result.errorId,/^[0-9a-f]{8}$/);assert.match(result.message,/找不到模型/);}
  const quota=await req('/quota/query?source=proxy');assert.ok(quota.errorId);
  const invalid=await req('/api/settings','PUT',{baseUrl:'no url',model:''});assert.ok(invalid.errorId);
  const summary=await req('/logs');assert.equal(summary.count,4);
  await req('/logs/open','POST');assert.equal(opened,path.join(dir,'logs'));
  await req('/logs/export','POST');assert.equal(JSON.parse(exported).errors.length,4);assert.ok(!/private-key|private-prompt/.test(exported));
  const before=fs.readFileSync(path.join(dir,'api-settings.json'),'utf8');
  assert.equal((await req('/logs','DELETE')).count,0);assert.equal(fs.readFileSync(path.join(dir,'api-settings.json'),'utf8'),before);
});
