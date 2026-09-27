/**
 * dsh-pet desktop helper —— 事件联动（额度 / 碎碎念 / 工作状态）。
 *
 * 展示与 tick 回调经 PetSprite.prototype 挂载（运行时可解析，顺序无碍）；
 * startLoops 是全部轮询的组装入口（boot 后调用）。依赖 constants.js / sprite.js。
 */
'use strict';

// ---- 工作状态联动（DSH 会话状态，每只宠物按 workStatusEnabled 门控；容器 1s 轮询，ts 变化才递增 tick）----
// 气泡驻留语义与浏览器一致：thinking/working/result/waiting（"事情还没完"）常驻直到状态切走；
//   success/error（"这事结束了"）10s 自动收起；state=null（空闲/回合被打断）收起气泡回待机。
// 动画循环语义：进行中档位循环播（switchTo once=false），终态档位播一遍回 idle 链；
//   回空闲时把正在循环的那段改成"播完即停"（见下面空闲分支），否则 ended 永不触发、链回不去。
PetSprite.prototype.onWorkTick = function onWorkTick(snapshot, tick) {
  this.latestWorkSnapshot=snapshot;
  if(this.autoQuotaVisible&&snapshot?.activeCount>0)this.closeQuota();
  const basic=window.petPreferences?.taskBasicFeedback!==false,native=window.petPreferences?.taskNativeFeedback!==false;
  if(tick===0||tick===this.prevWorkTick)return;
  const muted=window.petPreferences?.disableEventResponse===true;
  const enabled=!muted&&this.pet.workStatusEnabled&&(basic||native);
  if(muted)this.deferredWork=null;
  if(enabled&&(this.manualPlaying||this.dragState.active)){this.deferredWork=[snapshot,tick];return;}
  this.prevWorkTick=tick;
  const state=enabled?snapshot?.state:null;
  const changed=this.prevWorkState!==state;
  this.prevWorkState=state;
  this.workState=basic?state:null;
  this.workNative=native&&state?snapshot:null;
  if(!state||!basic){
    const front=this.front===0?this.videoA:this.videoB;
    if(front&&S.poolIncludes(this.animations.events?.workStatus??[],this.anim)){
      this.once=true;
      front.loop=false;front.onended=()=>this.handleEnded();
    }
  }
  if(!state){
    clearTimeout(this.workTimer);this.workTimer=null;this.workOn=false;this.workText=null;this.workNative=null;this.renderBubble();
    if(muted&&!this.manualPlaying&&!this.dragState.active&&S.poolIncludes(this.animations.events?.workStatus??[],this.anim))this.playIdle();
    return;
  }
  this.dismissNextReply();
  const idx=S.WORK_STATUS_INDEX[state],group=this.pet.workStatusTexts?.[idx];
  const configuredText=Array.isArray(group)&&group.length?group[Math.floor(Math.random()*group.length)]:null;
  this.workText=basic?(snapshot.task||(state==='success'?'这一回合结束啦':state==='error'?'刚才的工具遇到问题了':configuredText||{thinking:'正在思考',working:'正在忙碌',result:'正在整理结果',waiting:'需要你确认'}[state])):null;
  const terminal=state==='success'||state==='error';
  if(changed){
    this.workOn=true;clearTimeout(this.workTimer);
    this.workTimer=terminal?setTimeout(()=>{this.workOn=false;this.renderBubble();},BUBBLE_DURATION_MS):null;
  }
  this.renderBubble();
  if(!basic)return;
  const slot=this.animations.events?.workStatus?.[idx];if(slot===undefined)return;
  const active=this.front===0?this.videoA:this.videoB;
  if(!changed&&S.slotIncludes(slot,this.anim)&&(this.pending||active&&!active.paused&&!active.ended))return;
  this.stopMove();const name=S.pickSlot(slot,this.anim),rotating=!terminal&&Array.isArray(slot)&&slot.length>1;
  if(terminal||rotating)this.playOnce(name);else this.switchTo(name,false);
};
PetSprite.prototype.applyTaskFeedback = function applyTaskFeedback(){
  if(!this.latestWorkSnapshot)return;
  this.prevWorkTick=-1;this.prevWorkState=null;
  this.onWorkTick(this.latestWorkSnapshot,Date.now());
};

