const test=require('node:test');
const assert=require('node:assert/strict');
const {shouldHide,WindowPolicy}=require('../window-policy.cjs');
const {defaults,validatePreferences}=require('../preferences.cjs');
const {nativeId}=require('../window-policy.cjs');
test('Windows explicitly uses the native topmost band rather than floating',()=>{
  const {setTopmost}=require('../window-mode.cjs');const calls=[];
  const w={setAlwaysOnTop:(...args)=>calls.push(args)};
  setTopmost(w,true);setTopmost(w,false);
  assert.deepEqual(calls,[[true,process.platform==='win32'?'screen-saver':'floating'],[false,process.platform==='win32'?'screen-saver':'floating']]);
});

test('new pure-pet preferences start in ordinary display and cannot retain GPT-only mode',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {Preferences}=require('../preferences.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-default-window-'));
  try{
    const p=new Preferences(dir);assert.equal(p.value.mode,'pet');assert.equal(p.value.windowMode,'normal');
    assert.equal(p.value.alwaysOnTop,false);assert.equal(p.value.fullscreenMode,'never');
    p.save({mode:'connected',windowMode:'gpt'});assert.equal(p.value.windowMode,'gpt');
    p.save({mode:'pet'});assert.equal(p.value.windowMode,'normal');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
const bounds={x:100,y:100,width:300,height:300};
const state={fullscreen:true,process:'game',monitor:{x:0,y:0,width:1920,height:1080}};
function fixture(mode='gpt'){
  let visible=true,top=false,raises=0,time=1000;
  const w={isDestroyed:()=>false,isVisible:()=>visible,isAlwaysOnTop:()=>top,setAlwaysOnTop:v=>top=v,moveTop:()=>raises++,getBounds:()=>bounds,hide:()=>visible=false,showInactive:()=>visible=true};
  let prefs={...defaults,windowMode:mode};
  const policy=new WindowPolicy({getWindows:()=>[w],getPreferences:()=>prefs,now:()=>time});
  return {w,policy,get raises(){return raises;},advance(ms){time+=ms;policy.apply();},mode(value){prefs={...prefs,windowMode:value};policy.apply();}};
}
test('GPT mode follows foreground ownership, and other window choices are exclusive',()=>{
  const f=fixture();
  f.policy.acceptState({...state,process:'Codex'});assert.equal(f.w.isAlwaysOnTop(),true);assert.equal(f.w.isVisible(),true);
  f.policy.acceptState({pid:process.pid});assert.equal(f.w.isAlwaysOnTop(),true,'own pet/settings retain last external foreground');
  f.policy.acceptState({pid:process.pid,clientRunning:false});assert.equal(f.w.isAlwaysOnTop(),false,'closed client cannot leave stale GPT topmost while our settings own focus');
  f.policy.acceptState({...state,process:'editor',fullscreen:false});assert.equal(f.w.isAlwaysOnTop(),false);assert.equal(f.w.isVisible(),true);
  f.policy.acceptState(state);assert.equal(f.w.isVisible(),false);
  f.mode('top');assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),true);
  f.mode('normal');assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),false);
  f.mode('fullscreen');assert.equal(f.w.isVisible(),false);
  f.policy.acceptState({});assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),true);
});

test('native evidence repairs a late cover or same-handle restore, and is consumed once',()=>{
  const f=fixture();f.w.getNativeWindowHandle=()=>Buffer.from([42,0,0,0,0,0,0,0]);
  const snapshot={process:'Codex',pid:process.pid+1,foregroundId:'client',ownedWindows:[{id:'42',topmost:true,visible:true,minimized:false,aboveForeground:true}]};
  f.policy.acceptState(snapshot);const first=f.raises;
  f.policy.acceptState({...snapshot,ownedWindows:[{...snapshot.ownedWindows[0],aboveForeground:false}]});
  assert.equal(f.raises,first+1,'same client handle but native stacking changed');
  f.policy.apply();assert.equal(f.raises,first+1,'stale sample must not reassert again');
  f.policy.acceptState(snapshot);assert.equal(f.raises,first+1,'healthy stacking needs no repair');
  f.policy.acceptState({...snapshot,ownedWindows:[{...snapshot.ownedWindows[0],topmost:false}]});
  assert.equal(f.raises,first+2,'repair native topmost even when Electron says true');
  f.w.hide();
  f.policy.acceptState({...snapshot,ownedWindows:[{...snapshot.ownedWindows[0],visible:false,minimized:true}]});
  assert.equal(f.w.isVisible(),true,'eligible previously shown pet recovers unexpected OS hiding');
  f.policy.setManualHidden(true);const hiddenRaises=f.raises;
  f.policy.acceptState(snapshot);assert.equal(f.w.isVisible(),false);assert.equal(f.raises,hiddenRaises);
});

