const {spawn}=require('node:child_process');
const path=require('node:path');
const {locateCodex}=require('./codex-client.cjs');
const args=['--no-alt-screen','-c','features.hooks=true'];
const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
function startReview({locate=locateCodex,spawnProcess=spawn,tty=!!process.stdin.isTTY,reviewArgs=args}={}){
  const executable=locate();
  const env={...process.env,TERM:'xterm-256color'};
  delete env.ELECTRON_RUN_AS_NODE;
  if(tty)return spawnProcess(executable,reviewArgs,{stdio:'inherit',cwd:__dirname,env});
  // Start-Process creates a separate console without inheriting ignored stdin.
  // Paths and arguments travel as environment data, never interpolated shell code.
  if(process.platform==='win32'){
    env.PET_REVIEW_EXE=executable;env.PET_REVIEW_ARGS=JSON.stringify(reviewArgs.map(quote));
    const command='$ErrorActionPreference="Stop"; $reviewArgs=ConvertFrom-Json $env:PET_REVIEW_ARGS; $reviewProcess=Start-Process -FilePath $env:PET_REVIEW_EXE -ArgumentList ($reviewArgs -join " ") -WorkingDirectory $env:PET_REVIEW_CWD -WindowStyle Normal -Wait -PassThru; exit $reviewProcess.ExitCode';
    env.PET_REVIEW_CWD=__dirname;
    return spawnProcess(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-Command',command],{stdio:'ignore',cwd:__dirname,env,windowsHide:true});
  }
  return spawnProcess(executable,reviewArgs,{stdio:'inherit',cwd:__dirname,env});
}
function main(){
  console.log('Type /hooks in Codex to review the pet-with-you command hooks.');
  try{const child=startReview();child.on('error',error=>{console.error('Unable to start Codex CLI:',error.message);process.exitCode=1;});child.on('exit',code=>process.exitCode=code||0);}
  catch(error){console.error('Unable to start Codex CLI:',error.message);process.exitCode=1;}
}
if(require.main===module)main();
module.exports={args,quote,startReview};