// Completion counts include lower-priority sessions, even when another task stays active.
PetSprite.prototype.processRoundQuota = function processRoundQuota(snapshot) {
  const count=snapshot?.completedTurns;
  if(!Number.isSafeInteger(count)||count<0)return;
  const enabled=window.petPreferences.mode==='connected'&&!window.petPreferences.disableEventResponse&&window.petPreferences.quotaAfterTurn&&this.pet.balanceEnabled;
  if(this.roundQuotaSeen===undefined||!enabled){
    this.roundQuotaSeen=count;this.roundQuotaTarget=null;this.roundQuotaResult=null;
    if(!enabled){this.roundQuotaGeneration=(this.roundQuotaGeneration||0)+1;if(this.autoQuotaVisible)this.closeQuota();}
    return;
  }
  if(count>this.roundQuotaSeen)this.roundQuotaTarget=count;
  this.roundQuotaSeen=count;
  if(this.roundQuotaTarget!==null&&this.roundQuotaTarget!==undefined&&!this.roundQuotaPending){
    const target=this.roundQuotaTarget,generation=this.roundQuotaGeneration||0;
    this.roundQuotaTarget=null;this.roundQuotaPending=true;
    this.roundQuotaPromise=S.fetchBalanceState(BALANCE_URL+'?round='+target).then(state=>{
      if(!this.ac.signal.aborted&&generation===(this.roundQuotaGeneration||0))this.roundQuotaResult=state;
    }).catch(()=>{
      if(!this.ac.signal.aborted&&generation===(this.roundQuotaGeneration||0))this.roundQuotaResult={ok:false,provider:'额度查询',reason:'fetch-error',message:'回合结束后的额度查询未完成，请在设置中检查查询配置。'};
    }).finally(()=>{this.roundQuotaPending=false;});
  }
  if(!this.roundQuotaResult||this.roundQuotaPending||snapshot.activeCount>0||this.explicitQuota||this.balanceRequestPending||this.whisperRequest||this.dragState.active||this.manualPlaying||this.chatOpen||this.menuOpen||this.bubbleHover||this.bubbleSelecting||document.hidden)return;
  const state=this.roundQuotaResult;this.roundQuotaResult=null;
  this.explicitQuota=true;this.autoQuotaVisible=true;
  if(state.ok)this.showBalanceNow(state);else this.showBalanceNotice(state);
};

// 余额不可用（服务商未登记 / 缺凭证 / 抓取失败）：只弹**文字说明**气泡，不播档位动画
// （非 ok 没有百分比语义，档位动画无从映射）。显隐/定时与成功路径同一套（10s 自动消失）；
// 不 stopMove——本次没有动画要抢前台，宠物没必要停下漫游。
PetSprite.prototype.showBalanceNotice = function showBalanceNotice(state) {
  if (!this.pet.balanceEnabled && !this.explicitQuota) return;
  if (!state || state.ok) return;
  this.balanceKind=null;
  this.dismissNextReply();
  clearTimeout(this.bubbleTimer);this.bubbleTimer=null;
  this.bubbleOn = true;
  this.balanceWrap = true; // 文字说明可能多行：renderBubble 据此套用换行变体（默认 nowrap 会顶出宠物宽度）
  this.balanceView = S.balanceBubbleView(state);
  this.renderBubble();

};

// Wait a full interval; skipped ticks never request model output.
PetSprite.prototype.canAutoWhisper = function canAutoWhisper() {
  return !!window.petPreferences.chatReady && this.pet.whisperEnabled && !this.ac.signal.aborted &&
    !this.whisperRequest && !this.whisperOn && !this.workOn && !this.explicitQuota && !this.bubbleOn &&
    !this.errorNotice && !this.chatOpen && !this.menuOpen && !this.manualPlaying && !this.dragState.active &&
    !this.bubbleHover && !this.bubbleSelecting && !document.hidden;
};
PetSprite.prototype.autoWhisperTick = function autoWhisperTick() {
  if(!this.canAutoWhisper())return;
  const chance=window.petPreferences.autoWhisperProbability ?? 50;
  if(chance<=0 || Math.random()*100>=chance)return;
  return this.showWhisperFromMenu(true);
};
PetSprite.prototype.startWhisperLoop = function startWhisperLoop() {
  if (!this.pet.whisperEnabled || this.whisperLoopTimer !== null) return;
  const intervalMs = Math.max(60000, (this.pet.eventsRefreshSec?.whisper ?? 300) * 1000);
  this.whisperLoopTimer = window.setInterval(() => void this.autoWhisperTick(), intervalMs);
};

