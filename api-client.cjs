const normalizeBase=(value)=>{
  const u=new URL(String(value||''));
  if(u.username||u.password||u.search||u.hash)throw new Error('API 地址不能包含密钥、参数或片段');
  if(!['https:','http:'].includes(u.protocol))throw new Error('API 地址必须使用 HTTP 或 HTTPS');
  if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new Error('远程 API 地址必须使用 HTTPS');
  return u.href.replace(/\/+$/,'');
};
class ApiSettings{
  constructor(dir,{protect,unprotect}={}){this.file=require('node:path').join(dir,'api-settings.json');this.protect=protect;this.unprotect=unprotect;try{const r=JSON.parse(require('node:fs').readFileSync(this.file,'utf8'));this.value={baseUrl:r.baseUrl?normalizeBase(r.baseUrl):'',model:String(r.model||'').slice(0,120),secret:r.secret||'',profileName:String(r.profileName||'').slice(0,80)};}catch{this.value={baseUrl:'https://api.openai.com/v1',model:'gpt-4o-mini',secret:'',profileName:''};}}
  publicValue(){return {profileName:this.value.profileName||'',baseUrl:this.value.baseUrl,model:this.value.model,configured:!!this.value.secret};}
  clear(){
    const next={baseUrl:'',model:'',secret:'',profileName:''};
    require('node:fs').writeFileSync(this.file+'.tmp',JSON.stringify(next));
    require('node:fs').renameSync(this.file+'.tmp',this.file);this.value=next;return this.publicValue();
  }
  readProfiles(){
    try{const value=JSON.parse(require('node:fs').readFileSync(this.file+'.profiles','utf8'));return Array.isArray(value)?value:[];}catch{return [];}
  }
  writeProfiles(items){const fs=require('node:fs');fs.writeFileSync(this.file+'.profiles.tmp',JSON.stringify(items));fs.renameSync(this.file+'.profiles.tmp',this.file+'.profiles');return this.profiles();}
  profiles(){return this.readProfiles().map(p=>({id:p.id,name:p.name,baseUrl:p.baseUrl,model:p.model}));}
  saveProfile(name){
    name=String(name||'').trim().slice(0,80);if(!name)throw new Error('请填写配置名称');
    if(!this.value.secret)throw new Error('请先保存当前 API 地址、模型和密钥');
    const items=this.readProfiles(),existing=items.find(p=>p.name===name);
    if(existing)Object.assign(existing,this.value);else{if(items.length>=30)throw new Error('最多保存 30 份配置');items.push({id:require('node:crypto').randomUUID(),name,...this.value});}
    return this.writeProfiles(items);
  }
  deleteProfile(id){return this.writeProfiles(this.readProfiles().filter(p=>p.id!==id));}
  loadProfile(id){
    const p=this.readProfiles().find(p=>p.id===id);if(!p)throw new Error('找不到保存的配置');
    return this.save({baseUrl:p.baseUrl,model:p.model,apiKey:this.unprotect(p.secret),profileName:p.name});
  }
  save(raw){const baseUrl=normalizeBase(raw.baseUrl);const model=String(raw.model||'').trim().slice(0,120);if(!model)throw new Error('请填写模型名称');let secret=baseUrl===this.value.baseUrl?this.value.secret:'';if(raw.apiKey){if(!this.protect)throw new Error('系统安全存储不可用');secret=this.protect(String(raw.apiKey));}if(raw.clearKey)secret='';if(!secret&&!raw.clearKey)throw new Error('首次配置或更改 API 地址后请重新填写密钥');const next={baseUrl,model,secret,profileName:String(raw.profileName??this.value.profileName??'').slice(0,80)};const fs=require('node:fs');fs.writeFileSync(this.file+'.tmp',JSON.stringify(next,null,2));fs.renameSync(this.file+'.tmp',this.file);this.value=next;return this.publicValue();}
  key(){return this.value.secret?this.unprotect?.(this.value.secret):null;}
}
class ApiClient{
  constructor(settings,{fetcher=fetch}={}){this.settings=settings;this.fetcher=fetcher;this.controllers=new Set();}
  close(){for(const c of this.controllers)c.abort();this.controllers.clear();}
  async chat(prompt,{onText}={}){
    const {issue,networkIssue}=require('./diagnostics.cjs');
    const key=this.settings.key();if(!key)throw issue('key-missing');
    const controller=new AbortController();this.controllers.add(controller);
    try{
      const base=this.settings.value.baseUrl;
      const endpoint=/\/chat\/completions$/i.test(base)?base:base+'/chat/completions';
      let response;
      try{response=await this.fetcher(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model:this.settings.value.model,messages:[{role:'user',content:prompt}],...(onText?{stream:true}:{})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55000)])});}catch(e){throw networkIssue(e);}
      if(response.ok&&onText&&response.headers?.get('content-type')?.includes('text/event-stream')){
        try{return await require('./chat-stream.cjs').readChatStream(response,onText);}catch(e){if(['invalid-json','upstream','response-large','empty-reply'].includes(e.code))throw e;throw networkIssue(e);}
      }
      let data,readError;
      try{
        const reader=response.body.getReader();const chunks=[];let size=0;
        while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw issue('response-large');}chunks.push(Buffer.from(value));}
        try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw issue('invalid-json');}
      }catch(e){readError=e.code==='response-large'||e.code==='invalid-json'?e:networkIssue(e);}
      if(!response.ok){
        // Inspect provider text only for classification; never return or persist it.
        const error=data?.error;
        const hint=String(error?.code||'')+' '+String(error?.type||'')+' '+String(error?.message||'');
        const missingModel=/model[_ -]?(not[_ -]?found|unavailable)|(?:model|模型).{0,100}(?:does not exist|not found|not exist|不存在|无权限|不可用)/i.test(hint);
        const status=response.status;
        throw issue(status===401?'authentication':status===403?'permission':status===429?'rate-limit':status>=500?'upstream':missingModel?'model-not-found':status===404?'endpoint':'bad-request',status);
      }
      if(readError)throw readError;
      const text=data?.choices?.[0]?.message?.content;
      if(typeof text!=='string'||!text.trim())throw issue('empty-reply');
      return text.trim();
    }finally{this.controllers.delete(controller);}
  }
}
module.exports={ApiSettings,ApiClient,normalizeBase};
