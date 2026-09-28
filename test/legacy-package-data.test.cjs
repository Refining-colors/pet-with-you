const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { importLegacyPackageData } = require('../legacy-package-data.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-package-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const localAppData = path.join(root, 'local'), target = path.join(root, 'roaming', 'DSH Pet Companion');
  const source = path.join(localAppData, 'Packages', 'Fixture.Editor_123', 'LocalCache', 'Roaming', 'DSH Pet Companion');
  fs.mkdirSync(source, { recursive: true });
  return { source, target, localAppData };
}
test('MSIX settings migration retains keys, fonts and launch settings but excludes runtime and login files', t => {
  const {source,target,localAppData}=fixture(t);
  for(const name of ['preferences.json','api-settings.json','client-launcher.local.json','connection.json','auth.json'])fs.writeFileSync(path.join(source,name),'{"fixture":true}');
  fs.mkdirSync(path.join(source,'fonts'));fs.writeFileSync(path.join(source,'fonts','fixture.ttf'),'fixture');
  assert.deepEqual(importLegacyPackageData(target,{localAppData}),{imported:true});
  for(const name of ['preferences.json','api-settings.json','client-launcher.local.json','fonts/fixture.ttf'])assert.deepEqual(fs.readFileSync(path.join(target,name)),fs.readFileSync(path.join(source,name)));
  for(const name of ['connection.json','auth.json'])assert.equal(fs.existsSync(path.join(target,name)),false);
  fs.writeFileSync(path.join(target,'preferences.json'),'{"current":true}');
  assert.deepEqual(importLegacyPackageData(target,{localAppData}),{imported:false});
  assert.equal(fs.readFileSync(path.join(target,'preferences.json'),'utf8'),'{"current":true}');
});
test('MSIX migration imports a unified settings vault together and keeps destination launch choices',t=>{
  const {source,target,localAppData}=fixture(t);
  for(const name of ['settings.json','credentials.local.json'])fs.writeFileSync(path.join(source,name),'{}');
  fs.writeFileSync(path.join(source,'client-launcher.local.json'),'old');
  fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'client-launcher.local.json'),'current');
  importLegacyPackageData(target,{localAppData});
  assert.ok(fs.existsSync(path.join(target,'credentials.local.json')));
  assert.equal(fs.readFileSync(path.join(target,'client-launcher.local.json'),'utf8'),'current');
  assert.ok(fs.existsSync(path.join(source,'settings.json')),'legacy source remains a rollback copy');
});
test('multiple MSIX sources are not silently mixed or chosen arbitrarily',t=>{
  const {source,target,localAppData}=fixture(t);
  fs.writeFileSync(path.join(source,'preferences.json'),'{}');
  const other=source.replace('Fixture.Editor_123','Fixture.Other_456');fs.mkdirSync(other,{recursive:true});fs.writeFileSync(path.join(other,'preferences.json'),'{}');
  assert.throws(()=>importLegacyPackageData(target,{localAppData}),/多份/);
  assert.equal(fs.existsSync(target),false);
});
