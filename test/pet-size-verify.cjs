const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

module.exports=async function({pet,settings,service}){
  const run=script=>pet.webContents.executeJavaScript(script);
  const original=await run(`({size:sprites[0].size,id:sprites[0].pet.id})`);
  const originalName=await settings.webContents.executeJavaScript(`main.pets[0].name`);
  await settings.webContents.executeJavaScript(`(()=>{
    const name=document.querySelector('.pet-name input');name.value='Unsaved size-test name';name.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#apiBaseUrl').value='https://unsaved.example/v1';
  })()`);
  pet.show();pet.focus();await sleep(120);
  await run(`(()=>{
    const s=sprites[0];s.stopMove();s.stopThrow();s.justDragged=false;s.snapAttachment=null;window.petPreferences.snapMode='none';window.petPreferences.disableRoaming=true;
    s.sendBounds(400,300);window.sizeTest={a:s.videoA,b:s.videoB,center:s.pos.x+s.halfW,feet:s.pos.y+s.height};
    s.onContextMenu({preventDefault(){},clientX:300,clientY:300});
    [...document.querySelectorAll('.dsh-pet-menu-item')].find(e=>e.textContent.includes('调整大小')).dispatchEvent(new Event('mouseenter'));
    document.querySelector('.dsh-pet-menu-size input[type=number]').focus();
  })()`);
  await sleep(150);
  const frame=pet.getContentBounds(),id=pet.id;
  const read=()=>run(`(()=>{const s=sprites[0],p=document.querySelector('.dsh-pet-menu-size');return {
    size:s.size,numeric:Number(p.querySelector('[type=number]').value),slider:Number(p.querySelector('[type=range]').value),
    menu:s.menuOpen,center:s.pos.x+s.halfW,feet:s.pos.y+s.height,sameVideos:s.videoA===sizeTest.a&&s.videoB===sizeTest.b,
    scroll:p.scrollWidth>p.clientWidth||p.parentElement.scrollHeight>p.parentElement.clientHeight,
    position:{x:p.getBoundingClientRect().x,y:p.getBoundingClientRect().y}
  };})()`);
  const before=await read();
  const sliderRect=await run(`(()=>{const r=document.querySelector('.dsh-pet-menu-size [type=range]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()`);
  const zoom=pet.webContents.getZoomFactor();
  const point=f=>({x:Math.round((sliderRect.x+sliderRect.w*f)*zoom),y:Math.round((sliderRect.y+sliderRect.h/2)*zoom)});
  pet.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point(.25)});
  pet.webContents.sendInputEvent({type:'mouseMove',button:'left',...point(.75)});
  await sleep(260);
  assert.equal((await read()).menu,true,'range drag keeps menu open past mouseleave timeout');
  pet.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point(.75)});
  await sleep(150);
  const dragged=await read();
  assert.ok(dragged.size>650&&dragged.size<800,'native mouse input adjusts the slider: '+dragged.size);
  for(const size of [180,900,527]){
    await run(`(async()=>{const slider=document.querySelector('.dsh-pet-menu-size [type=range]');slider.value=${size};slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new Event('change'));await Promise.resolve();await sprites[0].sizeSaving;})()`);
    await sleep(80);
    const state=await read();
    assert.equal(state.size,size);assert.equal(state.numeric,size);assert.equal(state.slider,size);
    assert.equal(state.menu,true);assert.equal(state.sameVideos,true);assert.equal(state.scroll,false);
    assert.ok(Math.abs(state.center-before.center)<=1&&Math.abs(state.feet-before.feet)<=1);
    assert.deepEqual(state.position,before.position);assert.deepEqual(pet.getContentBounds(),frame);assert.equal(pet.id,id);
  }
  const draft=await settings.webContents.executeJavaScript(`({size:main.pets[0].size,number:Number(document.querySelector('.pet-size [type=number]').value),name:main.pets[0].name,url:document.querySelector('#apiBaseUrl').value})`);
  assert.deepEqual(draft,{size:527,number:527,name:'Unsaved size-test name',url:'https://unsaved.example/v1'});
  await run(`(async()=>{
    const n=document.querySelector('.dsh-pet-menu-size [type=number]');n.value=1200;n.dispatchEvent(new Event('change'));await Promise.resolve();await sprites[0].sizeSaving;
  })()`);
  assert.equal((await read()).size,900);
  await run(`(()=>{const n=document.querySelector('.dsh-pet-menu-size [type=number]');n.value='';n.dispatchEvent(new Event('change'));})()`);
  assert.equal((await read()).numeric,900);
  await run(`(async()=>{document.querySelector('.dsh-pet-menu-size button').click();await Promise.resolve();await sprites[0].sizeSaving;})()`);
  const reset=await read();
  assert.equal(reset.size,462);assert.equal(reset.numeric,462);assert.equal(reset.slider,462);assert.equal(reset.menu,true);
  assert.deepEqual(reset.position,before.position);assert.equal(reset.sameVideos,true);
  assert.equal(await settings.webContents.executeJavaScript('main.pets[0].size'),462);
  assert.equal((await fetch(service.base+'/config').then(r=>r.json())).main.pets[0].size,462);
  await run(`(async()=>{
    const real=window.fetch;window.fetch=(url,...args)=>url.endsWith('/config/size')?Promise.resolve(new Response(JSON.stringify({error:'fixture failure'}),{status:500})):real(url,...args);
    const n=document.querySelector('.dsh-pet-menu-size [type=number]');n.value=530;n.dispatchEvent(new Event('input'));n.dispatchEvent(new Event('change'));
    await Promise.resolve();await sprites[0].sizeSaving.catch(()=>{});window.fetch=real;await new Promise(r=>setTimeout(r,30));
  })()`);
  assert.equal((await read()).size,462);
  assert.match(await run(`document.querySelector('.dsh-pet-menu-size-status').textContent`),/保存失败/);
  await run(`(async()=>{
    const n=document.querySelector('.dsh-pet-menu-size [type=number]');n.value=420;n.dispatchEvent(new Event('input'));n.dispatchEvent(new Event('change'));await Promise.resolve();await sprites[0].sizeSaving;
  })()`);
  await sleep(100);
  fs.writeFileSync(path.join(__dirname,'../qa-output/pet-menu-size.png'),(await pet.webContents.capturePage()).toPNG());
  await run(`(async()=>{const n=document.querySelector('.dsh-pet-menu-size [type=number]');n.value=480;n.dispatchEvent(new Event('input'));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();await sprites[0].sizeSaving;})()`);
  assert.equal(await run('sprites[0].menuOpen'),false);
  let config=await fetch(service.base+'/config').then(r=>r.json());
  assert.equal(config.main.pets[0].size,480);
  for(const corner of ['left','right']){
    const fits=await run(`(()=>{
      const s=sprites[0],a=AREAS[0];s.resizePet(180);s.sendBounds(${corner==='left'?'a.x-s.sideAllow':'a.x+a.width-s.size+s.sideAllow'},a.y+a.height-s.winH);
      s.onContextMenu({preventDefault(){},clientX:s.margin.l+s.halfW,clientY:s.margin.t+s.halfH});
      [...document.querySelectorAll('.dsh-pet-menu-item')].find(e=>e.textContent.includes('调整大小')).dispatchEvent(new Event('mouseenter'));
      const c=s.visibleClampRect(),panels=[...document.querySelectorAll('.dsh-pet-menu-column')].filter(e=>e.style.display==='block');
      const ok=panels.every(e=>{const r=e.getBoundingClientRect();return r.left>=c.x&&r.top>=c.y&&r.right<=c.x+c.w&&r.bottom<=c.y+c.h&&e.scrollHeight<=e.clientHeight;});s.closeMenu();s.resizePet(480);return ok;
    })()`);
    assert.equal(fits,true,corner+' screen edge keeps both menu panels visible');
  }
  assert.equal(await settings.webContents.executeJavaScript(`window.PetSettingsAutosave.flush()`),true);
  config=await fetch(service.base+'/config').then(r=>r.json());
  assert.equal(config.main.pets[0].size,480);assert.equal(config.main.pets[0].name,'Unsaved size-test name');
  await sleep(650);
  const rebuilt=require('../runtime/main.js').getPetWindows()[0];
  assert.equal(await rebuilt.webContents.executeJavaScript('sprites[0].size'),480,'new renderer uses saved size instead of resetting to default');
  // Restore the fixture for the rest of the suite. Config save intentionally rebuilds the pet.
  config.main.pets[0].size=original.size;config.main.pets[0].name=originalName;
  await fetch(service.base+'/config',{method:'PUT',body:JSON.stringify(config.main)});
  await settings.webContents.executeJavaScript(`api('/config').then(c=>{main=c.main;render();document.querySelector('#apiBaseUrl').value='';})`);
  await sleep(700);
};
