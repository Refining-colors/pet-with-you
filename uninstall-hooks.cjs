const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const target=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'hooks.json');
if(!fs.existsSync(target))process.exit(0);
const markers=['hook.cjs','hook.cmd'].map(name=>path.join(__dirname,name).replaceAll('\\','/'));
const current=JSON.parse(fs.readFileSync(target,'utf8'));
const before=JSON.stringify(current);
for(const event of Object.keys(current.hooks||{})){
  current.hooks[event]=current.hooks[event].map(g=>({...g,hooks:(g.hooks||[]).filter(h=>!markers.some(marker=>h.command?.replaceAll('\\','/').includes(marker)))})).filter(g=>g.hooks.length);
  if(!current.hooks[event].length)delete current.hooks[event];
}
if(JSON.stringify(current)!==before){
  fs.copyFileSync(target,target+'.pet-backup-'+Date.now());
  fs.writeFileSync(target,JSON.stringify(current,null,2));
}
console.log('Removed only pet-with-you hooks.');
