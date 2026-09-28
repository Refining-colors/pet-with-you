const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
  let frame;
  const ctx={window:{petPreferences:{disableRoaming:true},__dshPetDebug:{}},VIEW:{w:1000,h:800},AREAS:[{x:0,y:0,width:1000,height:800}],requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){frame=null;}};
  vm.createContext(ctx);
  for(const file of ['shared-core.js','sprite.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../runtime',file),'utf8'),ctx);
  ctx.S=ctx.PetShared;const Sprite=vm.runInContext('PetSprite',ctx),s=Object.create(Sprite.prototype);
  Object.assign(s,{size:462,halfW:60,halfH:50,sideAllow:0,facing:'left',anim:'idle',moveRef:null,throwRef:null,moveToken:0,animations:{turn:[],categories:[],moves:{default:{minDist:100,maxDist:100,margin:20,leadSec:1,tailSec:1},actions:[{name:'run'}]}},currentCenterX:()=>85,currentCenterY:()=>400,switchTo(name){this.anim=name;},playOnce(name){this.anim=name;},closeMenu(){},stopThrow(){},sendBounds(x,y){this.observedBounds={x,y};}});
  return {ctx,s,step:()=>frame()};
}
test('menu distinguishes stationary playback and explicit travel',()=>{
  const {ctx,s}=fixture();const a={...s.animations,idle:[],clicks:[],drag:[]};
  const groups=ctx.S.buildMenuTree(a)[0].children;
  const stationary=groups.find(g=>g.label==='移动（原地播放）').children[0];
  const moving=groups.find(g=>g.label==='跑动（实际移动）').children[0];
  s.onMenuAction(stationary);assert.equal(s.anim,'run');assert.equal(s.pendingMove,null);
  s.onMenuAction(moving);assert.equal(s.pendingMove.manual,true);assert.equal(s.moveManual,true);
});
test('manual running bypasses autonomous ban, reverses at edge, moves and cancels cleanly',()=>{
  const {s,step}=fixture();assert.equal(s.tryMove(),false);
  assert.equal(s.tryMove('run',true),'run');assert.equal(s.facing,'right');
  const video={duration:6,currentTime:3};s.startMoveDrive(video);step();
  assert.equal(s.observedBounds.x,75);assert.equal(s.observedBounds.y,350);assert.equal(s.moveManual,true);
  video.currentTime=5;step();assert.equal(s.observedBounds.x,125);assert.equal(s.moveRef,null);assert.equal(s.moveManual,false);
  s.tryMove('run',true);s.stopMove();assert.equal(s.pendingMove,null);assert.equal(s.moveManual,false);
});
test('an automatic move stops when roaming becomes disabled while its video loads',()=>{
  const {ctx,s}=fixture();ctx.window.petPreferences.disableRoaming=false;
  assert.equal(s.tryMove('run'),false,'cannot run beyond left screen edge');
  s.facing='right';assert.equal(s.tryMove('run'),'run');
  ctx.window.petPreferences.disableRoaming=true;s.startMoveDrive({duration:6,currentTime:3});
  assert.equal(s.pendingMove,null);assert.equal(s.moveRef,null);assert.equal(s.observedBounds,undefined);
});
