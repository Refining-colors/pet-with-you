const base=location.pathname.replace(/\/settings\/?$/,'');
let main;
const settingsLoads=[];document.body.inert=true;
let currentMode='pet';
let currentTab='basic';
const tabScroll={};
const $=s=>document.querySelector(s);
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const SECRET_MASK='********';
function maskSecret(input,saved){input.value=saved?SECRET_MASK:'';input.dataset.masked=String(!!saved);}
function enteredSecret(input){return input.dataset.masked==='true'&&input.value===SECRET_MASK?'':input.value;}
for(const input of [$('#apiKey'),$('#proxyKey')]){input.addEventListener('focus',()=>{if(input.dataset.masked==='true')input.select();});input.addEventListener('input',()=>{input.dataset.masked='false';});}
function inputLabel(parent,title,type,value,onChange){const label=text('label',title);const i=document.createElement('input');i.type=type;if(type==='checkbox')i.checked=!!value;else i.value=value;i.onchange=()=>onChange(type==='checkbox'?i.checked:type==='number'?Number(i.value):i.value);label.append(i);parent.append(label);return i;}
function selectTab(tab,focus=false){
  const previous=currentTab;tabScroll[previous]=window.scrollY;
  currentTab=tab==='gpt'&&currentMode==='connected'?'gpt':'basic';
  for(const name of ['basic','gpt']){const active=name===currentTab;$('#'+name+'Panel').hidden=!active;$('#'+name+'Tab').setAttribute('aria-selected',String(active));$('#'+name+'Tab').tabIndex=active?0:-1;}
  if(focus)$('#'+currentTab+'Tab').focus();
  if(previous!==currentTab){window.scrollTo(0,tabScroll[currentTab]??document.querySelector('.settings-tabs').offsetTop);if(currentTab==='gpt')loadQuotaContext();}
}
$('#basicTab').onclick=()=>selectTab('basic');$('#gptTab').onclick=()=>selectTab('gpt');
for(const tab of [$('#basicTab'),$('#gptTab')])tab.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'basic':e.key==='End'?'gpt':currentTab==='basic'?'gpt':'basic',true);}};
function applyMode(mode){
  currentMode=mode||'pet';document.body.dataset.mode=currentMode;
  $('#petMode').checked=currentMode==='pet';$('#connectedMode').checked=currentMode==='connected';$('#gptTab').hidden=currentMode!=='connected';
  if(currentMode==='pet')$('#quotaSource').value='proxy';
  selectTab(currentTab);
}

