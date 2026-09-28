const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Appearance}=require('../appearance.cjs');
test('feedback font migrates independently and font import preserves both selections',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-font-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'appearance.json'),JSON.stringify({family:'SimSun',source:'system',customFonts:[]}));
  const a=new Appearance(dir);assert.equal(a.value.feedback.family,'SimSun');
  a.save({target:'feedback',family:'Microsoft YaHei',source:'system'});
  assert.equal(a.value.family,'SimSun');assert.equal(new Appearance(dir).value.feedback.family,'Microsoft YaHei');
  const file=path.join(dir,'example.ttf');fs.writeFileSync(file,Buffer.from([0,1,0,0,0,0,0,0]));
  a.importFile(file,'feedback');assert.equal(a.value.family,'SimSun');assert.equal(a.value.feedback.source,'file');
  const feedback={...a.value.feedback};a.importFile(file);assert.deepEqual(a.value.feedback,feedback);
  assert.equal(a.value.customFonts.length,1);assert.throws(()=>a.save({target:'feedback',family:'missing.ttf',source:'file'}));
});

test('an unavailable legacy bundled font falls back without breaking feedback',async()=>{
  const vm=require('node:vm');
  const context={window:{},FontFace:class{load(){return Promise.reject(new Error('not bundled'));}},document:{fonts:{add(){throw new Error('missing font cannot be registered');}}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/appearance.js'),'utf8'),context);
  const element={style:{}};
  const result=await context.window.PetAppearance.apply('http://fixture',{family:'ShangshouSoftCandy',source:'system'},[element]);
  assert.match(result,/^"SimSun"/);assert.equal(element.style.fontFamily,result);
});
