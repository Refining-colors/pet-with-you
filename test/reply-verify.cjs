const assert=require('node:assert/strict');
module.exports=async function(win){
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const s=sprites[0];s.stopMove();s.stopThrow();s.closeMenu();s.manualPlaying=false;s.explicitQuota=false;s.workOn=false;s.workState=null;s.pet.workStatusEnabled=true;
    window.petPreferences.replyMode='permanent';s.showWhisper('可以复制哦~');
    const content=s.bubble.querySelector('.reply-content');const shortFits=content.scrollHeight<=content.clientHeight&&content.scrollWidth<=content.clientWidth;
    const tone=content.querySelector('.tone-mark')?.textContent==='~';
    const noCopyButton=s.bubble.querySelectorAll('button').length===1&&s.bubble.querySelector('button').className==='reply-close';
    const range=document.createRange();range.selectNodeContents(content);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);const selectable=selection.toString()==='可以复制哦~';selection.removeAllRanges();
    const card=s.bubble.querySelector('.reply-card'),close=s.bubble.querySelector('.reply-close');const cr=card.getBoundingClientRect(),xr=close.getBoundingClientRect();const corner=xr.top>=cr.top&&xr.top<cr.top+10&&xr.right<=cr.right&&xr.right>cr.right-10;
    const bounds=s.bubble.getBoundingClientRect();s.onMouseMove({clientX:bounds.left+3,clientY:bounds.top+3});const interactive=s._interactive===true;
    s.bubbleHover=false;s.bubbleSelecting=false;s.syncInputBusy();
    s.onWorkTick({state:'working',task:'实时任务反馈'},80001);
    const taskVisible=s.bubble.textContent.includes('实时任务反馈')&&!s.bubble.textContent.includes('可以复制哦~');
    s.onWorkTick({state:null},80002);
    const restored=s.bubble.textContent.includes('可以复制哦~');
    window.petPreferences.replyMode='next';s.showWhisper('next reply');s.onWorkTick({state:'waiting',task:'等待确认'},80003);s.onWorkTick({state:null},80004);
    const nextDismissed=!s.whisperOn&&!s.bubble.textContent.includes('next reply');
    window.petPreferences.replyMode='timed';window.petPreferences.replySeconds=1;s.showWhisper('timed reply');
    await new Promise(r=>setTimeout(r,1250));const timedOut=!s.whisperOn;
    window.petPreferences.replyMode='permanent';s.showWhisper('newest reply');s.bubble.querySelector('.reply-close').click();const closed=!s.whisperOn;
    const source='你好~ 好呀～ 来呀〜 0~1 https://example.com/~user ~/path <b>你好</b>\\n'+String.fromCharCode(96)+'你好~'+String.fromCharCode(96)+'\\n~~~\\n你好~\\n~~~';
    const sample=document.createElement('div');window.PetBubbleText.set(sample,source);
    const exact=sample.textContent===source&&sample.querySelectorAll('.tone-mark').length===3&&!sample.querySelector('b');
    s.pet.workStatusEnabled=false;await s.replyWrite;return {noCopyButton,selectable,corner,interactive,taskVisible,restored,nextDismissed,timedOut,closed,shortFits,tone,exact};
  })()`);
  for(const [name,value] of Object.entries(result))assert.equal(value,true,name);
};
