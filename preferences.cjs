const fs=require('node:fs');
const path=require('node:path');
const defaults={disableEventResponse:false,quotaAfterTurn:false,quotaMode:'timed',quotaSeconds:10,whisperStreaming:true,autoWhisperProbability:50,ignoreAccountTimeouts:true,taskBasicFeedback:true,taskNativeFeedback:true,disableRoaming:false,mode:'pet',alwaysOnTop:true,fullscreenMode:'except-gpt',clickAction:'animation',actionSpeed:1.25,autostart:false,followClientStart:false,followClientClose:false,snapMode:'all',chatSource:'gpt',chatSourceChosen:false,replyMode:'timed',replySeconds:10,moduleOrder:{basic:[],gpt:[]}};
function validatePreferences(raw){
  if(typeof raw.quotaAfterTurn!=='boolean')throw new Error('回合结束自动查询设置无效');
  if(!['timed','permanent'].includes(raw.quotaMode)||!Number.isFinite(raw.quotaSeconds)||raw.quotaSeconds<1||raw.quotaSeconds>3600)throw new Error('额度气泡停留设置无效');
  if(typeof raw.whisperStreaming!=='boolean')throw new Error('流式显示设置无效');
  if(!Number.isFinite(raw.autoWhisperProbability)||raw.autoWhisperProbability<0||raw.autoWhisperProbability>100)throw new Error('自动碎碎念概率必须在 0 到 100 之间');
  for(const key of ['disableEventResponse','ignoreAccountTimeouts','taskBasicFeedback','taskNativeFeedback'])if(typeof raw[key]!=='boolean')throw new Error('反馈或错误忽略设置无效');
  if(typeof raw.disableRoaming!=='boolean')throw new Error('禁止跑动设置无效');
  if(!['timed','next','permanent'].includes(raw.replyMode)||!Number.isFinite(raw.replySeconds)||raw.replySeconds<1||raw.replySeconds>3600)throw new Error('回复停留设置无效');
  const moduleOrder={};
  for(const tab of ['basic','gpt']){const ids=raw.moduleOrder?.[tab];if(!Array.isArray(ids)||ids.length>40||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z][\w-]{0,63}$/.test(id)))throw new Error('模块顺序无效');moduleOrder[tab]=[...new Set(ids)];}

  if(!['gpt','api'].includes(raw.chatSource)||typeof raw.chatSourceChosen!=='boolean')throw new Error('请选择聊天服务来源');
  if(!['pet','connected'].includes(raw.mode)||typeof raw.alwaysOnTop!=='boolean'||!['never','all','except-gpt'].includes(raw.fullscreenMode)||!['animation','quota'].includes(raw.clickAction)||!Number.isFinite(raw.actionSpeed)||raw.actionSpeed<0.5||raw.actionSpeed>2||typeof raw.autostart!=='boolean'||typeof raw.followClientStart!=='boolean'||typeof raw.followClientClose!=='boolean'||!['none','all','bottom','taskbar','gpt'].includes(raw.snapMode))throw new Error('窗口或互动设置无效');
  return {disableEventResponse:raw.disableEventResponse,quotaAfterTurn:raw.quotaAfterTurn,quotaMode:raw.quotaMode,quotaSeconds:raw.quotaSeconds,whisperStreaming:raw.whisperStreaming,autoWhisperProbability:raw.autoWhisperProbability,ignoreAccountTimeouts:raw.ignoreAccountTimeouts,taskBasicFeedback:raw.taskBasicFeedback,taskNativeFeedback:raw.taskNativeFeedback,disableRoaming:raw.disableRoaming,replyMode:raw.replyMode,replySeconds:raw.replySeconds,moduleOrder,chatSource:raw.chatSource,chatSourceChosen:raw.chatSourceChosen,mode:raw.mode,alwaysOnTop:raw.alwaysOnTop,fullscreenMode:raw.fullscreenMode,clickAction:raw.clickAction,actionSpeed:raw.actionSpeed,autostart:raw.autostart,followClientStart:raw.followClientStart,followClientClose:raw.followClientClose,snapMode:raw.snapMode};
}
class Preferences{
  constructor(dir,initialMode=defaults.mode){this.file=path.join(dir,'preferences.json');try{this.value=validatePreferences({...defaults,mode:initialMode,...JSON.parse(fs.readFileSync(this.file,'utf8'))});}catch{this.value={...defaults,mode:initialMode};}}
  save(raw){const next=validatePreferences({...this.value,...raw});fs.writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2));fs.renameSync(this.file+'.tmp',this.file);this.value=next;return this.value;}
}
module.exports={Preferences,defaults,validatePreferences};
