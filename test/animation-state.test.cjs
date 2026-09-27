const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
  const ctx={console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,BUBBLE_DURATION_MS:10000};
  ctx.window={petPreferences:{taskBasicFeedback:true,taskNativeFeedback:true},__dshPetDebug:{},setTimeout,clearTimeout};
  vm.createContext(ctx);
  for(const file of ['shared-core.js','sprite.js','events.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../runtime',file),'utf8'),ctx);
  ctx.S=ctx.PetShared;const Sprite=vm.runInContext('PetSprite',ctx);
  const video=()=>({readyState:0,paused:true,ended:false,loads:0,style:{},classList:{add(){},remove(){}},addEventListener(){},removeEventListener(){},load(){this.loads++;this.readyState=2;},play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}});
  const s=Object.create(Sprite.prototype);Object.assign(s,{gen:0,front:0,anim:'idle',assetBase:'fixture/',facing:'left',videoA:video(),videoB:video(),dragState:{active:false},pet:{workStatusEnabled:true},animations:{idle:['idle'],turn:[],drag:['drag'],clicks:['click'],events:{workStatus:['thinking','working','result','waiting','success','error']}},renderBubble(){},dismissNextReply(){},stopMove(){},playIdle(){this.idleReached=true;}});
  return {s,ctx};
}
test('startup and idle polling never query quota, including after window recreation',async()=>{
  for(const enabled of [false,true])for(let rebuild=0;rebuild<2;rebuild++){
    const {ctx}=fixture();const requests=[],scheduled=[];
    Object.assign(ctx,{loopsStarted:false,sprites:[{pet:{balanceEnabled:true,workStatusEnabled:true},startWhisperLoop(){},processRoundQuota(){},onWorkTick(){}}],workTick:0,WORK_STATUS_URL:'work',BALANCE_URL:'balance',setTimeout:fn=>scheduled.push(fn)});
    Object.assign(ctx.window.petPreferences,{mode:'connected',quotaConfigured:true,quotaAfterTurn:enabled});
    ctx.S.fetchWorkStatus=async()=>{requests.push('work');return {state:null,ts:1,completedTurns:7};};
    ctx.S.fetchBalanceState=async()=>{requests.push('balance');return {ok:true};};
    vm.runInContext('startLoops(); startLoops();',ctx);await new Promise(setImmediate);
    for(let i=0;i<5;i++){scheduled.shift()?.();await new Promise(setImmediate);}
    assert.deepEqual(requests,Array(6).fill('work'));
  }
});
test('task loops track their animation, do not restart on status refresh, and release on idle',()=>{
  const {s}=fixture();let tick=0;
  for(const state of ['thinking','working','result','waiting','success','error']){
    s.onWorkTick({state},++tick);assert.equal(s.anim,state);assert.equal(s.once,['success','error'].includes(state));
    const loads=s.videoA.loads+s.videoB.loads;
    s.onWorkTick({state},++tick);assert.equal(s.videoA.loads+s.videoB.loads,loads,'same state should keep playing');
    s.onWorkTick({state:null},++tick);const active=s.front===0?s.videoA:s.videoB;
    assert.equal(active.loop,false);assert.equal(typeof active.onended,'function');
    active.onended();assert.equal(s.anim,'idle');
  }
});
test('manual daily actions restore active task animation when finished',()=>{
  const {s}=fixture();s.onWorkTick({state:'thinking'},1);s.manualPlaying=true;s.playOnce('play-game');
  s.handleEnded();assert.equal(s.anim,'thinking');assert.equal(s.videoA.loop||s.videoB.loop,true);
  s.onWorkTick({state:null},2);
});

test('event mute clears active and deferred task feedback while preserving manual playback',()=>{
  const {s,ctx}=fixture();s.playIdle=()=>{s.anim='idle';};
  s.onWorkTick({state:'working',activeCount:1},1);assert.equal(s.anim,'working');
  s.manualPlaying=true;s.anim='play-game';s.onWorkTick({state:'waiting',activeCount:1},2);assert.ok(s.deferredWork);
  ctx.window.petPreferences.disableEventResponse=true;s.applyTaskFeedback();
  assert.equal(s.deferredWork,null);assert.equal(s.workOn,false);assert.equal(s.workNative,null);assert.equal(s.workText,null);assert.equal(s.anim,'play-game');
  s.manualPlaying=false;s.anim='working';s.onWorkTick({state:'working',activeCount:1},3);assert.equal(s.anim,'idle');assert.equal(s.workState,null);
  s.onWorkTick({state:'thinking',activeCount:1},4);assert.equal(s.anim,'idle');
  ctx.window.petPreferences.disableEventResponse=false;s.applyTaskFeedback();assert.equal(s.anim,'thinking');assert.equal(s.workOn,true);
  s.onWorkTick({state:null},5);
});
test('a task ending while its video loads cannot leave a late infinite loop',()=>{
  const {s}=fixture();let ready;
  s.videoB.load=function(){this.loads++;this.readyState=0;};
  s.videoB.addEventListener=(_name,listener)=>{ready=listener;};
  s.onWorkTick({state:'working'},1);assert.ok(s.pending);
  s.onWorkTick({state:null},2);ready();
  assert.equal(s.videoB.loop,false);assert.equal(s.once,true);assert.equal(typeof s.videoB.onended,'function');
  s.videoB.onended();assert.equal(s.anim,'idle');
});

test('round quota queries lower-priority completions once, defers display and ignores startup history',async()=>{
  const {s,ctx}=fixture();ctx.document={hidden:false};ctx.BALANCE_URL='fixture/balance';s.ac=new AbortController();s.pet.balanceEnabled=true;
  Object.assign(ctx.window.petPreferences,{mode:'connected',quotaAfterTurn:false});
  let queries=0,shown=0;ctx.S.fetchBalanceState=async()=>{queries++;return {ok:true};};s.showBalanceNow=()=>shown++;
  s.processRoundQuota({completedTurns:4,activeCount:0});assert.equal(queries,0);
  ctx.window.petPreferences.quotaAfterTurn=true;s.processRoundQuota({completedTurns:4,activeCount:0});assert.equal(queries,0);
  s.processRoundQuota({completedTurns:5,activeCount:1});await s.roundQuotaPromise;
  s.processRoundQuota({completedTurns:5,activeCount:1});assert.equal(queries,1);assert.equal(shown,0);
  s.processRoundQuota({completedTurns:5,activeCount:0});assert.equal(shown,1);assert.equal(s.autoQuotaVisible,true);
  s.processRoundQuota({completedTurns:5,activeCount:0});assert.equal(shown,1);
  s.explicitQuota=false;s.autoQuotaVisible=false;
  let release;ctx.S.fetchBalanceState=()=>{queries++;return new Promise(resolve=>release=resolve);};
  s.processRoundQuota({completedTurns:6,activeCount:0});ctx.window.petPreferences.quotaAfterTurn=false;
  s.processRoundQuota({completedTurns:6,activeCount:0});release({ok:true});await s.roundQuotaPromise;
  assert.equal(s.roundQuotaResult,null);assert.equal(shown,1,'turning off ignores late results');
  ctx.window.petPreferences.quotaAfterTurn=true;s.pet.balanceEnabled=false;s.processRoundQuota({completedTurns:7,activeCount:0});assert.equal(queries,2);
});
