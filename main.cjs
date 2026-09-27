const { app, Tray, nativeImage, BrowserWindow, Notification, shell, safeStorage, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./server.cjs');
const {WindowPolicy}=require('./window-policy.cjs');
const developmentPreview=process.env.PET_DEV_MODE==='1';
if(developmentPreview){
  const environment=require('./scripts/dev-env.cjs').developmentEnvironment(__dirname);
  for(const key of Object.keys(process.env))if(!(key in environment))delete process.env[key];
  Object.assign(process.env,environment);
}
if ((process.env.PET_INTEGRATION_VERIFY==='1'||process.env.PET_DEMO_RECORD==='1')&&!process.env.PET_TEST_DATA_DIR) {
  throw new Error('Use scripts/run-isolated.cjs: testing and recording require a temporary data directory.');
}

process.env.DSH_PET_STANDALONE='1';
delete process.env.DSH_PET_HOST_PID;
const { PRODUCT_NAME, MAINTAINER, REPOSITORY_URL, MAINTAINER_URL, UPSTREAM_URL, dataDirectory } = require('./project.cjs');
app.setName(PRODUCT_NAME);
const dataDir=dataDirectory(app.getPath('appData'));
app.setPath('userData',dataDir);
app.disableHardwareAcceleration();
if(!app.requestSingleInstanceLock()){app.quit();}else{
  let service,tray,settings,policy,runtimeStarted=false,trayVisible=true;
  let startupSignature='',quitApproved=false,quitSaving=false;
  async function flushSettings(){
    if(!settings||settings.isDestroyed())return true;
    if(settings.webContents.isLoadingMainFrame())await new Promise(resolve=>settings.webContents.once('did-stop-loading',resolve));
    if(settings.isDestroyed())return true;
    try{return await settings.webContents.executeJavaScript('window.PetSettingsAutosave ? window.PetSettingsAutosave.flush() : false');}
    catch{if(!settings.isDestroyed())dialog.showErrorBox('设置未保存','自动保存未完成，设置窗口仍保留，请稍后重新关闭。');return false;}
  }
  const lifecycle=new (require('./client-lifecycle.cjs').ClientLifecycle)();
  function syncLifecycle(next){
    if(developmentPreview){require('./scripts/dev-env.cjs').assertDevelopmentPreferences(next);return;}
    if(process.env.PET_INTEGRATION_VERIFY==='1'||process.env.PET_DEMO_RECORD==='1')return;
    const signature=JSON.stringify([next.autostart,next.mode,next.followClientStart]);
    if(signature!==startupSignature){
      require('./autostart.cjs').syncStartup({dataDir,preferences:next,executable:process.execPath,root:__dirname,packaged:app.isPackaged});
      startupSignature=signature;
    }
    if(next.mode!=='connected'||!next.followClientClose)lifecycle.reset();
  }
  async function showAbout(){
    const result=await dialog.showMessageBox({type:'info',title:PRODUCT_NAME,message:PRODUCT_NAME,
      detail:`维护者：${MAINTAINER}\n${REPOSITORY_URL}\n\n独立桌面陪伴与 Codex 任务联动。\n来源与致谢：基于 PC2005-cloud/dsh-pet 改造，原角色与动画来自上游；素材非商用。\n${UPSTREAM_URL}`,
      buttons:['项目主页','来源与致谢','关闭'],defaultId:2,cancelId:2});
    if(result.response===0)await shell.openExternal(REPOSITORY_URL);
    if(result.response===1)await shell.openExternal(UPSTREAM_URL);
  }
  function trayItems(){const items=[
    {label:'打开桌宠控制台',click:openSettings},
    ...(service?.preferences.value.mode==='connected'?[{label:'检查客户端联动',click:()=>prepareConnection().catch(console.error)}]:[]),
    {label:'显示宠物',click:()=>policy?.setManualHidden(false)},
    {label:'隐藏宠物',click:()=>policy?.setManualHidden(true)},
    {label:'隐藏托盘图标',click:()=>setTrayVisible(false)},{label:'打开配置与宠物素材目录',click:()=>shell.openPath(dataDir)},
    {type:'separator'},{label:'关于 pet-with-you',click:()=>showAbout().catch(console.error)},{label:'退出桌宠',click:()=>app.quit()}];return items;}
  const largeTrayMenu=new (require('./tray-menu.cjs').TrayMenu)({dataDir,getItems:trayItems});
  function setTrayVisible(value){
    trayVisible=value;
    try{fs.writeFileSync(path.join(dataDir,'tray-state.json'),JSON.stringify({visible:value}));}catch{}
    if(value){if(!tray||tray.isDestroyed()){tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'tray.png')).resize({width:24,height:24}));tray.on('double-click',openSettings);tray.on('right-click',()=>largeTrayMenu.show());}tray.setToolTip(PRODUCT_NAME+(developmentPreview?' · 开发预览':'')+' · 随机播放 / 右键点播');}
    else if(tray&&!tray.isDestroyed()){tray.destroy();tray=null;}
  }
  function startPets(){if(!runtimeStarted){runtimeStarted=true;process.env.PET_CONNECT_ONLY='0';require('./runtime/main.js').recreate();}}
  async function prepareConnection(){await fetch(service.base+'/connect',{method:'POST'});openSettings();}
  function reviewHooks(){
    if(developmentPreview)throw new Error('开发预览不审阅日常客户端 Hooks；请使用隔离测试验证联动。');
    return shell.openPath(path.join(__dirname,'Review-Hooks.cmd')).then(error=>{if(error)throw new Error(error);});
  }
  function openSettings(){
    if(settings&&!settings.isDestroyed()){settings.show();settings.focus();return;}
    settings=new BrowserWindow({width:940,height:760,title:'桌宠控制台',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
    if(developmentPreview){settings.setTitle('桌宠控制台 · 开发预览');settings.on('page-title-updated',event=>event.preventDefault());}
    const window=settings;let closeApproved=false,closing=false;
    window.on('close',event=>{
      if(closeApproved||quitApproved)return;
      event.preventDefault();if(closing||quitSaving)return;
      closing=true;
      flushSettings().then(ok=>{if(ok&&!window.isDestroyed()){closeApproved=true;window.close();}}).finally(()=>{closing=false;});
    });
    settings.webContents.setWindowOpenHandler(({url})=>{if([REPOSITORY_URL,MAINTAINER_URL,UPSTREAM_URL].includes(url))shell.openExternal(url);return {action:'deny'};});
    settings.loadURL(service.base+'/settings');
  }
  app.on('pet-open-settings',openSettings);
  app.on('pet-show-request',win=>{if(policy)policy.requestShow(win);else win.showInactive();});
  startServer({dataDir,defaultMode:'pet',monitorSessions:process.env.PET_INTEGRATION_VERIFY!=='1'&&process.env.PET_DEMO_RECORD!=='1',
    async onOpenThread(id){await shell.openExternal('codex://threads/'+encodeURIComponent(id));},
    async onLogsOpen(directory){const error=await shell.openPath(directory);if(error)throw new Error('无法打开日志目录');},
    async onLogsExport(content){
      const result=await dialog.showSaveDialog({title:'导出桌宠错误日志',defaultPath:path.join(app.getPath('documents'),'pet-with-you-errors-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),filters:[{name:'错误日志',extensions:['json']}]});
      if(result.canceled||!result.filePath)return {canceled:true};
      await fs.promises.writeFile(result.filePath,content,'utf8');return {ok:true};
    },onChange(config){
    process.env.DSH_PET_PETS=JSON.stringify(Object.values(config).flatMap(c=>c.pets).filter(p=>['desktop','both'].includes(p.display)));
    if(runtimeStarted)require('./runtime/main.js').recreate();
  },onPreferences(next,rebuild){
    syncLifecycle(next);
    if(runtimeStarted&&rebuild)require('./runtime/main.js').recreate();
    policy?.apply();
    for(const w of BrowserWindow.getAllWindows())if(w!==settings&&!w.isDestroyed())w.webContents.send('pet:preferences',next);
    largeTrayMenu.close();
  },onChooseRuntime:async()=>{const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Codex',extensions:['exe']}]});if(r.canceled)return {canceled:true};require('./codex-client.cjs').saveRuntime(r.filePaths[0]);return {ok:true};},onReview:reviewHooks,onTray:value=>setTrayVisible(value),onFontImport:async()=>{const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'字体文件',extensions:['ttf','otf']}]});return r.canceled?null:r.filePaths[0];},protect(value){if(!safeStorage.isEncryptionAvailable())throw new Error('系统密钥保护不可用');return safeStorage.encryptString(value).toString('base64');},unprotect(value){return safeStorage.decryptString(Buffer.from(value,'base64'));},onNotify(text){if(!BrowserWindow.getFocusedWindow()&&Notification.isSupported())new Notification({title:PRODUCT_NAME,body:text}).show();}}).then(s=>{
    service=s;
    process.env.DSH_PET_CONFIG_URL=s.base+'/config';
    process.env.DSH_PET_PETS=JSON.stringify(Object.values(s.config).flatMap(c=>c.pets).filter(p=>['desktop','both'].includes(p.display)));
    process.env.DSH_PET_SCALE_CACHE=path.join(dataDir,'scale.json');
    runtimeStarted=!process.argv.includes('--connect-only');
    process.env.PET_CONNECT_ONLY=runtimeStarted?'0':'1';
    require('./runtime/main.js');
    app.whenReady().then(()=>{
      policy=new WindowPolicy({getWindows:()=>BrowserWindow.getAllWindows().filter(w=>w!==settings&&!w.isPetTrayMenu),getPreferences:()=>service.preferences.value,onState:state=>{
        if(typeof state.clientRunning==='boolean'){
          require('./runtime/main.js').setSnapTarget(state.clientWindows||[]);
          const p=service.preferences.value;
          if(lifecycle.update(p,state.clientRunning))app.quit();
        }
      }});
      if(process.env.PET_DEMO_RECORD!=='1')policy.start();
      syncLifecycle(service.preferences.value);
      let trayState=true;try{trayState=JSON.parse(fs.readFileSync(path.join(dataDir,'tray-state.json'),'utf8')).visible!==false;}catch{}
      setTrayVisible(trayState);
      if(process.env.PET_DEMO_RECORD==='1')require('./scripts/record-demo.cjs')({service});
      if(process.env.PET_INTEGRATION_VERIFY==='1')require('./test/desktop-verify.cjs')({service,openSettings,getSettings:()=>settings,largeTrayMenu});
      if(process.argv.includes('--settings'))openSettings();
      if(process.argv.includes('--connect')||process.argv.includes('--connect-only'))prepareConnection().catch(console.error);

    });
    app.on('second-instance',(_event,args)=>{
      if(!args.includes('--connect-only'))startPets();
      if(args.includes('--connect')||args.includes('--connect-only'))prepareConnection().catch(console.error);
      if(!args.includes('--background'))openSettings();
    });
    app.on('before-quit',event=>{
      if(!quitApproved&&settings&&!settings.isDestroyed()){
        event.preventDefault();if(quitSaving)return;quitSaving=true;
        flushSettings().then(ok=>{if(ok){quitApproved=true;app.quit();}else if(settings&&!settings.isDestroyed()){settings.show();settings.focus();}}).finally(()=>{quitSaving=false;});
        return;
      }
      largeTrayMenu.close();policy?.close();service.close();
    });
  }).catch(e=>{console.error(e);app.exit(1);});
}
