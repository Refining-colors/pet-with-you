class ClientLifecycle {
  constructor(){this.reset();}
  reset(){this.seen=false;this.absent=0;}
  update(preferences,running){
    if(preferences.mode!=='connected'||!preferences.followClientClose){this.reset();return false;}
    if(typeof running!=='boolean')return false;
    if(running){this.seen=true;this.absent=0;return false;}
    return this.seen&&++this.absent>=4;
  }
  async confirmClose({flush,getPreferences,getRunning}){
    if(this.confirming)return false;
    this.confirming=true;
    try{
      if(!await flush())return false;
      const p=getPreferences();
      return p.mode==='connected'&&p.followClientClose===true&&getRunning()===false;
    }finally{this.confirming=false;}
  }
}
module.exports={ClientLifecycle};
