const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
function locateNode(){
  if(process.env.PET_NODE_EXE&&fs.existsSync(process.env.PET_NODE_EXE))return process.env.PET_NODE_EXE;
  if(!process.versions.electron)return process.execPath;
  try{const lines=execFileSync(process.platform==='win32'?'where.exe':'which',['node'],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/);const found=lines.find(p=>fs.existsSync(p));if(found)return found;}catch{}
  throw new Error('源码版的 Hooks 需要 Node.js，请安装 Node.js 22.12 或以上并重新启动桌宠');
}
module.exports={locateNode};
