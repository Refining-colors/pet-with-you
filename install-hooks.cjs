const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
function installHooks(){
const dir=process.env.CODEX_HOME||path.join(os.homedir(),'.codex');
fs.mkdirSync(dir,{recursive:true});
const target=path.join(dir,'hooks.json');
const marker=path.join(__dirname,'hook.cjs').replaceAll('\\','/');
const current=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{hooks:{}};
current.hooks ||= {};
const command='"'+require('./node-runtime.cjs').locateNode().replaceAll('\\','/')+'" "'+marker+'"';
const events=['UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','PreCompact','PostCompact','Stop','Interrupt','SessionEnd'];
const before=JSON.stringify(current);
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
