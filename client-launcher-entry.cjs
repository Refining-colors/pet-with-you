const {app,dialog}=require('electron');
const path=require('node:path');
const dataDir=require('./project.cjs').dataDirectory(app.getPath('appData'));
app.setName('pet-with-you-launcher');
app.setPath('userData',path.join(dataDir,'launcher-cache'));
app.whenReady().then(async()=>{
  try{await require('./client-launcher.cjs').launchLinkedClient({dataDir,packaged:app.isPackaged,nodeExecutable:process.argv.find(value=>value.startsWith('--pet-node-exe='))?.slice('--pet-node-exe='.length)});}
  catch(error){dialog.showErrorBox('联动启动未完成',error.message);}
  finally{app.exit(0);}
});
