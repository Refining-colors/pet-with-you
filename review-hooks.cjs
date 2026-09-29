const {spawn}=require('node:child_process');
const {locateCodex}=require('./codex-client.cjs');
const args=['--no-alt-screen','-c','features.hooks=true'];
const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
function startReview({locate=locateCodex,spawnProcess=spawn,tty=!!process.stdin.isTTY}={}){
  const executable=locate();
  const env={...process.env,TERM:'xterm-256color'};
  delete env.ELECTRON_RUN_AS_NODE;
  if(tty)return spawnProcess(executable,args,{stdio:'inherit',cwd:__dirname,env});
  // shell.openPath starts the .cmd without a console. Allocate a real Windows
  // console so the Codex TUI receives a terminal instead of "stdin is not a terminal".
  if(process.platform==='win32'){
    const command=['start','"pet-with-you Hooks"','/wait',quote(executable),...args.map(quote)].join(' ');
    return spawnProcess(process.env.ComSpec||'cmd.exe',['/d','/c',command],{stdio:'ignore',cwd:__dirname,env,windowsHide:false});
  }
  return spawnProcess(executable,args,{stdio:'inherit',cwd:__dirname,env});
}
function main(){
  console.log('Type /hooks in Codex to review the pet-with-you command hooks.');
  try{const child=startReview();child.on('error',error=>{console.error('Unable to start Codex CLI:',error.message);process.exitCode=1;});child.on('exit',code=>process.exitCode=code||0);}
  catch(error){console.error('Unable to start Codex CLI:',error.message);process.exitCode=1;}
}
if(require.main===module)main();
module.exports={args,quote,startReview};
