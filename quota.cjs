const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {issue,networkIssue}=require('./diagnostics.cjs');
const {normalizeStats}=require('./crs.cjs');

function normalizeCodexUsage(raw,queriedAt=Date.now()){
  const entries=Object.values(raw.rateLimitsByLimitId||{});
  const bucket=raw.rateLimitsByLimitId?.codex||entries.find(value=>value?.limitId==='codex')||raw.rateLimits||entries[0];
  const windows=[bucket?.primary,bucket?.secondary].filter(value=>value&&Number.isFinite(value.usedPercent)).map(value=>{
    const reset=Number.isFinite(value.resetsAt)?new Date(value.resetsAt*1000):null;
    return {percent:Math.max(0,Math.min(100,value.usedPercent)),minutes:Number.isFinite(value.windowDurationMins)&&value.windowDurationMins>0?value.windowDurationMins:null,resetsAt:reset&&Number.isFinite(reset.getTime())?reset.toISOString():undefined};
  });
  if(!windows.length)throw new Error('此账户未返回可用额度窗口');
  const count=raw.rateLimitResetCredits?.availableCount;
  return {ok:true,provider:'Codex',kind:'codex',windows,queriedAt,availableResetCount:Number.isSafeInteger(count)&&count>=0?count:null};
}

function pick(data,field){
  if(!field)return undefined;
  return field.split('.').reduce((v,k)=>v&&typeof v==='object'&&Object.hasOwn(v,k)?v[k]:undefined,data);
}
function number(value){
  if(value===null||value===undefined||typeof value==='boolean'||value==='')return undefined;
  const n=Number(value);return Number.isFinite(n)?n:undefined;
}
function validate(raw){
  const endpoint=new URL(raw.endpoint);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw new Error('查询接口必须是 HTTPS 地址，不能把密钥放在网址参数里');
  const adapter=raw.adapter==='crs'||(endpoint.hostname==='crs.uuid.im'&&endpoint.pathname.replace(/\/$/,'')==='/admin-next/api-stats')?'crs':'json';
  if(!['env','provider','auth','manual','api'].includes(raw.credential))throw new Error('请选择密钥来源');
  if(!['Authorization','x-api-key'].includes(raw.header))throw new Error('不支持的鉴权头');
  if(!['remaining','usedPercent','monitor'].includes(raw.format)||(adapter==='json'&&raw.format==='monitor'))throw new Error('监测信息模式仅支持 CRS；普通接口请选择余额或百分比');
  for(const key of ['valuePath','totalPath'])if(raw[key]&&!/^[\w.-]{1,150}$/.test(raw[key]))throw new Error('JSON 字段路径无效');
  if(adapter==='json'&&!raw.valuePath)throw new Error('请填写余额或已用比例的 JSON 字段路径');
  const scale=Number(raw.scale??1);if(!Number.isFinite(scale)||scale<=0)throw new Error('换算系数必须大于 0');
  const envName=String(raw.envName||'');if(raw.credential==='env'&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envName))throw new Error('请填写有效的环境变量名');
  return {profileName:String(raw.profileName||'').slice(0,80),adapter,endpoint:endpoint.href,credential:raw.credential,header:raw.header,bearer:raw.bearer!==false,format:raw.format,valuePath:raw.valuePath||'',totalPath:raw.totalPath||'',scale,unit:String(raw.unit||'').slice(0,16),name:String(raw.name||'密钥额度').slice(0,40),envName};
}
class QuotaService{
  constructor({dataDir,client,protect,unprotect,getApiKey=async()=>null,fetcher=fetch}){
    Object.assign(this,{dataDir,client,protect,unprotect,getApiKey,fetcher});this.store=new (require('./settings-store.cjs').SettingsStore)(dataDir);this.file=this.store.file;
    this.settings=this.store.get('quota',{selected:'account',proxy:null});if(!this.store.has('quota'))this.store.set('quota',this.settings);
  }
  publicSettings(){
    const p=this.settings.proxy;let keyPreview='';
    if(p?.secret){try{const key=this.unprotect?.(p.secret);if(key)keyPreview=key.length>7?key.slice(0,7)+'…':'•••••••';}catch{}}
    return {selected:this.settings.selected,proxy:p?{...p,secret:undefined,hasSecret:!!p.secret,keyPreview}:null};
  }
  async displaySettings(allowClient=false){
    const result=this.publicSettings(),p=this.settings.proxy;
    if(p&&p.credential!=='manual'&&(p.credential!=='provider'||allowClient)){
      try{const key=await this.key(p);if(key)result.proxy.keyPreview=key.length>7?key.slice(0,7)+'…':'•••••••';}catch{}
    }
    return result;
  }
  clear(){
    this.settings={...this.settings,proxy:null};
    this.store.set('quota',this.settings);
    this.cache=null;this.flight=null;return this.publicSettings();
  }
  select(selected){
    if(!['account','proxy'].includes(selected))throw new Error('额度来源无效');
    if(selected==='proxy'&&!this.settings.proxy)throw new Error('请先在基础设置保存密钥查询配置');
    const next={...this.settings,selected};this.store.set('quota',next);
    this.settings=next;return this.publicSettings();
  }
  readProfiles(){
    const items=this.store.get('quotaProfiles',[]);return Array.isArray(items)?items:[];
  }
  profiles(){return this.readProfiles().map(p=>({id:p.id,name:p.name,endpoint:p.proxy.endpoint,credential:p.proxy.credential,adapter:p.proxy.adapter,format:p.proxy.format,unit:p.proxy.unit,valuePath:p.proxy.valuePath,serviceName:p.proxy.name}));}
  writeProfiles(items){this.store.set('quotaProfiles',items);return this.profiles();}
  saveProfile(name){
    name=String(name||'').trim().slice(0,80);if(!name)throw new Error('请填写查询配置名称');
    if(!this.settings.proxy)throw new Error('请先保存当前查询配置');
    const items=this.readProfiles(),existing=items.find(p=>p.name===name);
    const proxy={...this.settings.proxy};
    if(existing)existing.proxy=proxy;
    else{if(items.length>=30)throw new Error('最多保存 30 份查询配置');items.push({id:require('node:crypto').randomUUID(),name,proxy});}
    return this.writeProfiles(items);
  }
  deleteProfile(id){return this.writeProfiles(this.readProfiles().filter(p=>p.id!==id));}
  loadProfile(id){
    const entry=this.readProfiles().find(p=>p.id===id);if(!entry)throw new Error('找不到保存的查询配置');
    const proxy={...entry.proxy};
    if(proxy.credential==='manual'&&!proxy.secret){this.settings={selected:'proxy',proxy:validate(proxy)};this.store.set('quota',this.settings);this.cache=null;this.flight=null;return this.publicSettings();}
    if(proxy.credential==='manual'){
      proxy.key=this.unprotect?.(proxy.secret);
      if(!proxy.key)throw new Error('保存的密钥无法解密，请重新填写');
    }
    return this.save({selected:'proxy',proxy});
  }
  save(raw){
    if(!['account','proxy'].includes(raw.selected))throw new Error('额度来源无效');
    let proxy=null;
    if(raw.proxy){
      proxy=validate(raw.proxy);
      if(proxy.credential==='manual'){
        if(raw.proxy.key){if(!this.protect)throw new Error('本机安全存储不可用');proxy.secret=this.protect(String(raw.proxy.key));}
        else if(this.settings.proxy?.credential==='manual'&&this.settings.proxy?.endpoint===proxy.endpoint)proxy.secret=this.settings.proxy.secret;
        if(!proxy.secret)throw new Error('首次设置或更换接口时请重新输入查询密钥');
      }
    }
    if(raw.selected==='proxy'&&!proxy)throw new Error('请先填写密钥查询接口');
    this.settings={selected:raw.selected,proxy};
    this.store.set('quota',this.settings);
    this.cache=null;this.flight=null;return this.publicSettings();
  }
  async context(){
    await this.client.start();
    const [account,config]=await Promise.all([this.client.request('account/read',{refreshToken:false}),this.client.request('config/read',{includeLayers:false})]);
    const conf=config.config||{};const provider=conf.model_provider||'openai';const p=conf.model_providers?.[provider]||{};
    return {accountType:account.account?.type||null,provider,baseUrl:p.base_url||null,envName:p.env_key||null,hasEnvironmentKey:!!(p.env_key&&process.env[p.env_key]),hasConfiguredKey:!!p.experimental_bearer_token};
  }
  async key(p){
    if(p.credential==='manual')return this.unprotect?.(p.secret);
    if(p.credential==='api')return this.getApiKey();
    if(p.credential==='env')return process.env[p.envName];
    if(p.credential==='auth'){
      const file=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'auth.json');
      try{return JSON.parse(fs.readFileSync(file,'utf8')).OPENAI_API_KEY;}catch{return null;}
    }
    await this.client.start();const {config}=await this.client.request('config/read',{includeLayers:false});
    const provider=config.model_providers?.[config.model_provider]||{};
    if(provider.env_key)return process.env[provider.env_key];
    return provider.experimental_bearer_token;
  }
  async queryProxy(){
    if(this.cache&&Date.now()-this.cacheAt<60000)return this.cache;
    if(this.flight)return this.flight;
    const flight=this.fetchProxy().finally(()=>{if(this.flight===flight)this.flight=null;});
    this.flight=flight;return flight;
  }
  async fetchProxy(){
    const p=this.settings.proxy;
    if(!p)return {ok:false,reason:'credential-missing',provider:'密钥额度',message:'请先配置密钥查询接口'};
    try{
      const key=await this.key(p);if(!key)throw new Error('找不到所选密钥；请检查环境变量、登录方式或改为手动输入');
      if(p.adapter==='crs'){
        const origin=new URL(p.endpoint).origin;
        const lookup=await this.readJson(origin+'/apiStats/api/get-key-id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key})});
        if(lookup.success!==true||typeof lookup.data?.id!=='string')throw new Error('CRS 无法识别此密钥');
        const result=await this.readJson(origin+'/apiStats/api/user-stats',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiId:lookup.data.id})});
        if(result.success!==true)throw new Error('CRS 统计查询失败');
        const value=normalizeStats(result.data,p.name);
        if(this.settings.proxy===p){this.cache=value;this.cacheAt=Date.now();}return value;
      }
      const data=await this.readJson(p.endpoint,{method:'GET',headers:{Accept:'application/json',[p.header]:(p.bearer?'Bearer ':'')+key}});
      const raw=number(pick(data,p.valuePath));if(raw===undefined)throw new Error('响应中找不到指定的数字字段，请核对接口说明');
      const value=raw*p.scale,total=number(pick(data,p.totalPath));
      const percent=p.format==='usedPercent'?value:total!==undefined&&total>0?(1-raw/total)*100:undefined;
      if(p.format==='usedPercent'&&(value<0||value>100))throw new Error('已用比例必须为 0–100，请调整换算系数');
      const result={ok:true,provider:p.name,kind:'proxy',value,unit:p.unit,format:p.format,...(percent!==undefined?{percent:Math.max(0,Math.min(100,percent))}:{}),queriedAt:Date.now()};
      if(this.settings.proxy===p){this.cache=result;this.cacheAt=Date.now();}return result;
    }catch(e){return {ok:false,provider:p.name,reason:'fetch-error',message:e.message,code:e.code,status:e.status};}
  }
  async readJson(url,options){
      let response;
      try{response=await this.fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});}catch(e){throw networkIssue(e);}
      if(!response.ok){await response.body?.cancel();const status=response.status;const e=issue(status===401?'authentication':status===403?'permission':status===429?'rate-limit':status>=500?'upstream':'quota-failed',status);e.message='查询接口返回 HTTP '+status+'。'+e.message;throw e;}
      if(Number(response.headers.get('content-length'))>262144)throw new Error('查询响应过大');
      const reader=response.body.getReader();let chunks=[],size=0;
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();throw new Error('查询响应过大');}chunks.push(Buffer.from(value));}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('此网址返回的不是 JSON 查询接口，可能是登录网页');}
      return data;
  }
}
module.exports={QuotaService,validate,pick,normalizeCodexUsage};
