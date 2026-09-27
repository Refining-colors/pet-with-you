const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({settings,service,pet,dir})=>{
  await settings.webContents.executeJavaScript(`(async()=>{await loadAppearance();document.querySelector('#feedbackFont').value='SimSun';await document.querySelector('#saveFeedbackFont').onclick();})()`);
  assert.equal((await(await fetch(service.base+'/appearance')).json()).feedback.family,'SimSun');
  const result=await pet.webContents.executeJavaScript(`(async()=>{
    await refreshAppearance();
    const s=sprites[0];s.stopMove();s.stopThrow();s.manualPlaying=false;s.closeMenu();s.closeReply();
    s.workOn=false;s.workNative=null;s.workState=null;s.deferredWork=null;s.latestWorkSnapshot={state:null};s.pet.workStatusEnabled=false;s.errorNotice='';s.explicitQuota=false;s.bubbleOn=false;s.chatOpen=false;s.bubbleHover=false;s.bubbleSelecting=false;
    window.petPreferences.replyMode='permanent';window.petPreferences.chatReady=true;
    const original=window.fetch,oldEnabled=s.pet.whisperEnabled;let requests=0,release;
    window.fetch=(url,...rest)=>String(url).includes('/whisper/trigger')?(requests++,new Promise(r=>{release=()=>r({ok:true,json:async()=>({ok:true,text:'今天也要开心哦~'})});})):original(url,...rest);
    try{
      const first=s.showWhisperFromMenu();const immediate=s.bubble.textContent.includes('碎碎念中……')&&!!s.bubble.querySelector('.reply-card');
      await s.showWhisperFromMenu();const dedup=requests===1;
      s.bubble.querySelector('.reply-close').click();release();await first;const dismissed=!s.whisperOn&&!s.bubble.textContent.includes('今天也要开心哦');
      s.pet.whisperEnabled=true;window.petPreferences.autoWhisperProbability=0;await s.autoWhisperTick();const zero=requests===1;
      window.petPreferences.autoWhisperProbability=100;s.workOn=true;await s.autoWhisperTick();s.workOn=false;const busy=requests===1;
      s.showWhisper('正在阅读的回复');s.manualPlaying=false;await s.autoWhisperTick();const reading=requests===1;s.closeReply();
      const auto=s.autoWhisperTick();const triggered=requests===2;release();await auto;const displayed=s.whisperView?.[0]?.text==='今天也要开心哦~';
      const font=getComputedStyle(s.bubble.querySelector('.reply-content')).fontFamily.includes('SimSun');
      s.closeReply();s.manualPlaying=false;
      const next=s.showWhisperFromMenu();s.whisperOn=true;s.whisperView=[{text:'更新的聊天回复'}];s.workOn=true;release();await next;
      const taskPriority=s.workOn&&!s.bubble.querySelector('.reply-card');s.workOn=false;s.workNative=null;s.workText=null;
      s.showWhisper('今天也要开心哦~');await s.replyWrite;
      return {immediate,dedup,dismissed,zero,busy,reading,triggered,displayed,font,taskPriority};
    }finally{window.fetch=original;s.pet.whisperEnabled=oldEnabled;}
  })()`);
  for(const [key,value] of Object.entries(result))assert.equal(value,true,key);
  pet.showInactive();pet.webContents.invalidate();
  await new Promise(r=>setTimeout(r,600));
  assert.equal(await pet.webContents.executeJavaScript(`!!sprites[0].bubble.querySelector('.reply-card')`),true);
  fs.writeFileSync(path.join(dir,'whisper-card.png'),(await pet.webContents.capturePage()).toPNG());
  await settings.webContents.executeJavaScript(`document.querySelector('#autoWhisperSection').scrollIntoView()`);
  await new Promise(r=>setTimeout(r,150));
  fs.writeFileSync(path.join(dir,'whisper-settings.png'),(await settings.webContents.capturePage()).toPNG());
  await settings.webContents.executeJavaScript(`(async()=>{document.querySelector('#interval').value='120';document.querySelector('#autoWhisperProbability').value='0';const enabled=document.querySelector('#autoWhisperPets input');enabled.checked=true;enabled.onchange();await document.querySelector('#saveAutoWhisper').onclick();})()`);
  const config=await(await fetch(service.base+'/config')).json();
  assert.equal(config.main.eventsRefreshSec.whisper,120);assert.equal(config.main.pets[0].whisperEnabled,true);
  assert.equal(service.preferences.value.autoWhisperProbability,0);
  await settings.webContents.executeJavaScript(`(async()=>{const enabled=document.querySelector('#autoWhisperPets input');enabled.checked=false;enabled.onchange();await document.querySelector('#saveAutoWhisper').onclick();})()`);
  await new Promise(r=>setTimeout(r,900));
};
