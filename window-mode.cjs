const modes={normal:{alwaysOnTop:false,fullscreenMode:'never'},top:{alwaysOnTop:true,fullscreenMode:'never'},fullscreen:{alwaysOnTop:true,fullscreenMode:'all'},gpt:{alwaysOnTop:false,fullscreenMode:'except-gpt'}};
function legacyMode(p){return p.fullscreenMode==='except-gpt'?'gpt':p.fullscreenMode==='all'?'fullscreen':p.alwaysOnTop?'top':'normal';}
function windowMode(p){return p.windowMode??legacyMode(p);}
// On Windows, Electron's lower levels (including floating) can sit in the non-topmost band.
function setTopmost(w,value){w.setAlwaysOnTop(value,process.platform==='win32'?'screen-saver':'floating');}
module.exports={modes,legacyMode,windowMode,setTopmost};
