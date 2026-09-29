const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('installer normalizes selected directories and uses the branded welcome/finish panel',()=>{
  const script=fs.readFileSync(path.join(__dirname,'../build/installer.nsh'),'utf8');
  const directory=fs.readFileSync(path.join(__dirname,'../build/install-directory.nsh'),'utf8');
  assert.match(script,/Page custom PetDirectoryPage/);
  assert.match(script,/customPageAfterChangeDir/);
  assert.match(directory,/Function PetNormalizeInstallDirectory/);
  assert.match(directory,/\$0 != "pet-with-you"/);
  assert.match(script,/\$\{If\} \$\{Silent\}[\s\S]*?Call PetNormalizeInstallDirectory/);
  assert.match(script,/!macro customWelcomePage/);
  assert.match(script,/!macro customFinishPage/);
  const builder=require('../electron-builder.cjs');
  assert.equal(builder.nsis.installerSidebar,'build/pet-finish.bmp');
  assert.equal(builder.nsis.allowToChangeInstallationDirectory,false);
  assert.match(script,/ManifestDPIAwareness PerMonitorV2/);
  const bitmap=fs.statSync(path.join(__dirname,'../build/pet-finish.bmp'));
  assert.ok(bitmap.size>1000,'finish bitmap must be present and non-empty');
});