function render(){
  const historyPet=$('#whisperHistoryPet').value;$('#whisperHistoryPet').replaceChildren();
  $('#pets').replaceChildren();$('#clientPets').replaceChildren();$('#autoWhisperPets').replaceChildren();$('#apiAutoWhisperPets').replaceChildren();
  main.pets.forEach((p,index)=>{
    $('#whisperHistoryPet').append(new Option(p.name,p.id));
    const row=document.createElement('div');row.className='pet';
    const name=inputLabel(row,'名字','text',p.name,v=>p.name=v);name.closest('label').className='pet-name';
    const remove=text('button','移除');remove.disabled=main.pets.length===1;remove.onclick=()=>{main.pets.splice(index,1);render();};row.append(remove);
    const size=document.createElement('div');size.className='pet-size';
    const title=text('label','尺寸');title.htmlFor='pet-size-'+index;
    const slider=document.createElement('input');slider.type='range';slider.min=180;slider.max=900;slider.step=1;slider.value=p.size;slider.id='pet-size-'+index;slider.setAttribute('aria-label',p.name+'尺寸滑条');
    const numeric=document.createElement('input');numeric.type='number';numeric.min=180;numeric.max=900;numeric.step=1;numeric.value=p.size;numeric.setAttribute('aria-label',p.name+'尺寸数值');
    const sync=value=>{p.size=Math.round(Math.max(180,Math.min(900,Number(value)||180)));slider.value=numeric.value=p.size;$('#advanced').value=JSON.stringify(main,null,2);};
    slider.oninput=()=>sync(slider.value);numeric.oninput=()=>{const n=Number(numeric.value);if(numeric.value&&n>=180&&n<=900)sync(n);};numeric.onchange=()=>sync(numeric.value);
    size.append(title,slider,numeric,text('span','px'));row.append(size);
    const options=document.createElement('div');options.className='pet-options';
    const clientRow=document.createElement('div');clientRow.className='client-pet';clientRow.append(text('span',p.name));inputLabel(clientRow,'任务联动','checkbox',p.workStatusEnabled,v=>p.workStatusEnabled=v);$('#clientPets').append(clientRow);
    for(const id of ['autoWhisperPets','apiAutoWhisperPets']){const input=inputLabel($('#'+id),p.name+'：自动碎碎念','checkbox',p.whisperEnabled,v=>{p.whisperEnabled=v;for(const other of document.querySelectorAll('[data-whisper-pet]'))if(other.dataset.whisperPet===p.id)other.checked=v;});input.dataset.whisperPet=p.id;}inputLabel(options,'额度气泡','checkbox',p.balanceEnabled,v=>p.balanceEnabled=v);
    row.append(options);$('#pets').append(row);
  });
  if(main.pets.some(p=>p.id===historyPet))$('#whisperHistoryPet').value=historyPet;
  $('#categories').replaceChildren();
  for(const c of main.animations.categories){const i=inputLabel($('#categories'),c.id+' 权重','number',c.weight,v=>c.weight=v);i.min=0;i.max=100;}
  $('#collision').checked=main.physics.petCollision;$('#notify').checked=main.notificationsEnabled;$('#interval').value=$('#apiWhisperInterval').value=main.eventsRefreshSec.whisper;$('#advanced').value=JSON.stringify(main,null,2);
}
async function save(value){$('#save').disabled=true;$('#result').textContent='正在保存…';try{const r=await fetch(base+'/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const j=await r.json();if(!r.ok)throw new Error(j.error||j.message);main=j.main;render();$('#result').textContent='已保存，宠物窗口已更新';}catch(e){$('#result').textContent=e.message;}finally{$('#save').disabled=false;}}
$('#save').onclick=()=>{main.physics.petCollision=$('#collision').checked;main.notificationsEnabled=$('#notify').checked;main.eventsRefreshSec.whisper=Math.max(60,Number($('#interval').value)||300);save(main);};
$('#saveAdvanced').onclick=()=>{try{save(JSON.parse($('#advanced').value));}catch(e){$('#result').textContent=e.message;}};
$('#add').onclick=()=>{if(main.pets.length>=6)return;main.pets.push({...structuredClone(main.pets[0]),id:'pet-'+Date.now(),name:'蓝毛伙伴 '+(main.pets.length+1),whisperEnabled:false,position:{corner:'bottom-right',marginX:80+main.pets.length*100,marginY:30}});render();};
async function status(){try{
  const j=await(await fetch(base+'/health')).json();
  const names={thinking:'思考',working:'执行工具',result:'整理结果',waiting:'等待确认',error:'工具出错',success:'回合完成'};
  const counts=Object.entries(j.work.counts||{}).map(([k,n])=>(names[k]||k)+' '+n).join(' / ');
  $('#status').textContent='本地播放器已连接 · '+j.animations+' 段动画\n'+(j.monitor?.lastEvent?'本地会话状态：'+j.monitor.lastEvent.event+'（'+new Date(j.monitor.lastEvent.at).toLocaleTimeString()+'）\n已知任务：'+(counts||'当前空闲'):j.lastHook?'最近事件：'+j.lastHook.event+'（'+new Date(j.lastHook.at).toLocaleTimeString()+'）\n已知任务：'+(counts||'当前空闲'):'尚未观测到任务事件。连接模式会同时检查本机会话状态和 Hooks；请开始或继续一个任务。');
}catch{$('#status').textContent='桌宠服务已关闭';}}

settingsLoads.push(fetch(base+'/config').then(r=>r.json()).then(j=>{main=j.main;render();status();}).catch(e=>$('#status').textContent=e.message));
setInterval(status,3000);

async function api(route,method='GET',body){const r=await fetch(base+route,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw new Error(j.message||j.error||'请求失败');return j;}
function showConnection(c){
  $('#reviewHooks').hidden=!c.needsReview;
  const local=c.monitor?.lastEvent;
  $('#connectionStatus').textContent=(local?'本地任务状态已接通（'+new Date(local.at).toLocaleTimeString()+'） · ':'')+(c.ready?(c.lastHook?'事件配置已信任，已收到事件：'+c.lastHook.event:'Hooks 已信任，但尚未收到 Hook；任务反馈可由本地会话状态提供。'):c.needsReview?'已安装 '+c.installed+' 项事件配置，其中 '+c.needsReview+' 项尚未信任。':c.disabled?'有事件配置被停用，请在 /hooks 中检查。':'联动配置未完整加载，请点击连接并检查。');
}
async function connectionStatus(){if(currentMode!=='connected')return;try{showConnection(await api('/connection'));}catch(e){$('#connectionStatus').textContent='联动检查失败：'+e.message;}}
$('#connect').onclick=async()=>{loadQuotaContext();try{showConnection(await api('/connect','POST'));await loadPreferences();}catch(e){$('#connectionStatus').textContent=e.message;}};
$('#reviewHooks').onclick=async()=>{try{await api('/review-hooks','POST');$('#connectionStatus').textContent='已打开信任入口，请输入 /hooks 审阅桌宠事件。';}catch(e){$('#connectionStatus').textContent=e.message;}};
setInterval(connectionStatus,15000);
function fillQuota(q){
  window.PetSettingsAutosave?.clear('proxy');
  $('#quotaSource').value=q.selected;
  const p=q.proxy||{};
  for(const [id,key]of [['proxyName','name'],['proxyEndpoint','endpoint'],['envName','envName'],['valuePath','valuePath'],['totalPath','totalPath'],['quotaUnit','unit']])$('#'+id).value=p[key]||'';
  $('#credential').value=p.credential||'api';$('#authHeader').value=p.header||'Authorization';$('#bearer').checked=p.bearer!==false;$('#quotaFormat').value=p.format||'remaining';$('#quotaScale').value=p.scale||1;
  $('#proxyKey').placeholder='输入新密钥可替换已保存的密钥';maskSecret($('#proxyKey'),p.hasSecret);$('#proxyProfileName').value=p.profileName||'';updateCredentialFields();
  $('#proxyKeyPreview').textContent=p.keyPreview?'已保存密钥：'+p.keyPreview:p.hasSecret?'已保存密钥（当前无法读取前缀）':'';
  $('#proxyDetails').open=!!q.proxy;
  $('#clientCredential').value=$('#credential').value;
  if(currentMode==='pet')$('#quotaSource').value='proxy';
}
async function saveCurrentQuota(){
    const endpoint=$('#proxyEndpoint').value.trim();
    const proxy=endpoint?{endpoint,name:$('#proxyName').value,credential:$('#credential').value,envName:$('#envName').value.trim(),key:enteredSecret($('#proxyKey')),profileName:$('#proxyProfileName').value,header:$('#authHeader').value,bearer:$('#bearer').checked,format:$('#quotaFormat').value,valuePath:$('#valuePath').value.trim(),totalPath:$('#totalPath').value.trim(),scale:Number($('#quotaScale').value),unit:$('#quotaUnit').value}:null;
    fillQuota(await api('/quota/settings','PUT',{selected:'proxy',proxy}));
}
$('#saveProxy').onclick=async()=>{try{await saveCurrentQuota();$('#quotaResult').textContent='当前查询配置已保存。';}catch(e){$('#quotaResult').textContent=e.message;}};
$('#saveQuota').onclick=async()=>{try{await api('/quota/settings','PUT',{selected:$('#quotaSource').value,selectedOnly:true});$('#accountResult').textContent='额度来源已保存。';}catch(e){$('#accountResult').textContent=e.message;}};
$('#clearProxy').onclick=async()=>{
  try{fillQuota(await api('/quota/settings','DELETE'));$('#proxyDetails').open=true;$('#quotaResult').textContent='已清除当前查询配置及其中保存的密钥；命名配置列表保留。';}
  catch(e){$('#quotaResult').textContent=e.message;}
};
async function queryQuota(source){
  const output=source==='account'?$('#accountResult'):$('#quotaResult');
  output.textContent='正在查询…';
  try{const q=await api('/quota/query?source='+source);if(!q.ok)throw new Error(q.message||'未返回额度');output.textContent=q.kind==='codex'?window.PetShared.balanceBubbleView(q).map(row=>row.text).join('\n'):q.format==='monitor'?(q.provider+'：'+q.rows.join('；')):q.provider+' '+(q.format==='remaining'?'剩余 ':'已用 ')+Number(q.value.toFixed(4))+(q.format==='usedPercent'?'%':' '+q.unit);}catch(e){output.textContent=e.message;}
}
$('#queryAccount').onclick=()=>queryQuota('account');
$('#queryCurrent').onclick=()=>queryQuota('proxy');
settingsLoads.push(api('/quota/settings').then(fillQuota).catch(e=>$('#quotaResult').textContent=e.message));
function loadQuotaContext(){if(currentMode!=='connected')return;api('/quota/context').then(c=>{$('#quotaContext').textContent=c.skipped?c.message:'登录方式：'+({chatgpt:'ChatGPT 账户',apiKey:'API 密钥'}[c.accountType]||c.accountType||'未登录')+'；当前服务商：'+c.provider+(c.envName?'；密钥来源：'+c.envName+(c.hasEnvironmentKey?'（已找到）':'（当前进程未找到）'):'');}).catch(e=>$('#quotaContext').textContent=e.message);}

let appearance;
async function loadAppearance(){
  try{
    appearance=await api('/appearance');
    const fonts=await api('/appearance/fonts');
    for(const id of ['appearanceFont','feedbackFont']){
    const select=$('#'+id);select.replaceChildren();
    const all=[['SimSun','宋体（默认）'],...fonts.filter(f=>f!=='SimSun').map(f=>[f,f])];
    for(const [value,label] of all){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
    for(const f of appearance.customFonts||[]){const o=document.createElement('option');o.value=f.id;o.textContent='已导入：'+f.name;select.append(o);}
    if(id==='feedbackFont'){const o=new Option('上首软糖体（原有字体）','ShangshouSoftCandy');select.prepend(o);}
    const selected=id==='feedbackFont'?appearance.feedback:appearance;
    if(selected?.family&&![...select.options].some(o=>o.value===selected.family))select.append(new Option(selected.family,selected.family));
    select.value=selected?.family||(id==='feedbackFont'?'ShangshouSoftCandy':'SimSun');
    }
    await window.PetAppearance.apply(base,appearance,[$('#quotaResult'),$('#accountResult')]);
    await previewFeedbackFont();
  }catch(e){$('#appearanceResult').textContent=e.message;}
}
$('#saveAppearance').onclick=async()=>{try{const family=$('#appearanceFont').value;const value=await api('/appearance','PUT',{family,source:appearance?.customFonts?.some(f=>f.id===family)?'file':'system'});appearance=value;await window.PetAppearance.apply(base,value,[$('#quotaResult'),$('#accountResult')]);$('#appearanceResult').textContent='字体设置已保存；额度气泡将在几秒内更新。';}catch(e){$('#appearanceResult').textContent=e.message;}};
$('#importFont').onclick=async()=>{try{await api('/appearance/import','POST');await loadAppearance();$('#appearanceResult').textContent='字体设置已更新。';}catch(e){$('#appearanceResult').textContent=e.message;}};
async function previewFeedbackFont(){const family=$('#feedbackFont').value;await window.PetAppearance.apply(base,{...appearance,family,source:appearance?.customFonts?.some(f=>f.id===family)?'file':'system'},[$('#feedbackFontPreview')]);}
$('#feedbackFont').onchange=()=>previewFeedbackFont().catch(e=>$('#feedbackFontResult').textContent=e.message);
$('#saveFeedbackFont').onclick=async()=>{try{const family=$('#feedbackFont').value;appearance=await api('/appearance','PUT',{target:'feedback',family,source:appearance?.customFonts?.some(f=>f.id===family)?'file':'system'});await previewFeedbackFont();$('#feedbackFontResult').textContent='已保存，气泡将在几秒内更新。';}catch(e){$('#feedbackFontResult').textContent=e.message;}};
$('#importFeedbackFont').onclick=async()=>{try{await api('/appearance/import','POST',{target:'feedback'});await loadAppearance();$('#feedbackFontResult').textContent='已导入并应用反馈字体。';}catch(e){$('#feedbackFontResult').textContent=e.message;}};
$('#saveAutoWhisper').onclick=async()=>{const button=$('#saveAutoWhisper');button.disabled=true;try{const interval=Number($('#interval').value);if(!Number.isFinite(interval)||interval<60||interval>86400)throw new Error('间隔须在 60 到 86400 秒之间');await api('/preferences','PUT',{autoWhisperProbability:Number($('#autoWhisperProbability').value)});main.eventsRefreshSec.whisper=interval;const value=await api('/config','PUT',main);main=value.main;render();$('#autoWhisperResult').textContent='已保存，从现在起等待一个完整间隔。';}catch(e){$('#autoWhisperResult').textContent=e.message;}finally{button.disabled=false;}};
for(const [a,b] of [['interval','apiWhisperInterval'],['autoWhisperProbability','apiWhisperProbability']])for(const [source,target] of [[a,b],[b,a]])$('#'+source).oninput=()=>{$('#'+target).value=$('#'+source).value;};
$('#saveApiAutoWhisper').onclick=async()=>{const button=$('#saveApiAutoWhisper');button.disabled=true;try{$('#interval').value=$('#apiWhisperInterval').value;$('#autoWhisperProbability').value=$('#apiWhisperProbability').value;await $('#saveAutoWhisper').onclick();$('#apiAutoWhisperResult').textContent=$('#autoWhisperResult').textContent;}finally{button.disabled=false;}};
$('#restoreTray').onclick=()=>api('/tray/show','POST').catch(e=>$('#appearanceResult').textContent=e.message);
settingsLoads.push(loadAppearance());
async function loadPreferences(){try{const p=await api('/preferences');if(window.PetSettingsAutosave?.dirty)return;$('#quotaAfterTurn').checked=p.quotaAfterTurn;$('#quotaMode').value=p.quotaMode;$('#quotaSeconds').value=p.quotaSeconds;$('#whisperStreaming').checked=p.whisperStreaming;$('#autoWhisperProbability').value=$('#apiWhisperProbability').value=p.autoWhisperProbability;applyMode(p.mode);for(const key of ['disableEventResponse','ignoreAccountTimeouts','taskBasicFeedback','taskNativeFeedback'])$('#'+key).checked=p[key];$('#disableRoaming').checked=p.disableRoaming;showSourceChoice(p);loadModuleOrder(p.moduleOrder);document.querySelector('input[name=replyMode][value='+p.replyMode+']').checked=true;$('#replySeconds').value=p.replySeconds;$('#alwaysOnTop').checked=p.alwaysOnTop;$('#fullscreenMode').value=p.fullscreenMode;$('#clickAction').value=p.clickAction;$('#actionSpeed').value=p.actionSpeed;for(const k of ['autostart','followClientStart','followClientClose'])$('#'+k).checked=p[k];$('#snapMode').value=p.snapMode;}catch(e){$('#preferencesResult').textContent=e.message;}}
$('#savePreferences').onclick=async()=>{try{await api('/preferences','PUT',{alwaysOnTop:$('#alwaysOnTop').checked,fullscreenMode:$('#fullscreenMode').value,clickAction:$('#clickAction').value,actionSpeed:Number($('#actionSpeed').value)});$('#preferencesResult').textContent='已保存，几秒内生效。';}catch(e){$('#preferencesResult').textContent=e.message;}};
async function changeMode(){
  $('#petMode').disabled=$('#connectedMode').disabled=true;
  try{const p=await api('/preferences','PUT',{mode:$('#connectedMode').checked?'connected':'pet'});applyMode(p.mode);selectTab(p.mode==='connected'?'gpt':'basic');showSourceChoice(p);$('#modeResult').textContent=p.mode==='connected'?'连接功能已展开，点击连接完成事件配置。':'纯桌宠模式已启用，可使用自有 API。';}
  catch(e){$('#modeResult').textContent=e.message;await loadPreferences();}
  finally{$('#petMode').disabled=$('#connectedMode').disabled=false;}
}
$('#petMode').onchange=$('#connectedMode').onchange=changeMode;
$('#saveLifecycle').onclick=async()=>{try{await api('/preferences','PUT',{autostart:$('#autostart').checked,snapMode:$('#snapMode').value});$('#lifecycleResult').textContent='已保存。';}catch(e){$('#lifecycleResult').textContent=e.message;}};
$('#chooseCodex').onclick=async()=>{try{const r=await api('/runtime/choose','POST');$('#runtimeResult').textContent=r.canceled?'未更改':'已选择运行程序';}catch(e){$('#runtimeResult').textContent=e.message;}};

let sourceChoiceDeferred=false;
function showSourceChoice(p){
  $('#chatSource').value=p.chatSource;
  if(p.mode==='connected'&&!p.chatSourceChosen&&!sourceChoiceDeferred&&!$('#sourceDialog').open)$('#sourceDialog').showModal();
  if((p.mode!=='connected'||p.chatSourceChosen)&&$('#sourceDialog').open)$('#sourceDialog').close();
}
async function selectChatSource(source){
  try{const p=await api('/preferences','PUT',{chatSource:source,chatSourceChosen:true});showSourceChoice(p);$('#chatSourceResult').textContent='已保存，聊天和碎碎念将使用'+(source==='api'?'自有 API。':'GPT 当前账户 / config 配置。');if(source==='api'){selectTab('basic');$('#apiSection').scrollIntoView({behavior:'smooth'});}}
  catch(e){$('#sourceDialogResult').textContent=$('#chatSourceResult').textContent=e.message;}
}
$('#saveChatSource').onclick=()=>selectChatSource($('#chatSource').value);
$('#chooseGptSource').onclick=()=>selectChatSource('gpt');$('#chooseApiSource').onclick=()=>selectChatSource('api');
$('#chooseSourceLater').onclick=()=>{sourceChoiceDeferred=true;$('#sourceDialog').close();};
$('#sourceDialog').addEventListener('cancel',()=>{sourceChoiceDeferred=true;});
settingsLoads.push(loadPreferences());
function fillApiSettings(a){window.PetSettingsAutosave?.clear('api');$('#apiProfileName').value=a.profileName||'';$('#apiBaseUrl').value=a.baseUrl;$('#apiModel').value=a.model;maskSecret($('#apiKey'),a.configured);$('#apiKey').placeholder='输入新密钥可替换已保存的密钥';}
async function loadApiSettings(){try{fillApiSettings(await api('/api/settings'));}catch(e){$('#apiResult').textContent=e.message;}}
async function saveCurrentApi(){const a=await api('/api/settings','PUT',{profileName:$('#apiProfileName').value,baseUrl:$('#apiBaseUrl').value.trim(),model:$('#apiModel').value.trim(),apiKey:enteredSecret($('#apiKey'))});fillApiSettings(a);return a;}
$('#saveApi').onclick=async()=>{try{await saveCurrentApi();$('#apiResult').textContent='当前 API 配置已保存并应用。';}catch(e){$('#apiResult').textContent=e.message;}};
$('#clearApi').onclick=async()=>{try{fillApiSettings(await api('/api/settings','DELETE'));$('#apiResult').textContent='当前 API 地址、模型和密钥已清除；已保存列表不受影响。';}catch(e){$('#apiResult').textContent=e.message;}};
let savedApiProfiles=[],savedProxyProfiles=[];
function fillApiProfiles(items){savedApiProfiles=items;const select=$('#apiProfiles'),previous=select.value;select.replaceChildren();for(const p of items){const o=text('option',p.name);o.value=p.id;select.append(o);}if(items.some(p=>p.id===previous))select.value=previous;$('#loadApiProfile').disabled=$('#deleteApiProfile').disabled=!items.length;showProfileSummary('api');}
async function loadApiProfiles(){try{fillApiProfiles(await api('/api/profiles'));}catch(e){$('#apiResult').textContent=e.message;}}
$('#saveApiProfile').onclick=async()=>{try{const name=$('#apiProfileName').value.trim();if(!name)throw new Error('请填写配置名称');await saveCurrentApi();fillApiProfiles(await api('/api/profiles','POST',{name}));$('#apiResult').textContent='已保存到配置列表：'+name+'（同名配置会更新）。';}catch(e){$('#apiResult').textContent=e.message;}};
$('#loadApiProfile').onclick=async()=>{try{fillApiSettings(await api('/api/profiles/load','POST',{id:$('#apiProfiles').value}));$('#apiProfileName').value=$('#apiProfiles').selectedOptions[0]?.textContent||'';$('#apiResult').textContent='配置已载入并应用。';}catch(e){$('#apiResult').textContent=e.message;}};
$('#deleteApiProfile').onclick=async()=>{try{fillApiProfiles(await api('/api/profiles?id='+encodeURIComponent($('#apiProfiles').value),'DELETE'));$('#apiResult').textContent='已删除列表中的配置；当前正在使用的配置保留。';}catch(e){$('#apiResult').textContent=e.message;}};
settingsLoads.push(loadApiSettings(),loadApiProfiles());
window.addEventListener('focus',()=>{if(!window.PetSettingsAutosave?.dirty)loadPreferences();});

$('#openApiSettings').onclick=()=>{selectTab('basic');$('#apiSection').scrollIntoView({behavior:'smooth'});};
$('#openProxySettings').onclick=()=>{selectTab('basic');$('#proxyDetails').open=true;$('#proxyDetails').scrollIntoView({behavior:'smooth'});};
$('#clientCredential').onchange=()=>{$('#credential').value=$('#clientCredential').value;updateCredentialFields();};
$('#credential').onchange=()=>{$('#clientCredential').value=$('#credential').value;updateCredentialFields();};
$('#saveClientLifecycle').onclick=async()=>{try{await api('/preferences','PUT',{followClientStart:$('#followClientStart').checked,followClientClose:$('#followClientClose').checked});$('#clientLifecycleResult').textContent='已保存。';}catch(e){$('#clientLifecycleResult').textContent=e.message;}};
$('#saveClientPets').onclick=async()=>{main.notificationsEnabled=$('#notify').checked;await save(main);$('#clientPetsResult').textContent=$('#result').textContent;};
function fillProxyProfiles(items){savedProxyProfiles=items;const select=$('#proxyProfiles'),previous=select.value;select.replaceChildren();for(const p of items){const option=text('option',p.name);option.value=p.id;select.append(option);}if(items.some(p=>p.id===previous))select.value=previous;$('#loadProxyProfile').disabled=$('#deleteProxyProfile').disabled=!items.length;showProfileSummary('proxy');}
$('#saveProxyProfile').onclick=async()=>{try{const name=$('#proxyProfileName').value.trim();if(!name)throw new Error('请填写查询配置名称');await saveCurrentQuota();fillProxyProfiles(await api('/quota/profiles','POST',{name}));$('#quotaResult').textContent='查询配置已保存到列表：'+name;}catch(e){$('#quotaResult').textContent=e.message;}};
$('#loadProxyProfile').onclick=async()=>{try{fillQuota(await api('/quota/profiles/load','POST',{id:$('#proxyProfiles').value}));$('#proxyProfileName').value=$('#proxyProfiles').selectedOptions[0]?.textContent||'';$('#quotaResult').textContent='查询配置已载入并应用。';}catch(e){$('#quotaResult').textContent=e.message;}};
$('#deleteProxyProfile').onclick=async()=>{try{fillProxyProfiles(await api('/quota/profiles?id='+encodeURIComponent($('#proxyProfiles').value),'DELETE'));$('#quotaResult').textContent='已删除列表中的查询配置；当前配置保留。';}catch(e){$('#quotaResult').textContent=e.message;}};
api('/quota/profiles').then(fillProxyProfiles).catch(e=>$('#quotaResult').textContent=e.message);

function updateCredentialFields(){const source=$('#credential').value;$('#envName').closest('label').hidden=source!=='env';$('#proxyKey').closest('label').hidden=source!=='manual';$('#proxyKeyPreview').hidden=source!=='manual';}
$('#saveReply').onclick=async()=>{try{await api('/preferences','PUT',{replyMode:document.querySelector('input[name=replyMode]:checked').value,replySeconds:Number($('#replySeconds').value)});$('#replyResult').textContent='已保存，当前气泡会按新设置调整。';}catch(e){$('#replyResult').textContent=e.message;}};
let moduleOrderLoaded=false,moduleDrag=null,orderSaving=Promise.resolve();
const modules=panel=>[...panel.querySelectorAll(':scope > section[data-module]')];
function loadModuleOrder(order){if(moduleOrderLoaded)return;moduleOrderLoaded=true;for(const tab of ['basic','gpt']){const panel=$('#'+tab+'Panel'),items=modules(panel),byId=new Map(items.map(e=>[e.id,e])),anchor=[...panel.children].find(e=>!e.hasAttribute('data-module'))||null;for(const id of [...(order?.[tab]||[]),...items.map(e=>e.id)]){const e=byId.get(id);if(e){panel.insertBefore(e,anchor);byId.delete(id);}}}}
function saveModuleOrder(){window.PetSettingsAutosave?.mark('moduleOrder');const moduleOrder=Object.fromEntries(['basic','gpt'].map(tab=>[tab,modules($('#'+tab+'Panel')).map(e=>e.id)]));orderSaving=orderSaving.catch(()=>{}).then(()=>api('/preferences','PUT',{moduleOrder})).then(()=>{window.PetSettingsAutosave?.clear('moduleOrder');$('#moduleOrderStatus').textContent='模块顺序已自动保存。';},e=>{$('#moduleOrderStatus').textContent='顺序保存失败：'+e.message;});return orderSaving;}
function moveModule(section,direction){const list=modules(section.parentElement),at=list.indexOf(section),other=list[at+direction];if(!other)return;section.parentElement.insertBefore(section,direction<0?other:other.nextSibling);return saveModuleOrder();}
function updateModuleDrop(drag){
  const bounds=drag.panel.getBoundingClientRect(),tabs=document.querySelector('.settings-tabs').getBoundingClientRect();
  drag.valid=!drag.panel.hidden&&drag.x>=bounds.left&&drag.x<=bounds.right&&drag.y>=tabs.bottom&&drag.y<=innerHeight;
  const candidates=modules(drag.panel).filter(section=>section!==drag.section);
  drag.before=candidates.find(section=>{const r=section.getBoundingClientRect();return drag.y<r.top+Math.min(70,r.height/2);})||null;
  const last=candidates.at(-1),edge=drag.before?drag.before.getBoundingClientRect().top:last?last.getBoundingClientRect().bottom:bounds.top;
  drag.marker.hidden=!drag.valid;
  Object.assign(drag.marker.style,{left:bounds.left+'px',width:bounds.width+'px',top:Math.max(tabs.bottom+4,Math.min(innerHeight-8,edge-10))+'px'});
  drag.preview.textContent=drag.valid?(drag.before?'放到「'+drag.before.querySelector('h2').textContent+'」之前':'放到当前选项卡末尾'):'拖回当前选项卡内放置';
  Object.assign(drag.preview.style,{left:Math.max(8,Math.min(innerWidth-288,drag.x-140))+'px',top:Math.max(tabs.bottom+8,Math.min(innerHeight-48,drag.y+18))+'px'});
}
function runModuleDrag(){
  const drag=moduleDrag;if(!drag?.started)return;
  const top=Math.max(90,document.querySelector('.settings-tabs').getBoundingClientRect().bottom+36),bottom=innerHeight-60;
  const now=performance.now(),elapsed=Math.min(40,now-(drag.frameAt||now));drag.frameAt=now;
  const speed=drag.y<top?-Math.min(700,(top-drag.y)*12):drag.y>bottom?Math.min(700,(drag.y-bottom)*12):0;
  if(speed&&drag.x>=drag.panel.getBoundingClientRect().left&&drag.x<=drag.panel.getBoundingClientRect().right)window.scrollBy(0,speed*elapsed/1000);
  updateModuleDrop(drag);drag.frame=requestAnimationFrame(runModuleDrag);
}
function finishModuleDrag(commit=false){
  const drag=moduleDrag;if(!drag)return;moduleDrag=null;
  cancelAnimationFrame(drag.frame);drag.preview?.remove();drag.marker?.remove();drag.section.classList.remove('module-dragging');document.documentElement.classList.remove('module-sorting');
  if(drag.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
  if(commit&&drag.started&&drag.valid){
    // Keep the captured handle in place throughout the gesture; reorder only on release.
    const anchor=drag.before||[...drag.panel.children].find(e=>!e.hasAttribute('data-module'))||null;
    drag.panel.insertBefore(drag.section,anchor);
    if(modules(drag.panel).some((section,i)=>section!==drag.original[i]))void saveModuleOrder();
  }
}
document.addEventListener('pointermove',e=>{
  const drag=moduleDrag;if(!drag||drag.pointerId!==e.pointerId)return;
  drag.x=e.clientX;drag.y=e.clientY;
  if(!drag.started&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>=5){
    drag.started=true;drag.section.classList.add('module-dragging');document.documentElement.classList.add('module-sorting');
    drag.preview=text('div','');drag.preview.className='module-drag-preview';drag.preview.setAttribute('aria-hidden','true');
    drag.marker=text('div','');drag.marker.className='module-drop-marker';drag.marker.setAttribute('aria-hidden','true');
    document.body.append(drag.preview,drag.marker);runModuleDrag();
  }
  if(drag.started){e.preventDefault();updateModuleDrop(drag);}
},{passive:false});
document.addEventListener('pointerup',e=>{const drag=moduleDrag;if(!drag||drag.pointerId!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;if(drag.started)updateModuleDrop(drag);finishModuleDrag(true);});
document.addEventListener('pointercancel',e=>{if(moduleDrag?.pointerId===e.pointerId)finishModuleDrag();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&moduleDrag){e.preventDefault();finishModuleDrag();}});
window.addEventListener('blur',()=>finishModuleDrag());
for(const tab of ['basic','gpt']){
 const panel=$('#'+tab+'Panel');
 for(const section of modules(panel)){
  const handle=section.querySelector('.module-handle');
  handle.draggable=false;
  handle.onkeydown=e=>{if(!moduleDrag&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();moveModule(section,e.key==='ArrowUp'?-1:1);}};
  handle.ondragstart=e=>e.preventDefault();
  handle.onpointerdown=e=>{
    if(e.button!==0||!e.isPrimary||moduleDrag)return;
    e.preventDefault();handle.focus({preventScroll:true});
    moduleDrag={section,panel,handle,pointerId:e.pointerId,original:modules(panel),startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,started:false};
    handle.setPointerCapture(e.pointerId);
  };
  handle.onlostpointercapture=e=>{if(moduleDrag?.pointerId===e.pointerId)finishModuleDrag();};
 }
}

function showProfileSummary(kind){
  const items=kind==='api'?savedApiProfiles:savedProxyProfiles;
  const profile=items.find(p=>p.id===$('#'+kind+'Profiles').value),box=$('#'+kind+'ProfileSummary');box.replaceChildren();
  if(!profile){box.textContent='尚无已保存配置。';return;}
  const sources={manual:'手动密钥（系统加密保存）',api:'自有 API 设置中的密钥',env:'指定环境变量',provider:'当前 config.toml 服务商',auth:'Codex API 密钥登录'};
  const formats={remaining:'剩余额度',usedPercent:'已用百分比',monitor:'监测信息'};
  const rows=kind==='api'?[['API 地址',profile.baseUrl],['模型',profile.model],['密钥','已加密保存']]:[['查询接口',profile.endpoint],['服务名称',profile.serviceName],['密钥来源',sources[profile.credential]||profile.credential],['查询方式',profile.adapter==='crs'?'CRS 统计接口':'通用 JSON 接口'],['显示内容',formats[profile.format]||profile.format],['数值字段',profile.valuePath],['单位',profile.unit]];
  const dl=document.createElement('dl');for(const [label,value] of rows)if(value){dl.append(text('dt',label),text('dd',value));}box.append(dl);
}
$('#apiProfiles').onchange=()=>showProfileSummary('api');
$('#proxyProfiles').onchange=()=>showProfileSummary('proxy');
const logOperations={'chat-api':'自有 API 聊天','chat-gpt':'GPT 聊天','whisper-api':'自有 API 碎碎念','whisper-gpt':'GPT 碎碎念','quota-proxy':'密钥额度查询','quota-account':'账户额度查询','quota-context':'读取登录与服务商配置','connection-inspect':'检查 Hooks 配置','connection-monitor':'读取本地任务状态',settings:'设置',logs:'日志管理',runtime:'运行'};
async function refreshLogs(){
  try{
    const data=await api('/logs');$('#logDirectory').textContent='日志目录：'+data.directory;
    $('#logSummary').textContent=data.writeFailed?'日志写入失败，请检查目录权限和磁盘空间。':'共 '+data.count+' 条未忽略的记录；下方显示最近 20 条。'+(data.ignoredCount?'已隐藏 '+data.ignoredCount+' 条账户超时历史记录。':'');
    const list=$('#logEntries');list.replaceChildren();
    for(const entry of data.entries){const li=text('li',new Date(entry.at).toLocaleString()+' · '+(logOperations[entry.operation]||'运行')+' · '+entry.id+(entry.status?' · HTTP '+entry.status:'')+(entry.stage?' · '+entry.stage:'')+'\n'+entry.message);list.append(li);}
    const latest=data.entries[0];$('#errorBanner').hidden=!latest&&!data.writeFailed;$('#noRecentErrors').hidden=!!latest||data.writeFailed;
    $('#errorBannerText').textContent=data.writeFailed?'错误日志无法写入，请检查日志目录。':latest?'最近错误：'+(logOperations[latest.operation]||'运行')+' · '+new Date(latest.at).toLocaleString()+' · '+latest.message:'';
  }catch(e){$('#logResult').textContent='读取日志失败：'+e.message;}
}
$('#viewErrorLogs').onclick=()=>{selectTab('basic');$('#diagnosticsSection').scrollIntoView({block:'start'});};
$('#refreshLogs').onclick=refreshLogs;
for(const [id,route,success] of [['openLogs','/logs/open','已打开日志目录。'],['exportLogs','/logs/export','日志已导出，可将文件用于反馈。'],['clearLogs','/logs','错误日志已删除。']]){
  $('#'+id).onclick=async()=>{const button=$('#'+id);button.disabled=true;try{const value=await api(route,id==='clearLogs'?'DELETE':'POST');$('#logResult').textContent=value.canceled?'已取消导出。':success;await refreshLogs();}catch(e){$('#logResult').textContent=e.message;}finally{button.disabled=false;}};
}
refreshLogs();setInterval(refreshLogs,5000);

$('#disableRoaming').onchange=async()=>{const input=$('#disableRoaming');input.disabled=true;try{await api('/preferences','PUT',{disableRoaming:input.checked});$('#roamingResult').textContent=input.checked?'已禁止自主跑动。':'已允许自主跑动。';}catch(e){input.checked=!input.checked;$('#roamingResult').textContent=e.message;}finally{input.disabled=false;}};

$('#ignoreAccountTimeouts').onchange=async()=>{const input=$('#ignoreAccountTimeouts');input.disabled=true;try{await api('/preferences','PUT',{ignoreAccountTimeouts:input.checked});$('#ignoreErrorsResult').textContent=input.checked?'已忽略账户读取超时；其他错误仍会提示。':'已恢复账户错误提示。';await refreshLogs();if(currentMode==='connected')loadQuotaContext();}catch(e){input.checked=!input.checked;$('#ignoreErrorsResult').textContent=e.message;}finally{input.disabled=false;}};
for(const id of ['taskBasicFeedback','taskNativeFeedback'])$('#'+id).onchange=async()=>{const input=$('#'+id);input.disabled=true;try{await api('/preferences','PUT',{[id]:input.checked});$('#taskFeedbackResult').textContent='已保存，任务反馈已更新。';}catch(e){input.checked=!input.checked;$('#taskFeedbackResult').textContent=e.message;}finally{input.disabled=false;}};

$('#whisperStreaming').onchange=async()=>{try{await api('/preferences','PUT',{whisperStreaming:$('#whisperStreaming').checked});$('#whisperStreamingResult').textContent='已保存，下次碎碎念生效。';}catch(e){$('#whisperStreamingResult').textContent=e.message;}};

$('#saveQuotaBubble').onclick=async()=>{try{await api('/preferences','PUT',{quotaMode:$('#quotaMode').value,quotaSeconds:Number($('#quotaSeconds').value)});$('#quotaBubbleResult').textContent='已保存。';}catch(e){$('#quotaBubbleResult').textContent=e.message;}};
$('#refreshWhisperHistory').onclick=async()=>{try{const records=await api('/whisper/history?pet='+encodeURIComponent($('#whisperHistoryPet').value));$('#whisperHistoryList').replaceChildren();for(const r of records)$('#whisperHistoryList').append(text('li',new Date(r.at).toLocaleTimeString()+' '+r.text));$('#whisperHistoryStatus').textContent=records.length?'本次运行共 '+records.length+' 条。':'本次运行还没有碎碎念记录。';}catch(e){$('#whisperHistoryStatus').textContent=e.message;}};
$('#whisperHistoryPet').onchange=()=>$('#refreshWhisperHistory').onclick();
