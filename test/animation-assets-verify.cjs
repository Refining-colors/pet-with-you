const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({pet,dir})=>{
  const assets=await pet.webContents.executeJavaScript(`(async()=>{
    const s=sprites[0],a=s.animations;
    const names=[...new Set([...a.idle,...a.turn,...a.drag,...a.clicks,...a.moves.actions.map(v=>v.name),...a.categories.flatMap(c=>c.actions),...Object.values(a.events).flat(2)])];
    const results=[];
    for(const name of names){
      const v=document.createElement('video');v.muted=true;v.preload='auto';
      try{
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('load timeout')),8000);
          v.onerror=()=>{clearTimeout(timer);reject(new Error('decode error'));};
          v.onloadeddata=()=>{clearTimeout(timer);resolve();};
          v.src=s.assetBase+encodeURIComponent(name)+'.webm';v.load();
        });
        const duration=v.duration;
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('seek timeout')),8000);
          v.onerror=()=>{clearTimeout(timer);reject(new Error('seek decode error'));};
          v.onseeked=()=>{clearTimeout(timer);resolve();};v.currentTime=Math.max(.01,duration-.1);
        });
        results.push({name,duration,width:v.videoWidth,height:v.videoHeight,ok:v.readyState>=2&&Number.isFinite(duration)&&duration>0});
      }catch(e){results.push({name,ok:false,error:e.message});}
      finally{v.onloadeddata=v.onseeked=v.onerror=null;v.removeAttribute('src');v.load();}
    }
    return results;
  })()`);
  fs.writeFileSync(path.join(dir,'animation-assets.json'),JSON.stringify(assets,null,2));
  assert.equal(assets.length,106);assert.deepEqual(assets.filter(a=>!a.ok),[]);
};
