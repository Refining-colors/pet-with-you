const fs=require('node:fs');
let executable;
try { executable=require('electron');if(!fs.existsSync(executable))throw new Error(); }
catch { console.error('请先双击 Install-Pet.cmd 安装依赖，再启动 pet-with-you。');process.exit(1); }
require('./detached-launch.cjs').launchDetached(executable,[__dirname,'--pet-node-exe='+process.execPath,...process.argv.slice(2)],__dirname).then(()=>console.log('已交由 Windows 独立启动。')).catch(error=>{console.error(error.message);process.exitCode=1;});
