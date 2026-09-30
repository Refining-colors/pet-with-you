const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {TaskState} = require('./state.cjs');
const {CodexClient} = require('./codex-client.cjs');
const {QuotaService}=require('./quota.cjs');
const {inspectConnection,installHooks,createConnectionCheck}=require('./connection.cjs');
const {Appearance}=require('./appearance.cjs');
const {Preferences}=require('./preferences.cjs');
const {ApiSettings,ApiClient}=require('./api-client.cjs');

const {Diagnostics,issue}=require('./diagnostics.cjs');
const ROOT=__dirname;
const MIME={'.webm':'video/webm','.mov':'video/quicktime','.png':'image/png','.ttf':'font/ttf','.otf':'font/otf','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const readJson=(p,fallback)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return fallback;}};
const writeJson=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2));fs.renameSync(p+'.tmp',p);};
async function startServer({dataDir,hooksAdapter={inspect:inspectConnection,install:installHooks},defaultMode='pet',monitorSessions=false,sessionRoot,onRuntimeInfo=()=>({development:false}),onClientLauncherStatus=()=>({configured:false}),onSettingsLocate=()=>{},onPetShortcut=async()=>({canceled:true}),onClientLauncher=async()=>({canceled:true}),onOpenThread=async()=>{throw new Error('无法打开对话');},onChange=()=>{},onPreferences=()=>{},onNotify=()=>{},onReview=()=>{},onChooseRuntime=async()=>({canceled:true}),onTray=()=>{},onFontImport=async()=>null,onLogsOpen=async()=>{throw new Error('目录打开功能不可用');},onLogsExport=async()=>{throw new Error('日志导出功能不可用');},protect,unprotect}){
  fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(path.join(dataDir,'pet'),{recursive:true});
  const settingsStore=new (require('./settings-store.cjs').SettingsStore)(dataDir);
  const paths={defaultFile:path.join(ROOT,'assets/config.jsonc'),userFile:settingsStore.file,petDir:path.join(dataDir,'pet'),settings:settingsStore};
  const {readAllConfig,flattenPetList,findPetInstance,saveUserConfig}=await import(pathToFileURL(path.join(ROOT,'config.mjs')));
  if(!settingsStore.has('pet')){
    const initial=readAllConfig(paths).main;
    initial.pets.forEach(p=>{p.display='desktop';p.workStatusEnabled=true;p.whisperEnabled=false;});
    settingsStore.set('pet',initial);
  }
  const diagnostics=new Diagnostics(dataDir);
  let config=readAllConfig(paths);
  const tasks=new TaskState();
  const client=new CodexClient(dataDir);
  const appearance=new Appearance(dataDir);
  const preferences=new Preferences(dataDir,defaultMode);
  diagnostics.ignoreAccountTimeouts=()=>preferences.value.ignoreAccountTimeouts;
  const apiSettings=new ApiSettings(dataDir,{protect,unprotect});
  const apiClient=new ApiClient(apiSettings);
  const quota=new QuotaService({dataDir,client,protect,unprotect,getApiKey:()=>apiSettings.key()});
  let modeEpoch=0;
  const connected=()=>preferences.value.mode==='connected';
  const useApi=()=>!connected()||preferences.value.chatSource==='api';
  const chatReady=()=>useApi()?apiSettings.publicValue().configured:preferences.value.chatSourceChosen;
  const publicPreferences=()=>({...preferences.value,chatReady:chatReady(),apiConfigured:apiSettings.publicValue().configured,quotaConfigured:connected()||!!(quota.settings.proxy&&!['provider','auth'].includes(quota.settings.proxy.credential))});
  const connectionCheck=createConnectionCheck(hooksAdapter.inspect);
  async function connection(fresh=false){
    const result=await connectionCheck.read({fresh});
    return connected()?{...result,lastHook,monitor:monitor.status()}:{ready:false,mode:'pet',disabled:true};
  }
  const token=crypto.randomBytes(24).toString('hex');
  const prefix='/'+token+'/dsh-pet-7340';
  const memoryFile=path.join(dataDir,'memory.json');
  const replyStates=new Map();
  const whisperHistory=new (require('./whisper-history.cjs').WhisperHistory)();
  let memory=readJson(memoryFile,{}),pendingChat=new Set(),whispers=new Map(),lastHook=null;
  const hookTimes=new Map();
  const monitor=new (require('./session-monitor.cjs').SessionMonitor)({root:sessionRoot,onEvent(event){
    if(!connected())return;
    if(Date.now()-(hookTimes.get(event.session_id)||0)<5000){const current=tasks.sessions.get(event.session_id);if(current&&event.title&&current.title!==event.title){current.title=event.title;tasks.ts=Math.max(tasks.ts+1,Date.now());}return;}
    tasks.accept(event);
  },onError(e){diagnostics.record('connection-monitor',e,'monitor-failed');}});
  if(monitorSessions)monitor.setEnabled(connected());
  let rateCache=null,rateAt=0,rateFlight=null,lastRoundBalance=0,roundBalanceFlight=null;
  function report(operation,error,fallback){
    const entry=diagnostics.record(operation,error,fallback);
    if(entry.ignored)return {ignored:true,message:entry.message+'（已忽略此类错误，不写入日志）'};
    return {errorId:entry.id,message:entry.message+(entry.persisted?' [错误编号 '+entry.id+'；可在基础设置 → 错误日志中导出]':' [日志写入失败，请检查日志目录权限]')};
  }
  function quotaReport(result,source){
    if(result.ok||result.reason==='disabled')return result;
    const diagnostic=report('quota-'+source,result,'quota-failed');
    return {...result,errorId:diagnostic.errorId,message:result.message+' ['+(diagnostics.writeFailed?'日志写入失败':'错误编号 '+diagnostic.errorId)+'；详见基础设置 → 错误日志]'};
  }
  async function proxyBalance(){if(!connected()&&['provider','auth'].includes(quota.settings.proxy?.credential))return {ok:false,reason:'disabled',message:'纯桌宠请改用自有 API 密钥、手动密钥或环境变量',provider:'额度查询'};return quotaReport(await quota.queryProxy(),'proxy');}
  async function balance(){
    if(rateCache&&Date.now()-rateAt<60000)return rateCache;
    if(rateFlight)return rateFlight;
    rateFlight=(async()=>{
      try{
        const raw=await client.limits();
        rateCache=require('./quota.cjs').normalizeCodexUsage(raw);
        rateAt=Date.now();return rateCache;
      }catch(e){return {ok:false,provider:'Codex',reason:'fetch-error',...report('quota-account',e,'gpt-failed')};}
      finally{rateFlight=null;}
    })();return rateFlight;
  }
  async function chat(id,text,isWhisper=false,onText){
    const found=findPetInstance(config,id);if(!found)throw issue('pet-missing');
    if(typeof text!=='string'||!text.trim()||text.length>2000)throw issue('input-invalid');
    if(pendingChat.has(id))throw issue('chat-busy');
    pendingChat.add(id);const epoch=modeEpoch;
    try{
      const rounds=Math.max(0,Math.min(10,Number(found.conf.chatMemoryRounds ?? 5)));
      const history=rounds?(memory[id]||[]).slice(-(isWhisper?Math.min(rounds,1):rounds)*2):[];
      const pool=Object.keys(found.conf.memes||{});
      const useImage=isWhisper?found.conf.whisperImageEnabled:found.conf.chatImageEnabled;
      const chooseImage=useImage&&!isWhisper&&pool.length;
      const prompt=found.conf.whisperPrompt+'\n以下为聊天记录，仅作语境：\n'+JSON.stringify(history)+'\n用户消息：'+text+(isWhisper?whisperHistory.context(id):'')+(chooseImage?'\n请输出 JSON：{"reply":"回复","image":"表情名或空字符串"}。按对话语境从以下表情中选择：'+JSON.stringify(found.conf.memes):'');
      const options={onText:onText?value=>{if(epoch===modeEpoch&&(!isWhisper||!whisperHistory.isPriorPrefix(id,value)))onText(value);}:undefined};
      let reply=useApi()?await apiClient.chat(prompt,options):await client.chat(prompt,options),image;
      if(epoch!==modeEpoch)throw issue('mode-changed');
      if(isWhisper&&!whisperHistory.add(id,reply))return {ok:true,repeated:true,text:'',reply:'',ts:Date.now()};
      if(chooseImage){try{const parsed=JSON.parse(reply.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));if(typeof parsed.reply==='string'&&parsed.reply.trim()){reply=parsed.reply;if(pool.includes(parsed.image))image=parsed.image;}}catch{/* Plain text is still a valid reply. */}}
      else if(useImage&&pool.length)image=pool[Math.floor(Math.random()*pool.length)];
      if(!isWhisper){memory[id]=[...(memory[id]||[]),{role:'user',content:text},{role:'assistant',content:reply}].slice(-1000);writeJson(memoryFile,memory);}
      return {ok:true,reply,text:reply,ts:Date.now(),...(image?{image}:{})};
    }finally{pendingChat.delete(id);}
  }
  const server=http.createServer(async(req,res)=>{
    function json(v,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'null'});res.end(JSON.stringify(v));}
    async function body(){let text='';for await(const b of req){text+=b;if(text.length>262144)throw new Error('请求过大');}return JSON.parse(text||'{}');}
    function file(root,relative){
      const target=path.resolve(root,relative),base=path.resolve(root)+path.sep;
      if(!target.startsWith(base)||!fs.existsSync(target)||!fs.statSync(target).isFile())return json({error:'Not found'},404);
      const size=fs.statSync(target).size;const headers={'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Access-Control-Allow-Origin':'null','Accept-Ranges':'bytes'};
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
      let start=0,end=size-1;if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
      headers['Content-Length']=end-start+1;res.writeHead(match?206:200,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(target,{start,end}).pipe(res);
    }
    let operation='runtime';
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(!url.pathname.startsWith(prefix+'/')&&url.pathname!==prefix)return json({error:'Not found'},404);
      const origin=req.headers.origin;
      if(origin&&origin!=='null'&&origin!==`http://127.0.0.1:${server.address().port}`)return json({error:'Origin denied'},403);
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'null','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
      const route=decodeURIComponent(url.pathname.slice(prefix.length));const id=url.searchParams.get('pet')||flattenPetList(config)[0]?.id;
      operation=route.startsWith('/logs')?'logs':route==='/quota/context'?'quota-context':route==='/connection'||route==='/connect'?'connection-inspect':'settings';
      if(route==='/logs')return json(req.method==='DELETE'?diagnostics.clear():diagnostics.summary());
      if(route==='/logs/open'&&req.method==='POST'){fs.mkdirSync(diagnostics.dir,{recursive:true});await onLogsOpen(diagnostics.dir);return json({ok:true});}
      if(route==='/logs/export'&&req.method==='POST')return json(await onLogsExport(diagnostics.exportText()));
      if(route==='/'||route==='/settings')return file(path.join(ROOT,'ui'),'index.html');
      if(route==='/settings-file'&&req.method==='GET')return json({name:'settings.json',file:settingsStore.file});
      if(route==='/settings-file/locate'&&req.method==='POST'){await onSettingsLocate(settingsStore.file);return json({ok:true});}
      if(route==='/runtime-info'&&req.method==='GET')return json(onRuntimeInfo());
      if(route==='/client-launcher'&&req.method==='GET')return json({...onClientLauncherStatus(),prompted:settingsStore.get('onboarding',{}).clientLauncherPrompted===true});
      if(route==='/pet-shortcut'&&req.method==='POST')return json(await onPetShortcut());
      if(route==='/client-launcher'&&req.method==='POST'){
        const result=await onClientLauncher();
        if(result.ok||result.canceled)settingsStore.set('onboarding',{...settingsStore.get('onboarding',{}),clientLauncherPrompted:true});
        return json(result);
      }
      if(route==='/client-launcher/dismiss'&&req.method==='POST'){
        settingsStore.set('onboarding',{...settingsStore.get('onboarding',{}),clientLauncherPrompted:true});
        return json({ok:true});
      }
      if(route==='/codex-withu.png'&&req.method==='GET')return file(path.join(ROOT,'build'),'codex-withu.png');
      if(route==='/settings-file.js')return file(path.join(ROOT,'ui'),'settings-file.js');
      if(route==='/hooks-review-icon.png')return file(path.join(ROOT,'ui'),'hooks-review-icon.png');
      if(route==='/ui.js')return file(path.join(ROOT,'ui'),'ui.js');
      if(route==='/autosave.js')return file(path.join(ROOT,'ui'),'autosave.js');
      if(route==='/shared-core.js')return file(path.join(ROOT,'runtime'),'shared-core.js');
      if(route==='/appearance.js')return file(path.join(ROOT,'ui'),'appearance.js');
      if(route.startsWith('/user-font/'))return file(appearance.dir,route.slice(11));
      if(route==='/appearance')return json({...(req.method==='PUT'?appearance.save(await body()):appearance.value),bundledFontAvailable:fs.existsSync(path.join(ROOT,'assets/fonts','上首软糖体.ttf'))});
      if(route==='/preferences'){
        if(req.method==='PUT'){
          const previous={...preferences.value};const before=previous.mode;const next=preferences.save(await body());
          if(previous.chatSource!==next.chatSource||previous.chatSourceChosen!==next.chatSourceChosen){modeEpoch++;whispers.clear();client.close();apiClient.close();}
          if(before!==next.mode){modeEpoch++;connectionCheck.invalidate();rateCache=null;rateAt=0;tasks.sessions.clear();tasks.ts=Date.now();lastHook=null;whispers.clear();client.close();apiClient.close();}
          try{await onPreferences(next,before!==next.mode||previous.chatSource!==next.chatSource||previous.chatSourceChosen!==next.chatSourceChosen);}catch(e){preferences.save(previous);try{await onPreferences(previous,true);}catch{}throw e;}
          if(monitorSessions)monitor.setEnabled(connected());
          return json(publicPreferences());
        }
        return json(publicPreferences());
      }
      if(route==='/api/settings'){
        if(['PUT','DELETE'].includes(req.method)){const value=req.method==='DELETE'?apiSettings.clear():apiSettings.save(await body());modeEpoch++;whispers.clear();apiClient.close();quota.cache=null;quota.flight=null;await onPreferences(preferences.value,true);return json(value);}
        return json(apiSettings.publicValue());
      }
      if(route==='/api/profiles'){
        if(req.method==='POST')return json(apiSettings.saveProfile((await body()).name));
        if(req.method==='DELETE')return json(apiSettings.deleteProfile(url.searchParams.get('id')));
        return json(apiSettings.profiles());
      }
      if(route==='/api/profiles/load'&&req.method==='POST'){
        const value=apiSettings.loadProfile((await body()).id);modeEpoch++;whispers.clear();apiClient.close();quota.cache=null;quota.flight=null;
        await onPreferences(preferences.value,true);return json(value);
      }
      if(route==='/runtime/choose'&&req.method==='POST')return json(await onChooseRuntime());
      if(route==='/appearance/fonts')return json(await appearance.fonts());
      if(route==='/appearance/import'&&req.method==='POST')return json(appearance.importFile(await onFontImport(),(await body()).target));
      if(route==='/tray/show'&&req.method==='POST'){onTray(true);return json({ok:true});}
      if(route==='/health')return json({ok:true,animations:fs.readdirSync(path.join(ROOT,'assets/webm')).length,lastHook,pendingChat:[...pendingChat],work:tasks.snapshot(),monitor:monitor.status(),mode:preferences.value.mode,apiConfigured:apiSettings.publicValue().configured});
      if(route==='/reply-state'){
        if(!findPetInstance(config,id))return json({error:'找不到宠物'},404);
        if(req.method==='PUT'){
          const value=await body();if(typeof value.text!=='string'||value.text.length>100000)throw new Error('回复内容无效');
          replyStates.set(id,{text:value.text,image:typeof value.image==='string'?value.image.slice(0,200):'',at:Date.now()});
        }else if(req.method==='DELETE')replyStates.delete(id);
        let value=replyStates.get(id);
        if(value&&preferences.value.replyMode==='timed'&&Date.now()-value.at>preferences.value.replySeconds*1000){replyStates.delete(id);value=null;}
        return json(value||null);
      }
      if(route==='/connection')return connected()?json(await connection(url.searchParams.get('fresh')==='1')):json({ready:false,mode:'pet',disabled:true,lastHook});
      if(route==='/connect'&&req.method==='POST'){
        preferences.save({mode:'connected'});await onPreferences(preferences.value,true);
        hooksAdapter.install();if(monitorSessions)monitor.setEnabled(true);
        try{return json({...await connection(true),configured:true});}
        catch(error){const detail=report('connection-inspect',error,'connection-failed');return json({ready:false,configured:true,inspectionError:detail.message,hookCommand:require('./hook-command.cjs').hookCommand().command});}
      }
      if(route==='/review-hooks'&&req.method==='POST'){if(!connected())return json({error:'请先开启连接模式'},400);await onReview();return json({ok:true});}
      if(route==='/quota/settings'){
        if(req.method==='DELETE'){const value=quota.clear();await onPreferences(preferences.value,true);return json(value);}
        if(req.method==='PUT'){const raw=await body();if(raw.selectedOnly)quota.select(raw.selected);else quota.save(raw);await onPreferences(preferences.value,true);return json(await quota.displaySettings(connected()));}
        return json(await quota.displaySettings(connected()));
      }
      if(route==='/quota/context'&&connected()&&preferences.value.ignoreAccountTimeouts)return json({skipped:true,message:'已忽略账户读取超时，停止自动读取 GPT 账户信息；仍可手动查询账户额度。'});
      if(route==='/quota/context')return connected()?json(await quota.context()):json({accountType:'纯桌宠 API',provider:apiSettings.publicValue().configured?'自定义 API':'未配置'});
      if(route==='/quota/profiles'){
        if(req.method==='POST')return json(quota.saveProfile((await body()).name));
        if(req.method==='DELETE')return json(quota.deleteProfile(url.searchParams.get('id')));
        return json(quota.profiles());
      }
      if(route==='/quota/profiles/load'&&req.method==='POST'){
        quota.loadProfile((await body()).id);await onPreferences(preferences.value,true);return json(await quota.displaySettings(connected()));
      }
      if(route==='/quota/query'){
        const source=url.searchParams.get('source')||quota.settings.selected;
        if(!connected()&&source!=='proxy')return json({ok:false,provider:'Codex',message:'当前为纯桌宠模式，请先切换到“连接 GPT 客户端”。'});
        return json(source==='proxy'?await proxyBalance():await balance());
      }
      if(route==='/config/size'&&req.method==='PUT'){
        const {id,size}=await body();
        if(typeof id!=='string'||!Number.isInteger(size)||size<180||size>900)return json({error:'尺寸须为 180–900 的整数'},400);
        const found=findPetInstance(config,id);
        if(!found)return json({error:'未找到这只桌宠'},404);
        const key=found.entry==='main'?'pet':'petEntries';
        const existing=settingsStore.get(key,{}),next=structuredClone(existing);
        const entry=found.entry==='main'?next:(next[found.entry]??={});
        // Materialize inherited pets only when needed; preserve all other entry fields.
        entry.pets=structuredClone(entry.pets||found.conf.pets);
        const target=entry.pets.find(p=>p.id===id);
        if(!target)return json({error:'桌宠配置已变化，请重新打开菜单'},409);
        target.size=size;
        settingsStore.set(key,next);
        try{config=readAllConfig(paths);}catch(error){settingsStore.set(key,existing);throw error;}
        await onChange(config,{id,size});
        return json({id,size});
      }
      if(route==='/config'){
        if(req.method==='PUT'){
          const raw=await body();
          if(!Array.isArray(raw.pets)||!raw.pets.length||raw.pets.length>6||raw.pets.some(p=>!p||!Number.isFinite(p.size)||p.size<180||p.size>900))return json({error:'宠物数量 1–6，尺寸 180–900'},400);
          const existing=settingsStore.get('pet',{});const next=saveUserConfig(raw,existing);if(!next)return json({error:'配置不合法'},400);
          if(new Set(next.pets.map(p=>p.id)).size!==next.pets.length)return json({error:'宠物 ID 不能重复'},400);
          for(const key of ['physics','animationWeights','animations','eventsRefreshSec','whisperPrompt','chatMemoryRounds','memes'])if(raw[key]!==undefined)next[key]=raw[key];
          settingsStore.set('pet',next);
          try{config=readAllConfig(paths);}catch(e){settingsStore.set('pet',existing);throw e;}
          await onChange(config);return json(config);
        }
        return json(config);
      }
      if(route==='/hook'&&req.method==='POST'){
        const event=await body();if(!connected())return json({ok:false,disabled:true});const accepted=tasks.accept(event);
        if(accepted){hookTimes.set(event.session_id,Date.now());if(hookTimes.size>200)hookTimes.delete(hookTimes.keys().next().value);lastHook={event:event.hook_event_name,at:Date.now()};if(!preferences.value.disableEventResponse&&config.main.notificationsEnabled&&['Stop','PermissionRequest'].includes(event.hook_event_name))onNotify(event.hook_event_name==='Stop'?'任务回合结束':'任务需要你确认');}
        return json({ok:accepted});
      }
      if(route==='/work/open'&&req.method==='POST'){const value=await body();if(!connected()||!tasks.sessions.has(value.id)||!/^[-a-f0-9]{36}$/i.test(value.id))throw new Error('该对话已不在当前任务列表中');await onOpenThread(value.id);return json({ok:true});}
      if(route==='/work-status')return json(connected()?tasks.snapshot():{state:null,task:null,ts:Date.now()});
      if(route==='/balance'){
        if(url.searchParams.has('round')&&preferences.value.disableEventResponse)return json({ok:false,ignored:true,reason:'disabled',provider:'额度查询',message:'事件响应已关闭'});
        const round=Number(url.searchParams.get('round'));
        if(connected()&&!preferences.value.disableEventResponse&&preferences.value.quotaAfterTurn&&Number.isSafeInteger(round)&&round>lastRoundBalance&&round<=tasks.completedTurns){
          lastRoundBalance=round;
          // A new round needs current usage; other pets share the same in-flight query.
          const previous=roundBalanceFlight;
          const query=(async()=>{
            if(previous)await previous;
            if(quota.flight)await quota.flight;
            if(rateFlight)await rateFlight;
            quota.cache=null;rateCache=null;
            return quota.settings.selected==='proxy'?proxyBalance():balance();
          })();
          roundBalanceFlight=query;
          try{return json(await query);}finally{if(roundBalanceFlight===query)roundBalanceFlight=null;}
        }
        if(connected()&&!preferences.value.disableEventResponse&&preferences.value.quotaAfterTurn&&round>0&&round<=lastRoundBalance&&roundBalanceFlight)return json(await roundBalanceFlight);
        return json(!connected()?(quota.settings.selected==='proxy'?await proxyBalance():{ok:false,provider:'额度查询',reason:'disabled',message:'纯桌宠模式请在额度设置中选择密钥 / 代理额度'}):(quota.settings.selected==='proxy'?await proxyBalance():await balance()));
      }
      if(route==='/chat'){
        if(!chatReady())return json({ok:false,reason:'disabled',message:useApi()?'请先配置自有 API。':'请先在设置中选择聊天与碎碎念的默认服务。'},409);
        if(req.method==='GET')return json({ok:true,messages:memory[id]||[]});
        if(req.method!=='POST')return json({error:'Method not allowed'},405);
        try{return json(await chat(id,(await body()).text));}catch(e){return json({ok:false,reason:'generate-error',...report('chat-'+(useApi()?'api':'gpt'),e,useApi()?'operation-failed':'gpt-failed')});}
      }
      if(route==='/whisper/history')return json(whisperHistory.list(id));
      if(route==='/whisper'||route==='/whisper/trigger'){
        if(!chatReady())return json({ok:false,reason:'disabled',message:useApi()?'请先配置自有 API。':'请先在设置中选择聊天与碎碎念的默认服务。'},409);
        if(route.endsWith('/trigger')&&url.searchParams.get('stream')==='1'){
          res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'null'});res.flushHeaders();
          const send=value=>{if(!res.destroyed&&!res.writableEnded)res.write(JSON.stringify(value)+'\n');};
          let last=0;
          try{
            const value=await chat(id,'说一句简短的日常碎碎念，不超过20字。',true,text=>{
              const now=Date.now();if(now-last>=40&&res.writableLength<1048576){last=now;send({type:'text',text});}
            });
            whispers.set(id,value);send({type:'done',...value});
          }catch(e){send({type:'done',ok:false,...report('whisper-'+(useApi()?'api':'gpt'),e,useApi()?'operation-failed':'gpt-failed')});}
          return res.end();
        }
        const interval=(findPetInstance(config,id)?.conf.eventsRefreshSec?.whisper||300)*1000;
        let cached=whispers.get(id);if(route.endsWith('/trigger')||!cached||Date.now()-cached.ts>interval){try{cached=await chat(id,'说一句简短的日常碎碎念，不超过20字。',true);whispers.set(id,cached);}catch(e){return json({ok:false,reason:'generate-error',...report('whisper-'+(useApi()?'api':'gpt'),e,useApi()?'operation-failed':'gpt-failed')});}}
        return json(cached);
      }
      if(route.startsWith('/thumb/')){
        const parts=route.slice(7).split('/');if(parts.length!==2||!/^.+\.(webm|mov)$/.test(parts[1]))return json({error:'Not found'},404);
        const [asset,name]=parts;if(!Object.hasOwn(config,asset))return json({error:'Not found'},404);
        const ext=path.extname(name).slice(1);const custom=asset==='main'?path.join(dataDir,'main-animation',ext):path.join(dataDir,'pet',asset+'-animation',ext);
        return file(asset!=='main'||fs.existsSync(path.join(custom,name))?custom:path.join(ROOT,'assets',ext),name);
      }
      if(route.startsWith('/font/'))return file(path.join(ROOT,'assets/fonts'),route.slice(6));
      if(route.startsWith('/pic/memes/'))return file(path.join(ROOT,'assets/memes'),route.slice(11));
      if(route.startsWith('/pic/'))return file(path.join(ROOT,'assets/pic'),route.slice(5));
      json({error:'Not found'},404);
    }catch(e){const detail=report(operation,e,operation==='logs'?'logs-failed':operation==='quota-context'?'account-context-failed':operation==='connection-inspect'?'connection-failed':'settings-failed');json({ok:false,...detail,message:(operation==='settings'?e.message+'。':'')+detail.message},400);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}${prefix}`;
  writeJson(path.join(dataDir,'connection.json'),{base,pid:process.pid});
  return {server,base,config,client,preferences,apiSettings,diagnostics,close(){monitor.close();client.close();apiClient.close();server.close();},paths};
}
module.exports={startServer};