// 碎碎念展示（本宠物）：随机抽 events.whisper 动画 + 弹文本气泡（10s 消失，与余额同一语义）
// image：host 随机抽定的配图名称（未开配图/池为空则空串，与浏览器端同一契约）
PetSprite.prototype.showWhisper = function showWhisper(text, image) {
  if(this.dragState.active)return;
  const pool = this.animations.events?.whisper;
  if (!pool || pool.length === 0) {
    console.error('[dsh-pet] 配置缺少 animations.events.whisper，无法播放碎碎念动画');
    return;
  }
  // 整池随机抽 1 槽（避开当前正播动画，避免连续重复）；槽位若为数组候选再档内随机（与浏览器一致）
  this.pickWhisper ||= S.createPoolPicker();
  const name = this.pickWhisper(pool.flat(),this.anim);
  this.stopMove();
  clearTimeout(this.whisperTimer);this.whisperTimer=null;
  this.whisperOn = true;
  this.whisperView = S.whisperBubbleView({ ok: true, text, ts: 0 });
  this.whisperImage = typeof image === 'string' ? image : '';
  this.persistReply({text,image:this.whisperImage});
  this.renderBubble();
  if(!this.workOn&&!this.explicitQuota)this.playOnce(name);
};

// 余额展示（档位动画 + 气泡）：回合完成与菜单点播共用同一展示路径，视觉/行为严格一致
PetSprite.prototype.showBalanceNow = function showBalanceNow(state) {
  this.dismissNextReply();
  if(this.dragState.active)return;
  if (!state || !state.ok) return;
  this.balanceKind=state.kind;
  const p = S.balancePercent(state);
  if (p === undefined) {
    clearTimeout(this.bubbleTimer);this.bubbleTimer=null;
    this.bubbleOn=true;this.balanceView=S.balanceBubbleView(state);this.renderBubble();

    return;
  }
  const pool = this.animations.events?.balance;
  if (!pool || pool.length === 0) {
    console.error('[dsh-pet] 配置缺少 animations.events.balance，无法播放余额事件动画');
    return;
  }
  const idx = S.balanceEventIndex(p);
  const slot = pool[idx];
  if (!slot) {
    console.error('[dsh-pet] balance 档位索引越界：p=' + p + ' idx=' + idx);
    return;
  }
  const name = S.pickSlot(slot, this.anim); // 数组槽位档内随机抽 1，且避开当前正播动画（避免连续重复，与浏览器一致）
  this.stopMove();
  clearTimeout(this.bubbleTimer);this.bubbleTimer=null;
  this.bubbleOn = true;
  this.balanceWrap = false; // 正常余额气泡是单行（nowrap），别继承上一次文字说明的换行变体
  this.balanceView = S.balanceBubbleView(state);
  this.renderBubble();

  this.playOnce(name);
};

// Only explicit user queries and opted-in turn completions may display quota.
function startLoops() {
  if (loopsStarted) return;
  loopsStarted = true;
  for (const s of sprites) s.startWhisperLoop();

  // 工作状态联动：任一宠物启用才轮询 /work-status（1s；避免无意义的周期请求——与浏览器一致）。
  // ts 变化（含回到空闲：host 在状态变化时更新 ts，切走 = 新 ts，用于收起常驻气泡）才递增 workTick →
  // 各启用宠物播档位动画+气泡；首拉仅记基线，启动/刷新不重放历史状态。
  const anyWorkStatusEnabled = window.petPreferences.mode==='connected' && sprites.some((s) => s.pet.workStatusEnabled||s.pet.balanceEnabled);
  if (anyWorkStatusEnabled) {
    let workBaseline = null;
    const workLoop = async () => {
      try {
        const snap = await S.fetchWorkStatus(WORK_STATUS_URL);
        const ts = snap && typeof snap.ts === 'number' ? snap.ts : 0;
        if (workBaseline === null) {
          workBaseline = ts; // 首拉仅记基线
          if(snap?.state&&!['success','error'].includes(snap.state)){
            workTick++;for(const s of sprites)s.onWorkTick(snap,workTick);
          }
        } else if (ts !== workBaseline) {
          workBaseline = ts;
          workTick++;
          for (const s of sprites) s.onWorkTick(snap, workTick);
        }
        for(const s of sprites)s.processRoundQuota(snap);
      } catch {
        /* 轻量轮询失败静默：下一周期再试 */
      }
      setTimeout(() => void workLoop(), 1000);
    };
    void workLoop();
  }
}
