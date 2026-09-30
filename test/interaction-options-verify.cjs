const assert=require('node:assert/strict');
module.exports=async function({pet,settings,service}){
  const run=code=>pet.webContents.executeJavaScript(code);
  const result=await run(`(async()=>{
    const s=sprites[0],saved={...window.petPreferences},mount=S.mountContextMenu,estimate=S.estimateReleaseVelocity,throwStep=S.throwStepRegion;
    const menus={},checks={};
    try{
      s.stopMove();s.stopThrow();s.closeMenu();s.justDragged=false;
      S.mountContextMenu=options=>{menus[window.petPreferences.mode]=options.tree.find(n=>n.label==='窗口设置').children;return {close:options.onClose};};
      for(const mode of ['pet','connected','pet']){
        window.petPreferences={...saved,mode,snapMode:'none'};
        s.onContextMenu({preventDefault(){},clientX:500,clientY:500});s.closeMenu();
      }
      checks.pure=menus.pet.every(n=>n.action!=='fullscreen-except');
      checks.connected=menus.connected.some(n=>n.label.includes('在GPT置顶，其余全屏隐藏'));
      let estimates=0;
      S.estimateReleaseVelocity=()=>{estimates++;return {vx:1200,vy:-800};};
      window.petPreferences.disableThrow=true;
      const before={...s.pos};s.dragState.active=true;s.dragState.dragging=true;s.dragTrail=[];
      s.onPointerUp({});
      checks.release=estimates===0&&s.throwRef===null&&Math.abs(s.pos.x-before.x)<1&&Math.abs(s.pos.y-before.y)<1;
      s.startThrow(s.pos.x,s.pos.y,1200,-800);checks.blocked=s.throwRef===null;
      window.petPreferences.disableThrow=false;s.startThrow(s.pos.x,s.pos.y,1200,-800);checks.enabled=s.throwRef!==null;
      applyPetPreferences({disableThrow:true});checks.stopped=s.throwRef===null&&s.throwState===null;
      let physicsSeen;
      S.throwStepRegion=(...args)=>{physicsSeen=args[3];return throwStep(...args);};
      window.petPreferences.disableThrow=false;window.petPreferences.disableEdgeBounce=true;
      s.startThrow(s.pos.x,s.pos.y,1200,-800);
      await new Promise(resolve=>requestAnimationFrame(resolve));
      checks.noRebound=physicsSeen?.restitution===0&&s.physics.restitution!==0&&s.throwRef!==null;
      s.stopThrow();window.petPreferences.disableEdgeBounce=false;physicsSeen=null;
      s.startThrow(s.pos.x,s.pos.y,1200,-800);await new Promise(resolve=>requestAnimationFrame(resolve));
      checks.reboundRestored=physicsSeen===s.physics;
    }finally{S.mountContextMenu=mount;S.estimateReleaseVelocity=estimate;S.throwStepRegion=throwStep;s.stopThrow();window.petPreferences=saved;s.justDragged=false;}
    return checks;
  })()`);
  for(const [key,value] of Object.entries(result))assert.equal(value,true,'Interaction options: '+key);
  await settings.webContents.executeJavaScript(`(async()=>{await loadPreferences();for(const id of ['disableThrow','disableEdgeBounce']){$('#'+id).checked=true;$('#'+id).dispatchEvent(new Event('change',{bubbles:true}));}await window.PetSettingsAutosave.flush();})()`);
  const saved=await fetch(service.base+'/preferences').then(r=>r.json());assert.equal(saved.disableThrow,true);assert.equal(saved.disableEdgeBounce,true);
  await fetch(service.base+'/preferences',{method:'PUT',body:JSON.stringify({disableThrow:false,disableEdgeBounce:false})});
};