test('native correction respects own settings, startup, fullscreen, other apps and mode changes',()=>{
  const f=fixture();f.w.getNativeWindowHandle=()=>Buffer.from([42,0,0,0]);
  assert.equal(nativeId(f.w),'42');
  const bad={id:'42',visible:false,minimized:false,topmost:false,aboveForeground:false};
  f.w.hide();
  f.policy.acceptState({process:'Codex',pid:process.pid+1,ownedWindows:[bad]});
  assert.equal(f.w.isVisible(),false,'do not show an unpainted startup window');
  f.policy.requestShow(f.w);assert.equal(f.w.isVisible(),true);
  const count=f.raises;
  f.policy.acceptState({pid:process.pid,ownedWindows:[{...bad,visible:true,topmost:true}]});
  assert.equal(f.raises,count,'do not fight our settings or tray menu');
  f.policy.acceptState({...state,pid:process.pid+1,ownedWindows:[bad]});
  assert.equal(f.w.isVisible(),false,'other fullscreen app wins over recovery');
  f.policy.acceptState({process:'editor',pid:process.pid+1,ownedWindows:[bad]});
  assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),false);
  f.mode('normal');const normalRaises=f.raises;
  f.policy.acceptState({process:'Codex',pid:process.pid+1,ownedWindows:[bad]});
  assert.equal(f.raises,normalRaises);assert.equal(f.w.isAlwaysOnTop(),false);
});
test('tray reveal overrides manual and fullscreen hiding temporarily without repeated raising',()=>{
  const f=fixture();f.policy.acceptState(state);f.policy.setManualHidden(true);
  f.policy.revealOnce();assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),true);
  const count=f.raises;f.advance(7999);assert.equal(f.raises,count);assert.equal(f.w.isVisible(),true);
  f.advance(1);assert.equal(f.w.isVisible(),false);assert.equal(f.w.isAlwaysOnTop(),false);
  f.policy.revealOnce();f.mode('normal');assert.equal(f.w.isVisible(),true);assert.equal(f.w.isAlwaysOnTop(),false);
  f.policy.revealOnce();f.policy.setManualHidden(true);assert.equal(f.w.isVisible(),false);
});
test('legacy preferences migrate to one persistent mode',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {Preferences}=require('../preferences.cjs');
  const {SettingsStore}=require('../settings-store.cjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-window-mode-'));
  try{
    const store=new SettingsStore(dir);store.set('preferences',{alwaysOnTop:true,fullscreenMode:'except-gpt'});
    const p=new Preferences(dir);assert.equal(p.value.windowMode,'gpt');assert.equal(p.value.alwaysOnTop,false);
    p.save({windowMode:'top'});assert.equal(p.value.fullscreenMode,'never');assert.equal(p.value.alwaysOnTop,true);
    assert.equal(new Preferences(dir).value.windowMode,'top');
    p.save({windowMode:'normal'});assert.equal(p.value.alwaysOnTop,false);
    assert.throws(()=>p.save({windowMode:'bad'}));assert.equal(p.value.windowMode,'normal');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('fullscreen policies distinguish GPT, maximized windows and other screens',()=>{
  const gpt={...defaults,windowMode:'gpt'};
  assert.equal(shouldHide(gpt,state,bounds),true);
  assert.equal(shouldHide(gpt,{...state,process:'Codex'},bounds),false);
  assert.equal(shouldHide({...defaults,windowMode:'fullscreen'},{...state,process:'ChatGPT'},bounds),true);
  assert.equal(shouldHide({...defaults,windowMode:'normal'},state,bounds),false);
  assert.equal(shouldHide(gpt,{...state,fullscreen:false},bounds),false);
  assert.equal(shouldHide(gpt,state,{...bounds,x:2200}),false);
  assert.throws(()=>validatePreferences({...defaults,actionSpeed:50}));
});
test('auto hide restores visibility but does not undo manual hiding',()=>{
  let visible=true,top=true;const w={isDestroyed:()=>false,isVisible:()=>visible,isAlwaysOnTop:()=>top,setAlwaysOnTop:v=>top=v,moveTop(){},getBounds:()=>bounds,hide:()=>visible=false,showInactive:()=>visible=true};
  let prefs={...defaults,windowMode:'fullscreen'};const p=new WindowPolicy({getWindows:()=>[w],getPreferences:()=>prefs});
  p.state=state;p.apply();assert.equal(visible,false);
  p.state={};p.apply();assert.equal(visible,true);
  p.setManualHidden(true);prefs={...prefs,windowMode:'normal'};p.apply();assert.equal(visible,false);assert.equal(top,false);
  p.setManualHidden(false);assert.equal(visible,true);
});
test('foreground changes repair stacking without continuous raising or stealing focus',()=>{
  let visible=true,top=true,raises=0,sets=0;
  const w={isDestroyed:()=>false,isVisible:()=>visible,isAlwaysOnTop:()=>top,setAlwaysOnTop(v){top=v;sets++;},moveTop(){raises++;},getBounds:()=>bounds,hide(){visible=false;},showInactive(){visible=true;},focus(){assert.fail('must not focus');}};
  let prefs={...defaults,windowMode:'fullscreen'};const p=new WindowPolicy({getWindows:()=>[w],getPreferences:()=>prefs});
  const foreground={pid:process.pid+1,foregroundId:'101',fullscreen:false};
  p.acceptState(foreground);assert.equal(raises,1);assert.equal(sets,1,'reassert even when cached topmost flag is true');
  p.apply();p.acceptState(foreground);assert.equal(raises,1);
  p.acceptState({...foreground,foregroundId:'102'});assert.equal(raises,2,'another window in the same process');
  p.acceptState({pid:process.pid,foregroundId:'settings'});assert.equal(raises,2,'own settings and tray do not trigger raising');
  p.acceptState(foreground);assert.equal(raises,3);
  p.acceptState({...foreground,...state,foregroundId:'fullscreen'});assert.equal(visible,false);assert.equal(raises,3);
  p.acceptState(foreground);assert.equal(visible,true);assert.equal(raises,4);
  p.setManualHidden(true);p.acceptState({...foreground,foregroundId:'103'});assert.equal(raises,4);
  prefs={...prefs,windowMode:'normal'};p.setManualHidden(false);p.acceptState(foreground);assert.equal(top,false);assert.equal(raises,4);
});
