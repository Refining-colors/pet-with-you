(() => {
  const info=document.querySelector('#settingsFileInfo'),result=document.querySelector('#settingsFileResult');
  api('/settings-file').then(value=>{info.textContent=value.file;}).catch(error=>{result.textContent=error.message;});
  // This handler runs after autosave setup so flushing cannot wait on its own click promise.
  document.querySelector('#locateSettingsFile').addEventListener('click',async()=>{
    if(!await window.PetSettingsAutosave.flush())return;
    try{await api('/settings-file/locate','POST');result.textContent='已保存当前修改，并在文件夹中选中 settings.json。分享或覆盖前请退出桌宠。';}
    catch(error){result.textContent=error.message;}
  });
  document.querySelector('#createClientLauncher').addEventListener('click',async()=>{
    if(!await window.PetSettingsAutosave.flush())return;
    const output=document.querySelector('#clientLauncherResult');
    try{const value=await api('/client-launcher','POST');output.textContent=value.canceled?'未修改启动入口。':'已创建 GPT 联动启动快捷方式。以后请通过该入口打开客户端；可将它固定到任务栏。';}
    catch(error){output.textContent=error.message;}
  });
})();
