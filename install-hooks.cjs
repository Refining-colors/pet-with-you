const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
function installHooks(options){
const dir=process.env.CODEX_HOME||path.join(os.homedir(),'.codex');
fs.mkdirSync(dir,{recursive:true});
const target=path.join(dir,'hooks.json');
const current=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{hooks:{}};
current.hooks ||= {};
const {hookCommand,ownsHook}=require('./hook-command.cjs');
const {command}=hookCommand(options);
const events=['UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','PreCompact','PostCompact','Stop','Interrupt','SessionEnd'];
const before=JSON.stringify(current);
// Replace only this installation's obsolete definitions; keep other integrations.
for(const event of Object.keys(current.hooks)){
  let kept=false;
  current.hooks[event]=current.hooks[event].map(g=>({...g,hooks:(g.hooks||[]).filter(h=>{
    if(!ownsHook(h.command,options?.root))return true;
    if(h.command!==command||kept||!events.includes(event))return false;
    kept=true;return true;
  })})).filter(g=>g.hooks.length);
  if(!current.hooks[event].length)delete current.hooks[event];
}
for(const event of events){
  current.hooks[event] ||= [];
  const own=current.hooks[event].flatMap(g=>g.hooks||[]).find(h=>h.command===command);
  if(!own)current.hooks[event].push({hooks:[{type:'command',command,timeout:2,async:event!=='SessionEnd'}]});
}
if(JSON.stringify(current)!==before){
  if(fs.existsSync(target))fs.copyFileSync(target,target+'.pet-backup-'+Date.now());
  fs.writeFileSync(target,JSON.stringify(current,null,2));
}
return target;
}
module.exports={installHooks};
if(require.main===module)console.log('Hooks ready for review: '+installHooks());
