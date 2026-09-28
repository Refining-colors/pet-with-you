(() => {
  const launcherOutput=document.querySelector('#clientLauncherResult');
  const launcherDialog=document.querySelector('#clientLauncherDialog');
  const launcherDialogOutput=document.querySelector('#clientLauncherDialogResult');
  const launcherButtons=['createClientLauncher','createFirstClientLauncher','skipClientLauncher'].map(id=>document.getElementById(id));
  let launcherState=null,runtimeInfo=null,creatingLauncher=false;
  function maybeOfferLauncher(){
    if(currentMode!=='connected'||document.querySelector('#sourceDialog').open){if(launcherDialog.open)launcherDialog.close();return;}
    if(runtimeInfo&&!runtimeInfo.development&&launcherState&&!launcherState.prompted&&!creatingLauncher&&!launcherDialog.open)launcherDialog.showModal();
  }
  api('/runtime-info').then(value=>{runtimeInfo=value;document.querySelector('#petShortcutPreviewHint').hidden=!value.development;maybeOfferLauncher();}).catch(()=>{});
  api('/client-launcher').then(value=>{
    launcherState=value;
    launcherOutput.textContent=value.configured?'已保存客户端：'+value.name+'。可以选择目录创建 Codex withu；每次双击都同时启动客户端与桌宠。':'尚未创建联动启动器。点击上方按钮，选择客户端和保存位置。';
    maybeOfferLauncher();
  }).catch(error=>{launcherOutput.textContent='联动入口状态读取失败：'+error.message;});
  window.addEventListener('pet:connection-mode',maybeOfferLauncher);
  document.querySelector('#sourceDialog').addEventListener('close',maybeOfferLauncher);
  const shortcutButton=document.querySelector('#createPetShortcut');
  shortcutButton.addEventListener('click',async()=>{
    if(shortcutButton.disabled)return;
    shortcutButton.disabled=true;
    const output=document.querySelector('#petShortcutResult');
    try{
      if(!await window.PetSettingsAutosave.flush())return;
      output.textContent='请选择快捷方式的保存目录……';
      const value=await api('/pet-shortcut','POST');
      output.textContent=value.canceled?'已取消，未创建快捷方式。':`已创建：${value.file}。双击即可启动${value.development?'开发预览（使用独立设置）':'桌宠'}。`;
    }catch(error){output.textContent='创建失败：'+error.message;}
    finally{shortcutButton.disabled=false;}
  });
  const info=document.querySelector('#settingsFileInfo'),result=document.querySelector('#settingsFileResult');
  api('/settings-file').then(value=>{info.textContent=value.file;}).catch(error=>{result.textContent=error.message;});
  // This handler runs after autosave setup so flushing cannot wait on its own click promise.
  document.querySelector('#locateSettingsFile').addEventListener('click',async()=>{
    if(!await window.PetSettingsAutosave.flush())return;
    try{await api('/settings-file/locate','POST');result.textContent='已保存当前修改，并在文件夹中选中 settings.json。分享或覆盖前请退出桌宠。';}
    catch(error){result.textContent=error.message;}
  });
  async function createLauncher(){
    if(creatingLauncher)return;
    creatingLauncher=true;launcherButtons.forEach(button=>button.disabled=true);
    try{
      if(!await window.PetSettingsAutosave.flush())return;
      const value=await api('/client-launcher','POST');
      launcherState={...launcherState,prompted:true};
      launcherOutput.textContent=value.canceled?'已取消。以后可随时点击“创建联动启动器”。':`已创建：${value.file}。双击 Codex withu 同时启动客户端与桌宠；需要时可将此入口固定到任务栏。`;
      launcherDialogOutput.textContent='';if(launcherDialog.open)launcherDialog.close();
    }catch(error){launcherDialogOutput.textContent=launcherOutput.textContent='创建未完成：'+error.message;}
    finally{creatingLauncher=false;launcherButtons.forEach(button=>button.disabled=false);}
  }
  async function dismissLauncher(){
    if(creatingLauncher)return;
    try{await api('/client-launcher/dismiss','POST');launcherState={...launcherState,prompted:true};launcherDialog.close();}
    catch(error){launcherDialogOutput.textContent='选择未保存：'+error.message;}
  }
  document.querySelector('#createClientLauncher').addEventListener('click',createLauncher);
  document.querySelector('#createFirstClientLauncher').addEventListener('click',createLauncher);
  document.querySelector('#skipClientLauncher').addEventListener('click',dismissLauncher);
  launcherDialog.addEventListener('cancel',event=>{event.preventDefault();dismissLauncher();});
})();
