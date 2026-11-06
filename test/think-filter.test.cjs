const test=require('node:test'),assert=require('node:assert/strict');
const {stripThink}=require('../think-filter.cjs'),{ApiClient}=require('../api-client.cjs');
const settings={key:()=> 'fixture-key',value:{baseUrl:'https://fixture.invalid/v1',model:'fixture'}};
const packet=text=>'data: '+JSON.stringify({choices:[{index:0,delta:{content:text}}]})+'\n\n';
const sse=chunks=>new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(Buffer.from(packet(chunk)));c.enqueue(Buffer.from('data: [DONE]\n\n'));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
test('inline reasoning is stripped from plain replies',()=>{
  assert.equal(stripThink('<think>（主人今天有点累）</think>今天也要开心哦'),'今天也要开心哦');
  assert.equal(stripThink('前言<thinking>内部推理</thinking>后语'),'前言后语');
  assert.equal(stripThink('<THINK>大写标签</THINK>正文'),'正文');
  assert.equal(stripThink('没有思考块，直接回复'),'没有思考块，直接回复');
  assert.equal(stripThink('<think>未闭合的思考只会被丢弃'),'');
  assert.equal(stripThink('<th'),'');
});
test('streamed reasoning never reaches the bubble, including tags split across chunks',async()=>{
  const updates=[];
  const client=new ApiClient(settings,{fetcher:async()=>sse(['<thi','nk>（内心戏）','</thi','nk>','今天','也要开心哦'])});
  assert.equal(await client.chat('fixture',{onText:text=>updates.push(text)}),'今天也要开心哦');
  assert.deepEqual(updates,['','','','','今天','今天也要开心哦']);
  assert.ok(!updates.some(text=>/内心戏|think/i.test(text)));
});
test('reasoning-only replies are reported as empty instead of shown',async()=>{
  const streamed=new ApiClient(settings,{fetcher:async()=>sse(['<think>只有思考，没有答案'])});
  await assert.rejects(streamed.chat('fixture',{onText(){}}),e=>e.code==='empty-reply');
  const plain=new ApiClient(settings,{fetcher:async()=>new Response(JSON.stringify({choices:[{message:{content:'<think>只有思考</think>'}}]}))});
  await assert.rejects(plain.chat('fixture'),e=>e.code==='empty-reply');
});
