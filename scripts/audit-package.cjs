const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'dist/win-unpacked/resources/app');
const forbidden=/(^|\/)(?:\.git|\.local|node_modules|qa-output|media-output|legacy-settings)(\/|$)|(^|\/)(?:credentials\.local\.json|settings\.json|config\.toml|auth\.json|connection\.json|client-launcher\.local\.json|\.env)(?:$|\.)|\.(?:log|ttf|otf|pem|key)$/i;
const token=/\b(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{32,})\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
let count=0;
function visit(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,item.name),name=path.relative(root,file).split(path.sep).join('/');
  assert.ok(!item.isSymbolicLink(),'Unexpected package symlink: '+name);
  assert.ok(!forbidden.test(name),'Private/development data or unbundled font: '+name);
  if(item.isDirectory()){visit(file);continue;}
  count++;
  if(/\.(?:cjs|js|json|jsonc|html|md|txt|ps1|cmd|vbs)$/i.test(name))assert.ok(!token.test(fs.readFileSync(file,'utf8')),'Credential pattern in: '+name);
 }
}
visit(root);
assert.equal(require(path.join(root,'package.json')).version,require('../package.json').version);
for(const name of ['LICENSE','LICENSE.upstream','ATTRIBUTION.md','build/icon.ico','build/codex-withu.ico'])assert.ok(fs.existsSync(path.join(root,name)),name+' missing');
assert.equal(fs.readdirSync(path.join(root,'assets/webm')).filter(x=>x.endsWith('.webm')).length,106);
console.log(JSON.stringify({result:'PASS',files:count,version:require('../package.json').version,scope:'Packaged application inventory and credential patterns; fonts, personal data and media experiments excluded'}));
