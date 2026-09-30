const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/shared-core.js'),'utf8'),context);const S=context.PetShared;
test('zero restitution stops outward motion at edges without disabling throws or crossing adjacent displays',()=>{
  const area={x:0,y:0,width:1000,height:1000},space=S.throwSpace({areas:[area],panels:[area],size:200,sideAllow:0});
  const b=space.bounds[0],physics={...S.DEFAULT_PHYSICS,restitution:0};
  for(const [state,axis,bound] of [
    [{x:b.minX,y:300,vx:-500,vy:0},'vx','minX'],
    [{x:b.maxX,y:300,vx:500,vy:0},'vx','maxX'],
    [{x:300,y:b.minY,vx:0,vy:-500},'vy','minY'],
    [{x:300,y:b.maxY,vx:0,vy:500},'vy','maxY']
  ]){
    const result=S.throwStepRegion(state,.02,space,physics);
    assert.equal(Math.abs(result[axis]),0);assert.equal(result[axis==='vx'?'x':'y'],b[bound]);
    assert.ok(Math.abs(S.throwStepRegion(state,.02,space,S.DEFAULT_PHYSICS)[axis])>0);
  }
  const free=S.throwStepRegion({x:300,y:300,vx:500,vy:-500},.02,space,physics);
  assert.ok(free.x>300&&free.y<300,'throw continues away from boundaries');
  const adjacent={...area,x:1000};const two=S.throwSpace({areas:[area,adjacent],panels:[area,adjacent],size:200,sideAllow:0});
  const crossing=S.throwStepRegion({x:850,y:300,vx:500,vy:0},.02,two,physics);
  assert.equal(crossing.vx,500);assert.ok(crossing.x>850,'monitor seam is not a wall');
});
