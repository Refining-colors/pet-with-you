const test=require('node:test');
const assert=require('node:assert/strict');
const {shouldHide,WindowPolicy}=require('../window-policy.cjs');
const {defaults,validatePreferences}=require('../preferences.cjs');
const bounds={x:100,y:100,width:300,height:300};
const state={fullscreen:true,process:'game',monitor:{x:0,y:0,width:1920,height:1080}};
test('fullscreen policies distinguish GPT, maximized windows and other screens',()=>{
  assert.equal(shouldHide(defaults,state,bounds),true);
  assert.equal(shouldHide(defaults,{...state,process:'Codex'},bounds),false);
  assert.equal(shouldHide({...defaults,fullscreenMode:'all'},{...state,process:'ChatGPT'},bounds),true);
  assert.equal(shouldHide({...defaults,fullscreenMode:'never'},state,bounds),false);
  assert.equal(shouldHide(defaults,{...state,fullscreen:false},bounds),false);
  assert.equal(shouldHide(defaults,state,{...bounds,x:2200}),false);
  assert.throws(()=>validatePreferences({...defaults,actionSpeed:50}));
});
test('auto hide restores visibility but does not undo manual hiding',()=>{
  let visible=true,top=true;const w={isDestroyed:()=>false,isVisible:()=>visible,isAlwaysOnTop:()=>top,setAlwaysOnTop:v=>top=v,getBounds:()=>bounds,hide:()=>visible=false,showInactive:()=>visible=true};
  let prefs={...defaults};const p=new WindowPolicy({getWindows:()=>[w],getPreferences:()=>prefs});
  p.state=state;p.apply();assert.equal(visible,false);
  p.state={};p.apply();assert.equal(visible,true);
  p.setManualHidden(true);prefs={...prefs,alwaysOnTop:false};p.apply();assert.equal(visible,false);assert.equal(top,false);
  p.setManualHidden(false);assert.equal(visible,true);
});
