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
    readline.createInterface({input:child.stdout}).on('line',line=>{if(this.child!==child)return;try{const state=JSON.parse(line);if(state.pid!==process.pid)this.state=state;this.onState(state);this.apply();}catch{}});
    const disconnected=()=>{if(this.child!==child)return;this.state={};this.onState({clientRunning:null});this.apply();};
    child.on('error',disconnected);
    child.on('exit',disconnected);
    this.timer=setInterval(()=>this.apply(),650);
  }
  apply(){
    const p=this.getPreferences();
    for(const w of this.getWindows()){
      if(w.isDestroyed())continue;
      if(w.isAlwaysOnTop()!==p.alwaysOnTop)w.setAlwaysOnTop(p.alwaysOnTop,'floating');
      const hide=this.manualHidden||shouldHide(p,this.state,this.toPhysical(w.getBounds()));
      if(hide){if(w.isVisible()){this.hidden.add(w);w.hide();}}
      else if(this.hidden.has(w)){this.hidden.delete(w);w.showInactive();}
    }
    for(const w of this.hidden)if(w.isDestroyed())this.hidden.delete(w);
  }
  setManualHidden(value){this.manualHidden=value;this.apply();}
  requestShow(w){this.hidden.add(w);this.apply();}
  close(){clearInterval(this.timer);const child=this.child;this.child=null;child?.kill();}
}
module.exports={WindowPolicy,shouldHide};
