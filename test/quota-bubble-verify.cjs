const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({pet,settings,service,dir})=>{
  await settings.webContents.executeJavaScript(`(async()=>{document.querySelector('#quotaMode').value='permanent';document.querySelector('#quotaSeconds').value='25';await document.querySelector('#saveQuotaBubble').onclick();})()`);
  assert.equal(service.preferences.value.quotaMode,'permanent');assert.equal(service.preferences.value.quotaSeconds,25);
  const result=await pet.webContents.executeJavaScript(`(async()=>{
    const s=sprites[0];s.stopMove();s.stopThrow();s.workOn=false;s.workState=null;s.workNative=null;s.workText=null;s.deferredWork=null;s.pet.workStatusEnabled=false;s.manualPlaying=false;s.errorNotice='';s.closeReply();s.closeQuota();s.bubbleHover=false;s.bubbleSelecting=false;
    window.petPreferences.replyMode='permanent';
    s.showWhisper('关闭不闪变');s.bubble.querySelector('.reply-close').click();
    const noFlash=s.bubble.hidden&&getComputedStyle(s.bubble).display==='none'&&s.bubble.getBoundingClientRect().width===0;
    const original=S.fetchBalanceState;let release;
    const state={ok:true,provider:'测试额度',kind:'proxy',format:'monitor',rows:['余额 12.50 元']};
    S.fetchBalanceState=()=>new Promise(r=>release=r);
    try{
      const query=s.showBalanceFromMenu();const canClose=!!s.bubble.querySelector('.quota-close')&&s.bubble.classList.contains('can-copy');
      const loadingNoTimer=s.bubbleTimer===null;s.bubble.querySelector('.quota-close').click();
      const closed=s.bubble.hidden&&!s.explicitQuota;release(state);await query;
      const staysClosed=s.bubble.hidden&&!s.bubbleOn;
      window.petPreferences.quotaMode='timed';window.petPreferences.quotaSeconds=1;
      S.fetchBalanceState=async()=>state;await s.showBalanceFromMenu();
      const successContent=s.bubble.textContent.includes('余额 12.50 元')&&!s.bubble.textContent.includes('查询未完成');
      const timedStarted=s.bubbleTimer!==null;s.bubbleHover=true;s.updateQuotaTimer();const paused=s.bubbleTimer===null;
      s.bubbleHover=false;s.updateQuotaTimer();await new Promise(r=>setTimeout(r,1150));const expired=s.bubble.hidden&&!s.explicitQuota;
      window.petPreferences.quotaMode='permanent';await s.showBalanceFromMenu();const permanent=s.bubbleTimer===null&&!s.bubble.hidden;
      return {noFlash,canClose,loadingNoTimer,closed,staysClosed,successContent,timedStarted,paused,expired,permanent};
    }finally{S.fetchBalanceState=original;}
  })()`);
  for(const [key,value] of Object.entries(result))assert.equal(value,true,key);
  pet.showInactive();pet.webContents.invalidate();await new Promise(r=>setTimeout(r,300));
  fs.writeFileSync(path.join(dir,'quota-bubble.png'),(await pet.webContents.capturePage()).toPNG());
  const layout=await pet.webContents.executeJavaScript(`(()=>{
    const s=sprites[0],results=[];s.bubbleHover=true;
    for(const size of [180,462,900]){
      s.bubble.style.setProperty('--pet-size',size+'px');
      s.balanceView=[{role:'label',text:'测试额度'},{role:'sub',text:'余额 12.50 元'}];s.renderBubble();
      const content=s.bubble.querySelector('.quota-content'),card=s.bubble.querySelector('.quota-card');
      const noScroll=content.scrollHeight<=content.clientHeight&&content.scrollWidth<=content.clientWidth;
      const close=s.bubble.querySelector('.quota-close').getBoundingClientRect(),bounds=card.getBoundingClientRect();
      const buttonInside=close.right<=bounds.right&&close.top>=bounds.top&&close.left>=bounds.left;
      const font=parseFloat(getComputedStyle(content).fontSize),width=s.bubble.clientWidth;
      s.balanceView=[{role:'sub',text:'很长的查询响应文字'.repeat(400)}];s.renderBubble();
      const long=s.bubble.querySelector('.quota-content');long.scrollTop=10000;
      results.push({size,noScroll,buttonInside,font,width,scroll:long.scrollHeight>long.clientHeight&&long.scrollTop>0,noHorizontal:long.scrollWidth<=long.clientWidth});
    }
    s.bubble.style.removeProperty('--pet-size');s.bubbleHover=false;return results;
  })()`);
  for(const result of layout){for(const key of ['noScroll','buttonInside','scroll','noHorizontal'])assert.equal(result[key],true,key+' at '+result.size);assert.ok(result.font>=11&&result.font<=16);assert.ok(result.width>=180&&result.width<=400);}
  const grouped=await settings.webContents.executeJavaScript(`(()=>{const group=document.querySelector('#apiWhisperSettings');group.scrollIntoView();return ['whisperStreaming','apiAutoWhisperPets','whisperHistoryPet'].every(id=>group.contains(document.getElementById(id)))&&!group.contains(document.querySelector('#apiBaseUrl'));})()`);
  assert.equal(grouped,true);await new Promise(r=>setTimeout(r,150));
  fs.writeFileSync(path.join(dir,'whisper-grouped.png'),(await settings.webContents.capturePage()).toPNG());
  await pet.webContents.executeJavaScript(`sprites[0].closeQuota()`);
  const automatic=await pet.webContents.executeJavaScript(`(async()=>{
    const s=sprites[0],original=S.fetchBalanceState,preferences={...window.petPreferences};
    window.petPreferences.mode='connected';window.petPreferences.quotaAfterTurn=true;s.pet.balanceEnabled=true;s.roundQuotaSeen=undefined;s.manualPlaying=false;s.bubbleHover=false;s.bubbleSelecting=false;
    let queries=0;S.fetchBalanceState=async()=>{queries++;return {ok:true,provider:'自动查询',kind:'proxy',format:'monitor',rows:['本回合结束后更新']};};
    try{
      s.processRoundQuota({completedTurns:1000,activeCount:0});const noReplay=queries===0;
      s.processRoundQuota({completedTurns:1001,activeCount:1});await s.roundQuotaPromise;
      s.processRoundQuota({completedTurns:1001,activeCount:1});const deferred=!s.explicitQuota&&queries===1;
      s.processRoundQuota({completedTurns:1001,activeCount:0});const shown=!!s.bubble.querySelector('.quota-card')&&s.autoQuotaVisible&&s.bubble.textContent.includes('本回合结束后更新');
      s.onWorkTick({state:'thinking',activeCount:1,completedTurns:1001},100001);const taskWins=!s.explicitQuota&&!s.autoQuotaVisible;
      return {noReplay,deferred,shown,taskWins};
    }finally{S.fetchBalanceState=original;window.petPreferences=preferences;s.closeQuota();s.roundQuotaSeen=undefined;}
  })()`);
  for(const [key,value] of Object.entries(automatic))assert.equal(value,true,key);
  const accountFixture={ok:true,provider:'Codex',kind:'codex',windows:[{percent:23,minutes:300,resetsAt:'2026-09-27T15:00:00Z'},{percent:48,minutes:10080,resetsAt:'2026-10-01T00:00:00Z'}],queriedAt:Date.parse('2026-09-27T10:00:00Z'),availableResetCount:2};
  const accountLayout=await pet.webContents.executeJavaScript(`(()=>{
    const s=sprites[0];s.workOn=false;s.closeReply();s.explicitQuota=true;s.showBalanceNow(${JSON.stringify(accountFixture)});
    const content=s.bubble.querySelector('.quota-content');return {text:content.textContent,noScroll:content.scrollHeight<=content.clientHeight,noHorizontal:content.scrollWidth<=content.clientWidth,card:!!s.bubble.querySelector('.codex-quota')};
  })()`);
  assert.match(accountLayout.text,/5 小时.*1 周.*可用重置次数：2 次.*更新时间：/);assert.equal(accountLayout.card,true);assert.equal(accountLayout.noScroll,true);assert.equal(accountLayout.noHorizontal,true);
  await new Promise(r=>setTimeout(r,150));fs.writeFileSync(path.join(dir,'codex-quota.png'),(await pet.webContents.capturePage()).toPNG());
  const settingsLayout=await settings.webContents.executeJavaScript(`(async()=>{
    const oldFetch=window.fetch;window.fetch=async(url,options)=>String(url).includes('/quota/query?source=account')?{ok:true,json:async()=>(${JSON.stringify(accountFixture)})}:oldFetch(url,options);
    try{await queryQuota('account');return {text:document.querySelector('#accountResult').textContent,gpt:document.querySelector('#gptPanel').contains(document.querySelector('#quotaBubbleSection')),separate:!document.querySelector('#replySection').contains(document.querySelector('#quotaMode')),sortable:!!document.querySelector('#quotaBubbleSection .module-handle')};}finally{window.fetch=oldFetch;}
  })()`);
  assert.match(settingsLayout.text,/5 小时[\s\S]*1 周[\s\S]*可用重置次数：2 次[\s\S]*更新时间：/);
  for(const key of ['gpt','separate','sortable'])assert.equal(settingsLayout[key],true,key);
  await pet.webContents.executeJavaScript('sprites[0].closeQuota()');
};
