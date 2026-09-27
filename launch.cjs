const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
let executable;
try { executable=require('electron');if(!fs.existsSync(executable))throw new Error(); }
catch { console.error('请先双击 Install-Pet.cmd 安装依赖，再启动 pet-with-you。');process.exit(1); }
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.DSH_PET_HOST_PID;delete env.DSH_PET_BRIDGE;
env.PET_NODE_EXE=process.execPath;
const logDir=require('./project.cjs').dataDirectory();fs.mkdirSync(logDir,{recursive:true});const log=fs.openSync(path.join(logDir,'desktop.log'),'a');
const child=spawn(executable,[__dirname,'--settings',...process.argv.slice(2)],{cwd:__dirname,env,windowsHide:true,detached:true,stdio:['ignore',log,log]});
child.on('error',()=>{console.error('桌宠启动失败，请运行 Check-Setup.cmd 并检查运行日志。');process.exitCode=1;});
child.unref();
console.log('桌宠已启动。');
