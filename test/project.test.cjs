const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');

test('product rename preserves data and isolated tests override runtime selection',t=>{
  const {PRODUCT_NAME,dataDirectory}=require('../project.cjs');
  assert.equal(PRODUCT_NAME,'pet-with-you');
  const previous=process.env.PET_TEST_DATA_DIR,previousDev=process.env.PET_DEV_DATA_DIR;delete process.env.PET_TEST_DATA_DIR;delete process.env.PET_DEV_DATA_DIR;
  t.after(()=>{if(previous===undefined)delete process.env.PET_TEST_DATA_DIR;else process.env.PET_TEST_DATA_DIR=previous;if(previousDev===undefined)delete process.env.PET_DEV_DATA_DIR;else process.env.PET_DEV_DATA_DIR=previousDev;});
  assert.equal(dataDirectory('fixture'),path.join('fixture','DSH Pet Companion'));
  process.env.PET_DEV_DATA_DIR='development';assert.equal(dataDirectory('fixture'),'development');
  process.env.PET_TEST_DATA_DIR='isolated';assert.equal(dataDirectory('fixture'),'isolated');
});

test('npm-installed Windows Codex native binary can be discovered without a shell wrapper',{skip:process.platform!=='win32'},t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-runtime-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const keys=['LOCALAPPDATA','PATH','PET_TEST_DATA_DIR','PET_CODEX_EXE'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  t.after(()=>{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];});
  process.env.LOCALAPPDATA=root;process.env.PATH=root;process.env.PET_TEST_DATA_DIR=root;delete process.env.PET_CODEX_EXE;
  const triple=process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
  const binary=path.join(root,'node_modules','@openai','codex','node_modules','@openai','codex-win32-'+process.arch,'vendor',triple,'codex','codex.exe');
  fs.mkdirSync(path.dirname(binary),{recursive:true});fs.writeFileSync(binary,'fixture only');
  assert.equal(require('../codex-client.cjs').locateCodex(),binary);
});

test('uninstall respects CODEX_HOME and preserves unrelated hooks',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pet-uninstall-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const marker=path.resolve(__dirname,'../hook.cjs').replaceAll('\\','/');
  const target=path.join(root,'hooks.json');fs.writeFileSync(target,JSON.stringify({hooks:{Stop:[{hooks:[{command:'node "'+marker+'"'},{command:'unrelated-hook'}]}]}}));
  const result=spawnSync(process.execPath,[path.resolve(__dirname,'../uninstall-hooks.cjs')],{env:{...process.env,CODEX_HOME:root},encoding:'utf8'});
  assert.equal(result.status,0);assert.deepEqual(JSON.parse(fs.readFileSync(target)).hooks.Stop,[{hooks:[{command:'unrelated-hook'}]}]);
  assert.ok(fs.readdirSync(root).some(name=>name.startsWith('hooks.json.pet-backup-')));
});
