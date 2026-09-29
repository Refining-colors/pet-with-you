const test=require('node:test');
const assert=require('node:assert/strict');
const {spriteHitRect,decideWindowIgnore}=require('../runtime/pointer-target.js');

test('pointer fallback follows the actual body inside a reserved transparent frame',()=>{
  for(const scale of [1,1.25,1.5,2])for(const size of [180,462,900]){
    const bounds={x:-1200,y:80,width:1362*scale,height:1182*scale};
    const geometry={size:size*scale,left:(681-size/2)*scale,top:(710-size*9/16)*scale,bottomPad:size*9/16/12*scale};
    const body=spriteHitRect(bounds,geometry);
    assert.ok(body.left>=bounds.x&&body.right<=bounds.x+bounds.width);
    assert.ok(body.top>=bounds.y&&body.bottom<=bounds.y+bounds.height);
    const center={x:(body.left+body.right)/2,y:(body.top+body.bottom)/2};
    assert.equal(decideWindowIgnore(bounds,center,true,false,geometry),false);
    const transparent={x:bounds.x+10,y:bounds.y+10};
    assert.equal(decideWindowIgnore(bounds,transparent,false,false,geometry),true,'transparent reserve cannot intercept clicks');
    assert.equal(decideWindowIgnore(bounds,transparent,true,true,geometry),false,'menu controls retain input');
    assert.equal(decideWindowIgnore(bounds,{x:-5000,y:-5000},true,true,geometry),false,'drag keeps pointer input outside window');
  }
});
