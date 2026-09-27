const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {WhisperHistory}=require('../whisper-history.cjs'),{startServer}=require('../server.cjs');
test('session whisper history deduplicates punctuation, separates pets and bounds prompt context',()=>{
  const h=new WhisperHistory();assert.equal(h.add('a','今天也要开心哦~'),true);
  assert.equal(h.add('a','今天也要开心哦～！'),false);
  assert.equal(h.isPriorPrefix('a','今天也要'),true);assert.equal(h.isPriorPrefix('a','今天想画画'),false);
  assert.equal(h.add('b','今天也要开心哦~'),true);assert.equal(h.list('a').length,1);
  for(let i=0;i<30;i++)h.add('a','第'+i+'个新话题');
  assert.equal(h.list('a').length,31);assert.ok(!h.context('a').includes('第0个新话题'));assert.ok(h.context('a').includes('第29个新话题'));
  assert.equal(new WhisperHistory().list('a').length,0);
});
test('whispers remember earlier replies across mode changes and suppress repeated stream output',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-history-'));
  let service=await startServer({dataDir:dir,defaultMode:'connected'});
  t.after(()=>{service.close();fs.rmSync(dir,{recursive:true,force:true});});
  const pref=async value=>fetch(service.base+'/preferences',{method:'PUT',body:JSON.stringify(value)});
  await pref({chatSourceChosen:true});let calls=0;
  service.client.chat=async(prompt,{onText})=>{
    calls++;if(calls>1)assert.ok(prompt.includes('第一次的话题'));
    const result=calls===1?'第一次的话题~':calls===2?'第一次的话题～！':'新的话题';onText?.(result);return result;
  };
  const first=await(await fetch(service.base+'/whisper/trigger')).json();assert.equal(first.text,'第一次的话题~');
  await pref({mode:'pet'});await pref({mode:'connected'});
  const stream=await(await fetch(service.base+'/whisper/trigger?stream=1')).text();
  const events=stream.trim().split('\n').map(JSON.parse);assert.equal(events.length,1);assert.equal(events[0].repeated,true);assert.equal(calls,2);
  await fetch(service.base+'/whisper/trigger');
  const history=await(await fetch(service.base+'/whisper/history')).json();assert.deepEqual(history.map(r=>r.text),['第一次的话题~','新的话题']);
  assert.equal(fs.readdirSync(dir).some(f=>/history|memory/.test(f)),false);
  service.close();service=await startServer({dataDir:dir});
  assert.deepEqual(await(await fetch(service.base+'/whisper/history')).json(),[]);
});
