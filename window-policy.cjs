const {WindowObserver}=require('./window-observer.cjs');
const {windowMode,setTopmost}=require('./window-mode.cjs');
function nativeId(w){
  const b=w.getNativeWindowHandle?.();
  return b?(b.length===8?b.readBigUInt64LE():BigInt(b.readUInt32LE())).toString():null;
}
function shouldHide(preferences,state,bounds){
  const mode=windowMode(preferences);
  if(!['fullscreen','gpt'].includes(mode)||!state?.fullscreen||!state.monitor)return false;
  if(mode==='gpt'&&/^(codex|chatgpt)$/i.test(state.process||''))return false;
  const m=state.monitor;return bounds.x<m.x+m.width&&bounds.x+bounds.width>m.x&&bounds.y<m.y+m.height&&bounds.y+bounds.height>m.y;
}
class WindowPolicy{
  constructor({getWindows,getPreferences,toPhysical=b=>b,onState=()=>{},now=Date.now}){Object.assign(this,{getWindows,getPreferences,toPhysical,onState,now});this.state={};this.hidden=new Set();this.ready=new WeakSet();this.manualHidden=false;this.revealUntil=0;}
  start(){
    if(this.observer)return;
    this.observer=new WindowObserver({onState:state=>this.acceptState(state),onDisconnect:()=>{
      this.state={};this.foreground=null;this.nativeWindows=null;this.onState({clientRunning:null});this.apply();
    }});
    this.observer.start();
    this.timer=setInterval(()=>this.apply(),650);
  }
  acceptState(state){
    const foreground=state.foregroundId||state.pid;
    // Fresh native evidence also catches same-handle restores and late OS stacking changes.
    this.raisePending=!!foreground&&foreground!==this.foreground&&state.pid!==process.pid;
    this.foreground=foreground;
    if(state.pid!==process.pid)this.state=state;
    else if(state.clientRunning===false&&/^(codex|chatgpt)$/i.test(this.state.process||''))this.state={};
    this.nativeWindows=state.ownedWindows;
    this.ownForeground=state.pid===process.pid;
    this.onState(state);
    this.apply();
  }
  apply(){
    const p=this.getPreferences();
    const mode=windowMode(p);
    if(this.lastMode!==undefined&&this.lastMode!==mode)this.revealUntil=0;
    this.lastMode=mode;
    const revealed=this.now()<this.revealUntil;
    const top=revealed||mode==='top'||mode==='fullscreen'||(mode==='gpt'&&/^(codex|chatgpt)$/i.test(this.state.process||''));
    for(const w of this.getWindows()){
      if(w.isDestroyed())continue;
      if(w.isVisible())this.ready.add(w);
      const native=this.nativeWindows?.find(n=>n.id===nativeId(w));
      const topChanged=w.isAlwaysOnTop()!==top;
      const nativeTopChanged=native&&native.topmost!==top;
      if(topChanged||nativeTopChanged)setTopmost(w,top);
      const hide=this.manualHidden||(!revealed&&shouldHide(p,this.state,this.toPhysical(w.getBounds())));
      if(hide){if(w.isVisible()){this.hidden.add(w);w.hide();}}
      else {
        const restored=this.hidden.delete(w)||(top&&this.ready.has(w)&&native&&(!native.visible||native.minimized));
        if(restored)w.showInactive();
        const displaced=native&&!this.ownForeground&&native.aboveForeground===false;
        if(top&&w.isVisible()&&(this.raisePending||restored||topChanged||nativeTopChanged||displaced)){
          // Electron may still cache topmost=true after Windows has changed the real order.
          if(nativeTopChanged||displaced)setTopmost(w,false);
          setTopmost(w,true);
          w.moveTop();
        }
      }
    }
    for(const w of this.hidden)if(w.isDestroyed())this.hidden.delete(w);
    this.raisePending=false;
    this.nativeWindows=null;
  }
  revealOnce(){
    // A bounded override survives the tray's foreground transitions without changing saved rules.
    this.manualHidden=false;this.revealUntil=this.now()+8000;this.raisePending=true;
    for(const w of this.getWindows())if(!w.isDestroyed()&&!w.isVisible())this.hidden.add(w);
    this.apply();
  }
  setManualHidden(value){this.manualHidden=value;this.revealUntil=0;this.apply();}
  requestShow(w){this.ready.add(w);this.hidden.add(w);this.apply();}
  close(){clearInterval(this.timer);this.observer?.close();this.observer=null;}
}
module.exports={WindowPolicy,shouldHide,nativeId};
