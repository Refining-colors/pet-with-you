const {spawn}=require('node:child_process');
const readline=require('node:readline');
const path=require('node:path');
function shouldHide(preferences,state,bounds){
  if(preferences.fullscreenMode==='never'||!state?.fullscreen||!state.monitor)return false;
  if(preferences.fullscreenMode==='except-gpt'&&/^(codex|chatgpt)$/i.test(state.process||''))return false;
  const m=state.monitor;return bounds.x<m.x+m.width&&bounds.x+bounds.width>m.x&&bounds.y<m.y+m.height&&bounds.y+bounds.height>m.y;
}
class WindowPolicy{
  constructor({getWindows,getPreferences,toPhysical=b=>b,onState=()=>{}}){Object.assign(this,{getWindows,getPreferences,toPhysical,onState});this.state={};this.hidden=new Set();this.manualHidden=false;}
  start(){
    this.child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'fullscreen-watch.ps1')],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    const child=this.child;
    readline.createInterface({input:child.stdout}).on('line',line=>{if(this.child!==child)return;try{this.acceptState(JSON.parse(line));}catch{}});
    const disconnected=()=>{if(this.child!==child)return;this.state={};this.onState({clientRunning:null});this.apply();};
    child.on('error',disconnected);
    child.on('exit',disconnected);
    this.timer=setInterval(()=>this.apply(),650);
  }
  acceptState(state){
    const foreground=state.foregroundId||state.pid;
    // Reassert stacking only when another app becomes foreground, never on every poll.
    this.raisePending=!!foreground&&foreground!==this.foreground&&state.pid!==process.pid;
    this.foreground=foreground;
    if(state.pid!==process.pid)this.state=state;
    this.onState(state);
    this.apply();
  }
  apply(){
    const p=this.getPreferences();
    for(const w of this.getWindows()){
      if(w.isDestroyed())continue;
      const topChanged=w.isAlwaysOnTop()!==p.alwaysOnTop;
      if(topChanged)w.setAlwaysOnTop(p.alwaysOnTop,'floating');
      const hide=this.manualHidden||shouldHide(p,this.state,this.toPhysical(w.getBounds()));
      if(hide){if(w.isVisible()){this.hidden.add(w);w.hide();}}
      else {
        const restored=this.hidden.delete(w);
        if(restored)w.showInactive();
        if(p.alwaysOnTop&&w.isVisible()&&(this.raisePending||restored||topChanged)){
          w.setAlwaysOnTop(true,'floating');
          w.moveTop();
        }
      }
    }
    for(const w of this.hidden)if(w.isDestroyed())this.hidden.delete(w);
    this.raisePending=false;
  }
  setManualHidden(value){this.manualHidden=value;this.apply();}
  requestShow(w){this.hidden.add(w);this.apply();}
  close(){clearInterval(this.timer);const child=this.child;this.child=null;child?.kill();}
}
module.exports={WindowPolicy,shouldHide};
