const {spawn}=require('node:child_process');
const {locateCodex}=require('./codex-client.cjs');
console.log('Type /hooks in Codex to review the pet-with-you command hooks.');
const env={...process.env,TERM:'xterm-256color'};
delete env.ELECTRON_RUN_AS_NODE;
let child;
try {
  child=spawn(locateCodex(),['--no-alt-screen','-c','features.hooks=true'],{stdio:'inherit',cwd:__dirname,env});
  child.on('error',error=>{console.error('Unable to start bundled Codex CLI:',error.message);process.exitCode=1;});
  child.on('exit',code=>process.exitCode=code||0);
} catch(error) { console.error('Unable to start bundled Codex CLI:',error.message); process.exitCode=1; }
