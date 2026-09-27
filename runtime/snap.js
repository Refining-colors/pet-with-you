(function(root){
  function snapPosition({x,y,width,height,canvasHeight,targets,attachment,threshold=36,gap=3}){
    const cx=x+width/2;
    const valid=targets.filter(t=>Number.isFinite(t.y)&&cx>=t.x&&cx<=t.x+t.width&&t.y-canvasHeight-gap>=t.top);
    const kept=valid.find(t=>t.id===attachment);
    const near=valid.filter(t=>Math.min(Math.abs(y+height-t.y),Math.abs(y+canvasHeight+gap-t.y))<=threshold)
      .sort((a,b)=>a.y-b.y);
    const t=kept||near[0];
    return t?{x,y:t.y-canvasHeight-gap,attachment:t.id}:{x,y,attachment:null};
  }
  if(typeof module==='object')module.exports={snapPosition};else root.PetSnap={snapPosition};
})(typeof window==='object'?window:globalThis);
