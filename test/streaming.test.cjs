const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {ApiClient}=require('../api-client.cjs'),{CodexClient}=require('../codex-client.cjs'),{startServer}=require('../server.cjs');
const settings={key:()=> 'fixture-key',value:{baseUrl:'https://fixture.invalid/v1',model:'fixture'}};
const packet=text=>'data: '+JSON.stringify({choices:[{index:0,delta:{content:text}}]})+'\r\n\r\n';
test('API delivers text before completion, handles split UTF-8 and keeps JSON compatibility',async()=>{
  let controller,calls=0;const updates=[];
  const client=new ApiClient(settings,{fetcher:async(_url,options)=>{
    calls++;assert.equal(JSON.parse(options.body).stream,true);
    return new Response(new ReadableStream({start(c){controller=c;}}),{headers:{'Content-Type':'text/event-stream'}});
  }});
  let first;const appeared=new Promise(r=>first=r);
  const pending=client.chat('fixture',{onText:text=>{updates.push(text);first();}});
  await new Promise(r=>setImmediate(r));
  const bytes=Buffer.from(packet('你好'));for(const b of bytes)controller.enqueue(Uint8Array.of(b));
  await appeared;assert.deepEqual(updates,['你好']);assert.equal(calls,1);
  controller.enqueue(Buffer.from(packet('呀~')+'data: [DONE]\n\n'));controller.close();
  assert.equal(await pending,'你好呀~');assert.deepEqual(updates,['你好','你好呀~']);
  const compatible=new ApiClient(settings,{fetcher:async()=>new Response(JSON.stringify({choices:[{message:{content:'whole reply'}}]}))});
  assert.equal(await compatible.chat('fixture',{onText(){}}),'whole reply');
});
test('stream errors and truncation are reported safely and never retried',async()=>{
  for(const body of [packet('partial'),'data: {"error":{"message":"private-provider-error"}}\n\n']){
    let calls=0;const client=new ApiClient(settings,{fetcher:async()=>{calls++;return new Response(body,{headers:{'content-type':'text/event-stream'}});}});
    await assert.rejects(client.chat('fixture',{onText(){}}),e=>e.code==='upstream'&&!e.message.includes('private-provider'));
    assert.equal(calls,1);
  }
});
test('Codex forwards only agent message text from its own thread',async()=>{
  const c=new CodexClient('.');c.start=async()=>{};let started;
  const ready=new Promise(r=>started=r);
  c.request=async method=>method==='thread/start'?{thread:{id:'mine'}}:method==='turn/start'?(started(),{turn:{id:'turn'}}):{};
  const updates=[];const answer=c.chat('fixture',{onText:text=>updates.push(text)});await ready;
  c.emit('notification',{method:'item/agentMessage/delta',params:{threadId:'other',itemId:'a',delta:'private-other-thread'}});
  c.emit('notification',{method:'item/reasoning/textDelta',params:{threadId:'mine',delta:'private-reasoning'}});
  c.emit('notification',{method:'item/agentMessage/delta',params:{threadId:'mine',itemId:'a',delta:'你好'}});
  assert.deepEqual(updates,['你好']);
  c.emit('notification',{method:'item/completed',params:{threadId:'mine',item:{type:'agentMessage',text:'你好呀~'}}});
  c.emit('notification',{method:'turn/completed',params:{threadId:'mine',turn:{status:'completed'}}});
  assert.equal(await answer,'你好呀~');assert.equal(c.listenerCount('notification'),0);
});
test('whisper endpoint flushes early text and preserves mode-change protection',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-stream-'));const service=await startServer({dataDir:dir,defaultMode:'connected'});
  t.after(()=>{service.close();fs.rmSync(dir,{recursive:true,force:true});});
  await fetch(service.base+'/preferences',{method:'PUT',body:JSON.stringify({chatSourceChosen:true})});
  let finish;
  service.client.chat=async(_prompt,{onText})=>{onText('提前正文');return new Promise(r=>finish=r);};
  const response=await fetch(service.base+'/whisper/trigger?stream=1');const reader=response.body.getReader();
  const early=JSON.parse(new TextDecoder().decode((await reader.read()).value).trim());
  assert.deepEqual(early,{type:'text',text:'提前正文'});
  await fetch(service.base+'/preferences',{method:'PUT',body:JSON.stringify({mode:'pet'})});finish('不应显示的旧回复');
  let rest='';while(true){const r=await reader.read();if(r.done)break;rest+=new TextDecoder().decode(r.value);}
  const last=JSON.parse(rest.trim());assert.equal(last.type,'done');assert.equal(last.ok,false);assert.ok(!rest.includes('不应显示的旧回复'));
});
test('desktop stream reader emits partial text but requires a final result',async()=>{
  const context={window:{},TextDecoder};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/whisper-stream.js'),'utf8'),context);
  const read=context.window.PetWhisperStream.read,updates=[];
  const header={headers:{'content-type':'application/x-ndjson'}};
  const body=JSON.stringify({type:'text',text:'你好'})+'\n'+JSON.stringify({type:'done',ok:true,text:'你好呀'})+'\n';
  const result=await read(new Response(body,header),text=>updates.push(text));assert.equal(result.text,'你好呀');assert.deepEqual(updates,['你好']);
  await assert.rejects(read(new Response('{"type":"text","text":"half"}\n',header),()=>{}),e=>e.name==='PetStreamError');
});
