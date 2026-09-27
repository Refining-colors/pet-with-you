const path=require('node:path');
const {execFile}=require('node:child_process');
function launchDetached(executable,args=[],cwd=path.dirname(executable)){
  if(process.platform!=='win32')throw new Error('独立启动目前仅支持 Windows');
  const quote=value=>'"'+String(value).replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';
  return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'launch-detached.ps1'),'-Executable',executable,'-Arguments',args.map(quote).join(' '),'-WorkingDirectory',cwd],{windowsHide:true,timeout:15000},error=>error?reject(new Error('Windows 独立启动失败，请检查程序路径与系统脚本权限。')):resolve()));
}
module.exports={launchDetached};
