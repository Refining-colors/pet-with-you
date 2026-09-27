const fs=require('node:fs'),path=require('node:path');
class Positions {
  constructor(dir){this.store=new (require('./settings-store.cjs').SettingsStore)(dir);this.file=this.store.file;this.values=Object.create(null);const raw=this.store.get('positions',{});for(const [id,p] of Object.entries(raw))if(Number.isFinite(p?.x)&&Number.isFinite(p?.feet))this.values[id]={x:p.x,feet:p.feet};}
  get(id){return this.values[id]||null;}
  set(id,p){if(typeof id!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.feet))return;const old=this.values[id];if(old?.x===p.x&&old?.feet===p.feet)return;this.values[id]=p;this.dirty=true;if(!this.timer)this.timer=setTimeout(()=>this.flush(),500);}
  flush(){clearTimeout(this.timer);this.timer=null;if(!this.dirty)return;this.store.set('positions',this.values);this.dirty=false;}
}
module.exports={Positions};
