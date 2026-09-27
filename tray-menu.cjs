const {BrowserWindow,ipcMain,screen}=require('electron');
const path=require('node:path'),fs=require('node:fs');
class TrayMenu {
  constructor({dataDir,getItems}){
    this.dataDir=dataDir;this.getItems=getItems;
    ipcMain.on('pet-tray:action',(event,index)=>{
      if(event.sender!==this.window?.webContents||!Number.isInteger(index))return;
      const item=this.items[index];if(!item?.click)return;this.close();item.click();
    });
    ipcMain.on('pet-tray:close',event=>{if(event.sender===this.window?.webContents)this.close();});
    ipcMain.on('pet-tray:fit',(event,height)=>{
      const win=this.window;if(event.sender!==win?.webContents||!Number.isFinite(height)||height<=0||height>5000)return;
      const {area,cursor,scale}=this.layout;
      const zoom=Math.min(scale,(area.height-4)/height,(area.width-4)/253);
      win.webContents.setZoomFactor(zoom);
      const width=Math.ceil(253*zoom)+2,h=Math.ceil(height*zoom)+2;
      win.setBounds({width,height:h,x:Math.round(Math.max(area.x,Math.min(cursor.x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(cursor.y,area.y+area.height-h)))});
      win.show();win.focus();
    });
  }
  show(){
    this.close();this.items=this.getItems();
    let scale=1;try{scale=JSON.parse(fs.readFileSync(path.join(this.dataDir,'primary-scale.json'))).scaleFactor||1;}catch{}
    scale=Math.max(1,Math.min(3,scale));
    const cursor=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(cursor).workArea;
    this.layout={area,cursor,scale};
    const width=Math.min(area.width,Math.round(253*scale)),height=Math.min(area.height,Math.round((12+this.items.reduce((n,i)=>n+(i.type==='separator'?7:31),0))*scale));
    // Native resize borders would subtract from this frameless menu's fitted area on Windows.
    const win=new BrowserWindow({width,height,x:Math.round(Math.max(area.x,Math.min(cursor.x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(cursor.y,area.y+area.height-height))),frame:false,thickFrame:false,resizable:false,show:false,skipTaskbar:true,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'ui','tray-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    win.isPetTrayMenu=true;this.window=win;
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.once('did-finish-load',()=>{if(win.isDestroyed())return;win.webContents.setZoomFactor(scale);win.webContents.send('pet-tray:items',this.items.map(i=>({label:i.label,type:i.type})));});
    win.on('blur',()=>{if(!win.isDestroyed())win.close();});
    win.on('closed',()=>{if(this.window===win)this.window=null;});
    win.loadFile(path.join(__dirname,'ui','tray.html'));
  }
  close(){if(this.window&&!this.window.isDestroyed())this.window.close();this.window=null;}
}
module.exports={TrayMenu};
