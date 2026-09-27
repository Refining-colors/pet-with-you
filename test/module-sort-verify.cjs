const assert=require('node:assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function(settings,service){
  const run=code=>settings.webContents.executeJavaScript(code);
  const order=()=>run(`modules(document.querySelector('#basicPanel')).map(e=>e.id)`);
  const position=async(source,target,after)=>run(`(()=>{
    const source=document.getElementById(${JSON.stringify(source)}),target=document.getElementById(${JSON.stringify(target)});
    const h=source.querySelector('.module-handle').getBoundingClientRect(),r=target.getBoundingClientRect();
    return {x:Math.round(h.left+h.width/2),y:Math.round(h.top+h.height/2),endY:Math.round(r.top+${after?'Math.min(70,r.height/2)+12':'16'})};
  })()`);
  const mouse=(type,p)=>settings.webContents.sendInputEvent({type,...p});
  async function begin(p){
    mouse('mouseMove',{x:p.x,y:p.y});mouse('mouseDown',{x:p.x,y:p.y,button:'left',clickCount:1});
    for(let i=1;i<=12;i++){mouse('mouseMove',{x:p.x,y:Math.round(p.y+(p.endY-p.y)*i/12),modifiers:['leftButtonDown']});await sleep(12);}
    assert.equal(await run(`moduleDrag?.started===true&&moduleDrag.handle.hasPointerCapture(moduleDrag.pointerId)`),true,JSON.stringify(await run(`({inert:document.body.inert,scroll:scrollY,drag:moduleDrag?{started:moduleDrag.started,y:moduleDrag.y}:null,hit:document.elementFromPoint(${p.x},${p.y})?.outerHTML.slice(0,200)})`)));
  }
  await run(`selectTab('basic');document.querySelector('#recentErrorsSection').scrollIntoView()`);await sleep(150);
  assert.equal(await run(`getComputedStyle(document.querySelector('.module-handle')).cursor`),'default');
  const initial=await order(),p=await position('recentErrorsSection','basicModule0',true);
  await begin(p);assert.deepEqual(await order(),initial,'drag must not detach or reorder the captured handle');
  mouse('mouseUp',{x:p.x,y:p.endY,button:'left',clickCount:1});await sleep(80);await run('orderSaving');
  const down=await order();assert.ok(down.indexOf('recentErrorsSection')>down.indexOf('basicModule0'));
  assert.deepEqual(service.preferences.value.moduleOrder.basic,down);
  await run(`document.querySelector('#basicModule0').scrollIntoView()`);await sleep(120);
  const q=await position('recentErrorsSection','basicModule0',false);await begin(q);
  mouse('mouseUp',{x:q.x,y:q.endY,button:'left',clickCount:1});await sleep(80);await run('orderSaving');
  assert.deepEqual(await order(),initial,'upward mouse drag restores the original order');
  await run(`document.querySelector('#recentErrorsSection').scrollIntoView()`);await sleep(120);
  const cancel=await position('recentErrorsSection','basicModule0',true);await begin(cancel);
  settings.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});settings.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  mouse('mouseUp',{x:cancel.x,y:cancel.endY,button:'left',clickCount:1});await sleep(80);
  assert.deepEqual(await order(),initial);assert.equal(await run(`moduleDrag===null&&!document.querySelector('.module-drag-preview')`),true);
  // Hold at the viewport edge without further mouse moves to exercise continuous scrolling.
  await run(`document.querySelector('#recentErrorsSection').scrollIntoView()`);await sleep(120);
  const edge=await position('recentErrorsSection','basicModule0',true);edge.endY=await run('innerHeight-12');
  await begin(edge);const before=await run('scrollY');await sleep(450);assert.ok(await run('scrollY')>before+60);
  settings.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});mouse('mouseUp',{x:edge.x,y:edge.endY,button:'left',clickCount:1});
  await run(`document.querySelector('#recentErrorsSection').scrollIntoView()`);await sleep(120);
  const click=await position('recentErrorsSection','basicModule0',true);
  mouse('mouseDown',{x:click.x,y:click.y,button:'left',clickCount:1});mouse('mouseUp',{x:click.x,y:click.y,button:'left',clickCount:1});await sleep(50);
  assert.equal(await run('moduleDrag===null'),true);assert.deepEqual(await order(),initial);
};
