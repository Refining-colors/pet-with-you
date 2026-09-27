const fs=require('node:fs'),path=require('node:path');
class Positions {
  constructor(dir){this.file=path.join(dir,'positions.json');this.values=Object.create(null);try{const raw=JSON.parse(fs.readFileSync(this.file,'utf8'));for(const [id,p] of Object.entries(raw))if(Number.isFinite(p.x)&&Number.isFinite(p.feet))this.values[id]={x:p.x,feet:p.feet};}catch{}}
  get(id){return this.values[id]||null;}
  set(id,p){if(typeof id!=='string'||!Number.isFinite(p.x)||!Number.isFinite(p.feet))return;const old=this.values[id];if(old?.x===p.x&&old?.feet===p.feet)return;this.values[id]=p;this.dirty=true;if(!this.timer)this.timer=setTimeout(()=>this.flush(),500);}
  flush(){clearTimeout(this.timer);this.timer=null;if(!this.dirty)return;fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.values));fs.renameSync(this.file+'.tmp',this.file);this.dirty=false;}
}
module.exports={Positions};
