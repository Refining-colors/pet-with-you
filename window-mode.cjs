const modes={normal:{alwaysOnTop:false,fullscreenMode:'never'},top:{alwaysOnTop:true,fullscreenMode:'never'},fullscreen:{alwaysOnTop:true,fullscreenMode:'all'},gpt:{alwaysOnTop:false,fullscreenMode:'except-gpt'}};
function legacyMode(p){return p.fullscreenMode==='except-gpt'?'gpt':p.fullscreenMode==='all'?'fullscreen':p.alwaysOnTop?'top':'normal';}
function windowMode(p){return p.windowMode??legacyMode(p);}
module.exports={modes,legacyMode,windowMode};
