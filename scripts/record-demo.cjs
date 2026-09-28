const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { root, findFFmpeg, ffmpeg } = require('./media-tools.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async function recordDemo({ service }) {
  let canvas, cardWindow;
  try {
    if (!process.env.PET_TEST_DATA_DIR) throw new Error('Recording requires isolated data');
    const command = findFFmpeg();
    service.client.start = async () => { throw new Error('Live Codex is disabled during demo recording'); };
    const pet = BrowserWindow.getAllWindows()[0];
    let ready = false;
    for (let i = 0; i < 100; i++) {
      ready = await pet.webContents.executeJavaScript('!!window.__dshPetDebug?.configOk').catch(() => false);
      if (ready) break;
      await sleep(100);
    }
    if (!ready) throw new Error('Demo renderer did not initialize');
    await pet.webContents.executeJavaScript(`(()=>{
      const s=sprites[0];s.stopMove();s.stopThrow();s.startMove=()=>{};s.sendBounds=()=>{};
      window.petPreferences.disableRoaming=true;window.petPreferences.replyMode='permanent';window.petPreferences.quotaMode='permanent';
      window.petPreferences.taskBasicFeedback=true;window.petPreferences.taskNativeFeedback=true;
      s.pet.balanceEnabled=true;s.pet.workStatusEnabled=true;s.pet.whisperEnabled=false;s.bubbleHover=true;
    })()`);
    pet.setIgnoreMouseEvents(true);
    const options={show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,offscreen:true}};
    canvas=new BrowserWindow({...options,width:1280,height:720});
    const story=process.env.PET_DEMO_EDITION==='story';
    await canvas.loadFile(path.join(__dirname,story?'story-canvas.html':'demo-canvas.html'));
    cardWindow=new BrowserWindow({...options,width:1800,height:1800,transparent:true});
    const output=path.join(root,'media-output',story?'demo-story-4k':'demo-4k');fs.mkdirSync(output,{recursive:true});
    const quota=`s.explicitQuota=true;s.showBalanceNow({ok:true,provider:'Codex',kind:'codex',windows:[{percent:24,minutes:300,resetsAt:'2026-09-28T15:00:00Z'},{percent:48,minutes:10080,resetsAt:'2026-10-01T00:00:00Z'}],queriedAt:Date.parse('2026-09-28T10:00:00Z'),availableResetCount:2});`;
    const scenes=[
      {id:'hello',seconds:6,kicker:'01  /  桌面上的小伙伴',title:'一只小女仆，\n很多种陪伴。',lines:['纯桌宠即可开始。','聊天、额度与任务联动，按需开启。'],animation:'点击回应-元气挥手'},
      {id:'rice',seconds:8,kicker:'纯桌宠  /  吃什么',title:'先好好吃饭，\n再慢慢忙。',lines:['吃白饭、涮火锅、吃冰淇淋……','右键动作菜单，随时点播。'],animation:'吃白饭'},
      {id:'play',seconds:8,kicker:'纯桌宠  /  玩耍',title:'有自己的，\n小小爱好。',lines:['玩魔方、撸猫、荡秋千、做魔术。','日常动作按分类随机轮换。'],animation:'原地专心玩魔方'},
      {id:'season',seconds:8,kicker:'纯桌宠  /  时节',title:'把四季，\n放进桌面。',lines:['赏月、堆雪人、放烟花。','106 段动作，图鉴逐个介绍。'],animation:'中秋赏月吃月饼'},
      {id:'touch',seconds:6,kicker:'纯桌宠  /  互动',title:'轻轻一点，\n就有回应。',lines:['点击、拖动、手动点播。','尺寸、字体与窗口策略都可调整。'],animation:'点击回应-开心跃动'},
      {id:'whisper',seconds:8,kicker:'自有 API  /  碎碎念',title:'忙碌之间，\n一句小陪伴。',lines:['手动触发，也可设置间隔与概率。','正文可选中复制，停留时间可调。'],animation:'碎碎念-擦桌碎碎念',run:`s.showWhisper('忙完这一小步，记得喝口水呀~');`},
      {id:'chat',seconds:8,kicker:'自有 API  /  聊天',title:'聊两句，\n再继续出发。',lines:['使用你自己的 API 地址与模型。','连接 Codex 后也能沿用自有 API。'],animation:'碎碎念-对屏碎碎念',run:`s.showWhisper('今天也辛苦啦！我们先把眼前这一件小事做好。');`},
      {id:'proxy',seconds:10,kicker:'密钥 / 代理查询',title:'消耗多少，\n心里有数。',lines:['聊天接口与额度接口分别配置。','支持 CRS 与部分 JSON 统计接口。'],animation:'余额-钱袋如常',run:`s.explicitQuota=true;s.showBalanceNow({ok:true,provider:'CRS · 演示服务',kind:'proxy',format:'monitor',percent:42,rows:['今日费用 $0.2800','累计费用 $4.2000','今日请求 12 次','Token 18,600','更新时间 18:00:00']});`},
      {id:'tasks',seconds:10,kicker:'Codex 联动  /  多任务',title:'几件事一起忙，\n进度也清楚。',lines:['已观测任务数量与当前状态分行显示。','基础反馈和任务卡可分别开启。'],animation:'工作状态-忙碌点按',run:`s.onWorkTick({state:'working',task:'已知 2 个任务进行中\\n执行工具',activeCount:2,items:[{title:'整理项目说明',state:'working',activity:'修改文件'},{title:'检查界面细节',state:'thinking',activity:'思考中'}]},101);`},
      {id:'waiting',seconds:8,kicker:'Codex 联动  /  等待确认',title:'需要你时，\n我会提醒。',lines:['思考、执行、等待、完成、出错。','录屏时可关闭事件响应。'],animation:'工作状态-原地踱步张望',run:`s.onWorkTick({state:'waiting',task:'需要你确认下一步',activeCount:1,items:[{title:'整理项目说明',state:'waiting',activity:'等待确认'}]},102);`},
      {id:'quota',seconds:10,kicker:'Codex 联动  /  登录额度',title:'短期与一周，\n一起看。',lines:['5 小时用量、1 周用量与重置时间。','接口提供时显示可用重置次数。'],animation:'余额-金袋叮当',run:quota},
      {id:'end',seconds:6,kicker:'GitHub 开源项目 · pet-with-you',title:'陪你工作，\n也陪你发呆。',lines:['在 GitHub 搜索 pet-with-you。','阅读安装手册，先从纯桌宠开始。'],animation:'女仆屈膝礼仪'},
    ];
    const timing={hello:3,rice:4,play:4,season:4,touch:4,whisper:6,chat:5,proxy:6,tasks:7,waiting:5,quota:7,end:4};
    const sequence=story?scenes.map(scene=>({...scene,seconds:timing[scene.id]})):scenes;
    const selected=process.env.PET_DEMO_PREVIEW==='1'?sequence.filter(s=>['whisper','proxy','tasks','quota'].includes(s.id)):sequence;
    for(const [index,scene] of selected.entries()){
      let card=null;
      if(scene.run){
        await pet.webContents.executeJavaScript(`(()=>{const s=sprites[0];s.onWorkTick({state:null},100);s.closeReply();s.closeQuota();s.manualPlaying=false;${scene.run}})()`);
        await sleep(200);
        // Clone the real card with computed styles, then rasterize text at 3x.
        const html=await pet.webContents.executeJavaScript(`(()=>{const source=sprites[0].bubble;const clone=source.cloneNode(true);const originals=[source,...source.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];originals.forEach((node,i)=>{const style=getComputedStyle(node);copies[i].setAttribute('style',Array.from(style).map(k=>k+':'+style.getPropertyValue(k)).join(';'));});Object.assign(clone.style,{position:'relative',left:'0',top:'0',right:'auto',bottom:'auto',transform:'none',translate:'none',opacity:'1',margin:'0'});clone.hidden=false;return clone.outerHTML;})()`);
        await cardWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<meta charset="utf-8"><style>body{margin:24px;background:transparent}</style>'+html));
        cardWindow.webContents.setZoomFactor(3);
        await sleep(150);
        const rect=await cardWindow.webContents.executeJavaScript(`(()=>{const r=document.querySelector('.pet-bubble').getBoundingClientRect();return {x:Math.max(0,r.x-15),y:Math.max(0,r.y-15),width:r.width+30,height:r.height+30,viewport:innerWidth};})()`);
        const shot=await cardWindow.webContents.capturePage();const scale=shot.getSize().width/rect.viewport;
        card=shot.crop({x:Math.floor(rect.x*scale),y:Math.floor(rect.y*scale),width:Math.ceil(rect.width*scale),height:Math.ceil(rect.height*scale)}).toDataURL();
      }
      const plate=await canvas.webContents.executeJavaScript(`drawPlate(${JSON.stringify(scene)},${index},${selected.length},${JSON.stringify(card)})`);
      const plateFile=path.join(output,scene.id+'-plate.png');fs.writeFileSync(plateFile,Buffer.from(plate,'base64'));
      const y=story&&!card?740:990;
      const filter=`[1:v]scale=1920:1080:flags=lanczos[pet];[0:v][pet]overlay=1700:${y}:shortest=1,format=yuv420p`;
      const input=['-loop','1','-framerate','24','-i',plateFile,'-stream_loop','-1','-c:v','libvpx-vp9','-i',path.join(root,'assets/webm',scene.animation+'.webm')];
      await ffmpeg(command,[...input,'-filter_complex',filter,'-t',String(process.env.PET_DEMO_PREVIEW==='1'?1:scene.seconds),'-r','24','-c:v','libx264','-preset','veryfast','-crf','18','-threads','4','-movflags','+faststart',path.join(output,scene.id+'.mp4')]);
      await ffmpeg(command,['-ss',process.env.PET_DEMO_PREVIEW==='1'?'0.5':String(Math.min(3,scene.seconds/2)),'-i',path.join(output,scene.id+'.mp4'),'-frames:v','1',path.join(output,scene.id+'.png')]);
      console.error('Rendered demo scene '+(index+1)+'/'+selected.length+': '+scene.id);
    }
    const list=path.join(output,'concat.txt');fs.writeFileSync(list,selected.map(scene=>`file '${scene.id}.mp4'`).join('\n'));
    const final=path.join(output,process.env.PET_DEMO_PREVIEW==='1'?'layout-preview.mp4':'pet-with-you-demo-4k.mp4');
    await ffmpeg(command,['-f','concat','-safe','1','-i',list,'-c','copy','-movflags','+faststart',final]);
    fs.writeFileSync(path.join(output,'recording.json'),JSON.stringify({width:3840,height:2160,fps:24,seconds:selected.reduce((n,s)=>n+(process.env.PET_DEMO_PREVIEW==='1'?1:s.seconds),0),data:'synthetic',technique:'Offline animation composition with real renderer card snapshots; not live desktop interaction',sourceAnimation:{width:640,height:360,fps:24},scenes:selected.map(({run,...scene})=>scene)},null,2));
    canvas.destroy();cardWindow.destroy();app.quit();
  }catch(error){console.error(error);canvas?.destroy();cardWindow?.destroy();app.exit(1);}
};
