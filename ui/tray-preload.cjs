const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('trayMenu',{
  onItems:cb=>ipcRenderer.on('pet-tray:items',(_e,items)=>cb(items)),
  choose:index=>ipcRenderer.send('pet-tray:action',index),
  fit:height=>ipcRenderer.send('pet-tray:fit',height),
  close:()=>ipcRenderer.send('pet-tray:close')
});
