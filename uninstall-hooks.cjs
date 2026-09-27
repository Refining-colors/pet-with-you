const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const target=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'hooks.json');
if(!fs.existsSync(target))process.exit(0);
const marker=path.join(__dirname,'hook.cjs').replaceAll('\\','/');
const current=JSON.parse(fs.readFileSync(target,'utf8'));
fs.copyFileSync(target,target+'.pet-backup-'+Date.now());
for(const event of Object.keys(current.hooks||{})){
  current.hooks[event]=current.hooks[event].map(g=>({...g,hooks:(g.hooks||[]).filter(h=>!h.command?.includes(marker))})).filter(g=>g.hooks.length);
  if(!current.hooks[event].length)delete current.hooks[event];
}
fs.writeFileSync(target,JSON.stringify(current,null,2));
console.log('Removed only pet-with-you hooks.');
