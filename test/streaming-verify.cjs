const assert=require('node:assert/strict');
module.exports=async({pet,settings,service})=>{
  const result=await pet.webContents.executeJavaScript(`(async()=>{
    const s=sprites[0];s.closeReply();s.workOn=false;s.workState=null;s.workNative=null;s.errorNotice='';s.explicitQuota=false;s.bubbleOn=false;s.manualPlaying=false;s.deferredWork=null;s.pet.workStatusEnabled=false;
    window.petPreferences.whisperStreaming=true;
    const original=window.fetch;let controller;
    window.fetch=(url,...rest)=>String(url).includes('/whisper/trigger')?Promise.resolve(new Response(new ReadableStream({start(c){controller=c;}}),{headers:{'content-type':'application/x-ndjson'}})):original(url,...rest);
    try{
      const generating=s.showWhisperFromMenu();await new Promise(r=>setTimeout(r,0));
      controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'text',text:'正文已经开始'})+'\\n'));await new Promise(r=>setTimeout(r,0));
      const early=s.bubble.querySelector('.reply-content').textContent==='正文已经开始'&&!s.whisperOn&&!!s.whisperRequest;
      s.bubble.querySelector('.reply-close').click();
      controller.enqueue(new TextEncoder().encode(JSON.stringify({type:'text',text:'关闭后不可复活'})+'\\n'+JSON.stringify({type:'done',ok:true,text:'最终回复'})+'\\n'));controller.close();await generating;
      return {early,closed:!s.whisperOn&&!s.bubble.classList.contains('is-on')};
    }finally{window.fetch=original;}
  })()`);
  assert.deepEqual(result,{early:true,closed:true});
  const synced=await settings.webContents.executeJavaScript(`(async()=>{
    const input=document.querySelector('#apiAutoWhisperPets input');input.checked=true;input.onchange();
    const toggle=document.querySelector('#autoWhisperPets input').checked;
    const interval=document.querySelector('#apiWhisperInterval');interval.value='180';interval.oninput();
    const probability=document.querySelector('#apiWhisperProbability');probability.value='0';probability.oninput();
    const values=document.querySelector('#interval').value==='180'&&document.querySelector('#autoWhisperProbability').value==='0';
    await document.querySelector('#saveApiAutoWhisper').onclick();return {toggle,values};
  })()`);
  assert.deepEqual(synced,{toggle:true,values:true});
  const config=await(await fetch(service.base+'/config')).json();assert.equal(config.main.eventsRefreshSec.whisper,180);assert.equal(config.main.pets[0].whisperEnabled,true);
  await settings.webContents.executeJavaScript(`(async()=>{const input=document.querySelector('#apiAutoWhisperPets input');input.checked=false;input.onchange();await document.querySelector('#saveApiAutoWhisper').onclick();})()`);
  await new Promise(r=>setTimeout(r,900));
};
