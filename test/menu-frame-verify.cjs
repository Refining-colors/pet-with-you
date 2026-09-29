const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

module.exports=async function(pet){
  const run=code=>pet.webContents.executeJavaScript(code);
  await run(`(()=>{const s=sprites[0];s.stopMove();s.stopThrow();s.justDragged=false;s.snapAttachment=null;window.petPreferences.snapMode='none';s.sendBounds(400,300);})()`);
  await sleep(150);
  const originalSize=await run('sprites[0].size');
  for(const size of [originalSize,180,900]){
    await run(`sprites[0].resizePet(${size})`);await sleep(100);
    for(let i=0;i<3;i++){
      const native=pet.getContentBounds();
      const stable=await run(`(()=>{
        const s=sprites[0],before={left:s.el.style.left,top:s.el.style.top},a=s.videoA,b=s.videoB;
        s.onContextMenu({preventDefault(){},clientX:s.margin.l+s.halfW,clientY:s.margin.t+s.halfH});
        const during={left:s.el.style.left,top:s.el.style.top};
        return {before,during,sameVideos:a===s.videoA&&b===s.videoB};
      })()`);
      assert.deepEqual(stable.during,stable.before,'opening a menu cannot relocate a painted video before the native window catches up');
      await sleep(80);assert.deepEqual(pet.getContentBounds(),native,'menu opening does not move or resize the native window');
      await run('sprites[0].closeMenu()');await sleep(80);
      assert.deepEqual(pet.getContentBounds(),native,'closing the menu preserves the native frame');
      assert.deepEqual(await run('({left:sprites[0].el.style.left,top:sprites[0].el.style.top})'),stable.before);
      assert.equal(stable.sameVideos,true);
    }
  }
  await run(`sprites[0].resizePet(${originalSize})`);
};
