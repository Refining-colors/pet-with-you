const {spawn}=require('node:child_process');
const readline=require('node:readline');
const path=require('node:path');

// Own the helper's lifetime separately from the policy; a failed helper is not a client exit.
class WindowObserver{
  constructor({onState,onDisconnect,spawnProcess=spawn,now=Date.now}){
    Object.assign(this,{onState,onDisconnect,spawnProcess,now});
    this.closed=true;this.failures=0;
  }
  start(){
    if(!this.closed)return;
    this.closed=false;this.connect();
    this.watchdog=setInterval(()=>{
      if(this.child&&this.now()-this.lastSample>15000)this.disconnect(this.child);
    },1000);
  }
  connect(){
    if(this.closed)return;
    const child=this.spawnProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'fullscreen-watch.ps1'),'-WatchProcessId',String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    this.child=child;this.lastSample=this.now();
    this.lines=readline.createInterface({input:child.stdout});
    this.lines.on('line',line=>{
      if(this.child!==child)return;
      let state;try{state=JSON.parse(line);}catch{return;}
      if(!state||typeof state!=='object'||typeof state.clientRunning!=='boolean')return;
      this.lastSample=this.now();this.failures=0;this.onState(state);
    });
    child.on('error',()=>this.disconnect(child));
    child.on('exit',()=>this.disconnect(child));
  }
  disconnect(child){
    if(this.child!==child||this.closed)return;
    this.child=null;this.lines?.close();child.kill();
    this.onDisconnect();
    this.retry=setTimeout(()=>this.connect(),Math.min(5000,500*2**Math.min(this.failures++,4)));
  }
  close(){
    this.closed=true;clearInterval(this.watchdog);clearTimeout(this.retry);
    const child=this.child;this.child=null;this.lines?.close();child?.kill();
  }
}
module.exports={WindowObserver};
