const assert=require('node:assert/strict');
const {BrowserWindow}=require('electron');
const {WindowObserver}=require('../window-observer.cjs');
const {WindowPolicy,nativeId}=require('../window-policy.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Only these isolated windows are operated on. No real client is minimized or closed.
module.exports=async function verify(){
  const fixtures=[];
  const make=()=>{
    const w=new BrowserWindow({show:false,width:360,height:240,x:80,y:80,skipTaskbar:true});
    fixtures.push(w);return w;
  };
  const pet=make(),other=make();let client=make(),reference=client,latest=null,revision=0;
  const policy=new WindowPolicy({getWindows:()=>[pet],getPreferences:()=>({windowMode:'gpt'})});
  const observer=new WindowObserver({onDisconnect:()=>{},onState:state=>{
    if(reference.isDestroyed())return;
    // Background test processes cannot always acquire Windows foreground permission.
    // Choose a fixture as foreground input, but measure its actual native z-order/styles.
    const id=nativeId(reference),index=state.ownedWindows.findIndex(w=>w.id===id);
    if(index<0)return;
    latest={foregroundId:id,pid:process.pid+1,process:reference===client?'Codex':'editor',fullscreen:false,
      ownedWindows:state.ownedWindows.map((w,i)=>({...w,aboveForeground:i<index}))};
    revision++;policy.acceptState(latest);
  }});
  const nativePet=()=>latest?.ownedWindows.find(w=>w.id===nativeId(pet));
  const until=async(predicate,label)=>{
    const deadline=Date.now()+12000;
    while(Date.now()<deadline){if(predicate())return;await sleep(50);}
    throw new Error('Native window verification timed out: '+label+' '+JSON.stringify({foreground:latest?.foregroundId,client:nativeId(client),other:nativeId(other),pet:nativePet()}));
  };
  const onClient=()=>latest?.foregroundId===nativeId(client)&&nativePet()?.topmost&&nativePet()?.aboveForeground&&nativePet()?.visible&&!nativePet()?.minimized;
  try{
    observer.start();pet.showInactive();policy.requestShow(pet);client.show();client.focus();
    await until(onClient,'initial client foreground');
    for(let i=0;i<2;i++){
      client.minimize();other.showInactive();reference=other;
      await until(()=>latest?.foregroundId===nativeId(other)&&nativePet()?.topmost===false,'minimize client');
      client.restore();client.showInactive();reference=client;
      await until(onClient,'restore same client handle');
    }
    client.close();client=make();reference=client;client.showInactive();
    await until(onClient,'close and reopen client');
    const before=revision;
    client.setAlwaysOnTop(true,'screen-saver');client.moveTop();
    const focused=BrowserWindow.getFocusedWindow();
    await until(()=>revision>before+1&&onClient(),'late cover with unchanged foreground handle');
    assert.equal(BrowserWindow.getFocusedWindow(),focused,'repair must not steal keyboard focus');
    pet.minimize();const minimizedRevision=revision;
    await until(()=>revision>minimizedRevision+1&&onClient(),'unexpected pet minimization');
    policy.setManualHidden(true);const hiddenRevision=revision;
    await until(()=>revision>hiddenRevision+1,'manual hide samples');
    assert.equal(pet.isVisible(),false);
    const beforeReveal=BrowserWindow.getFocusedWindow();
    policy.revealOnce();await until(onClient,'tray reveal');
    assert.equal(BrowserWindow.getFocusedWindow(),beforeReveal,'tray reveal must not steal keyboard focus');
  }finally{
    observer.close();policy.close();
    for(const w of fixtures)if(!w.isDestroyed())w.destroy();
  }
};
