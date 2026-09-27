const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function recordDemo({ service }) {
  let canvas;
  try {
    if (!process.env.PET_TEST_DATA_DIR) throw new Error('Recording requires isolated data');
    service.client.start = async () => { throw new Error('Live Codex is disabled during demo recording'); };
    const pet = BrowserWindow.getAllWindows()[0];
    for (let i = 0; i < 100; i++) {
      if (await pet.webContents.executeJavaScript('!!window.__dshPetDebug?.configOk').catch(() => false)) break;
      await sleep(100);
    }
    await pet.webContents.executeJavaScript(`(()=>{
      const s=sprites[0];s.stopMove();s.stopThrow();s.startMove=()=>{};s.sendBounds=()=>{};
      window.petPreferences.disableRoaming=true;window.petPreferences.replyMode='permanent';window.petPreferences.quotaMode='permanent';
      s.pet.balanceEnabled=true;s.pet.workStatusEnabled=true;s.pet.whisperEnabled=false;s.bubbleHover=true;
    })()`);
    pet.setIgnoreMouseEvents(true);pet.showInactive();
    canvas = new BrowserWindow({ width:1280,height:720,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false} });
    await canvas.loadFile(path.join(__dirname, 'demo-canvas.html'));
    const output = path.resolve(__dirname, '../media-output');fs.mkdirSync(output,{recursive:true});
    const scenes = [
      { title:'随时陪在身边', subtitle:'随机动作与手动点播\n拖动、吸附、尺寸与字体设置', run:`s.onMenuAction({anim:s.animations.categories.find(c=>c.id==='吃什么').actions[0]});` },
      { title:'工作进度，看得见', subtitle:'多个任务，同时展示\n基础反馈与任务卡独立开关', run:`s.manualPlaying=false;s.onWorkTick({state:'working',task:'已知 2 个任务进行中\\n执行工具',activeCount:2,items:[{title:'整理项目说明',state:'working',activity:'修改文件'},{title:'检查界面细节',state:'thinking',activity:'思考中'}]},101);` },
      { title:'一句话的小陪伴', subtitle:'自有 API 聊天与碎碎念\n可选中复制，自定义停留时间', run:`s.onWorkTick({state:null},102);s.showWhisper('忙完这一小步，记得喝口水呀~');` },
      { title:'用量一眼了解', subtitle:'5 小时与 1 周额度\n重置时间、次数与查询时间', run:`s.closeReply();s.explicitQuota=true;s.showBalanceNow({ok:true,provider:'Codex',kind:'codex',windows:[{percent:24,minutes:300,resetsAt:'2026-09-27T15:00:00Z'},{percent:48,minutes:10080,resetsAt:'2026-10-01T00:00:00Z'}],queriedAt:Date.parse('2026-09-27T10:00:00Z'),availableResetCount:2});` }
    ];
    let frameCount=0;const started=Date.now();
    for (let index=0;index<scenes.length;index++) {
      const scene=scenes[index];
      await pet.webContents.executeJavaScript(`(()=>{const s=sprites[0];${scene.run}})()`);
      await sleep(450);
      const bounds=await pet.webContents.executeJavaScript(`(()=>{const s=sprites[0],rects=[s.stage.getBoundingClientRect(),...(!s.bubble.hidden?[s.bubble.getBoundingClientRect()]:[])];return {left:Math.max(0,Math.min(...rects.map(r=>r.left))-30),top:Math.max(0,Math.min(...rects.map(r=>r.top))-30),right:Math.min(innerWidth,Math.max(...rects.map(r=>r.right))+30),bottom:Math.min(innerHeight,Math.max(...rects.map(r=>r.bottom))+30),width:innerWidth};})()`);
      const until=Date.now()+3200;let first=true;
      while(Date.now()<until){
        const frameStarted=Date.now();
        const capture=await pet.webContents.capturePage(), scale=capture.getSize().width/bounds.width;
        const picture=capture.crop({x:Math.floor(bounds.left*scale),y:Math.floor(bounds.top*scale),width:Math.floor((bounds.right-bounds.left)*scale),height:Math.floor((bounds.bottom-bounds.top)*scale)});
        await canvas.webContents.executeJavaScript(`drawFrame(${JSON.stringify(picture.toDataURL())},${JSON.stringify(scene.title)},${JSON.stringify(scene.subtitle)},${index})`);
        if(!frameCount)await canvas.webContents.executeJavaScript('startRecording()');
        if(first){
          const png=await canvas.webContents.executeJavaScript("document.querySelector('canvas').toDataURL('image/png').split(',')[1]");
          fs.writeFileSync(path.join(output,'scene-'+(index+1)+'.png'),Buffer.from(png,'base64'));first=false;
        }
        frameCount++;await sleep(Math.max(0,100-(Date.now()-frameStarted)));
      }
    }
    const video=await canvas.webContents.executeJavaScript('stopRecording()');
    fs.writeFileSync(path.join(output,'pet-with-you-demo.webm'),Buffer.from(video,'base64'));
    fs.writeFileSync(path.join(output,'recording.json'),JSON.stringify({frames:frameCount,elapsedSeconds:(Date.now()-started)/1000,canvas:{width:1280,height:720},verified:'decoded at 1280x720 and sought to 10 seconds',data:'synthetic',source:'real pet-with-you renderer capture',assets:'https://github.com/PC2005-cloud/dsh-pet',license:'Upstream character assets are noncommercial.'},null,2));
    canvas.destroy();app.quit();
  } catch(error) { console.error(error);canvas?.destroy();app.exit(1); }
};
