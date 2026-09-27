const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const operations=['chat-api','chat-gpt','whisper-api','whisper-gpt','quota-proxy','quota-account','quota-context','connection-inspect','connection-monitor','settings','logs','runtime'];
const stages=['initialize','account/read','config/read','hooks/list','account/rateLimits/read','thread/start','turn/start'];
const messages={
  'model-not-found':'找不到模型或当前密钥无权使用。请核对服务商提供的完整模型名称及模型权限。',
  'authentication':'密钥无效或已失效，请重新填写密钥（HTTP 401）。',
  'permission':'接口拒绝访问，请检查密钥权限和服务商限制（HTTP 403）。',
  'endpoint':'接口地址不存在。请核对 API 地址、v1 路径及 chat/completions 接口（HTTP 404）。',
  'rate-limit':'请求过于频繁或额度不足，请检查额度后稍后重试（HTTP 429）。',
  'upstream':'服务商暂时出错，请稍后重试。',
  'bad-request':'服务商拒绝了请求，请检查模型名称和接口兼容性。',
  'network':'无法连接服务地址，请检查网址、网络、代理及证书。',
  'dns':'无法解析服务域名，请核对网址和 DNS 设置。',
  'refused':'服务拒绝连接，请检查地址、端口及服务是否运行。',
  'timeout':'请求超时，请检查网络或稍后重试。',
  'canceled':'请求已取消，请重新发送。',
  'invalid-json':'接口未返回有效 JSON，请确认填写的是 API 接口而不是网页。',
  'response-large':'接口响应过大，已停止读取。',
  'empty-reply':'接口响应没有可显示的回复，请检查模型和接口兼容性。',
  'key-missing':'未找到可用密钥，请检查密钥来源或重新填写。',
  'chat-busy':'正在回复，请稍等。',
  'input-invalid':'请输入 1–2000 字。',
  'pet-missing':'找不到宠物，请重新打开桌宠。',
  'mode-changed':'运行模式已切换，请重新发送。',
  'quota-failed':'额度查询失败，请检查查询接口、密钥来源和返回字段。',
  'gpt-failed':'GPT 服务请求失败，请检查登录状态和客户端连接。',
  'settings-failed':'设置操作失败，请检查输入内容及配置目录的写入权限。',
  'logs-failed':'日志操作失败，请检查日志目录或导出位置的读写权限。',
  'workspace-routing':'Codex 工作区路由发现超时，暂时无法读取账户信息或发起 GPT 聊天。本地任务状态读取不受影响。',
  'gpt-timeout':'Codex 运行服务响应超时，请检查客户端登录与运行状态；桌宠任务状态读取仍可独立工作。',
  'account-context-failed':'读取 GPT 登录方式或服务商配置失败，不代表设置保存失败。请稍后重试。',
  'connection-failed':'Hooks 配置检查失败，本地会话状态读取仍可独立工作。',
  'monitor-failed':'读取本机任务状态失败，请检查 Codex 会话目录权限。',
  'operation-failed':'操作失败，请重试；持续出错时请导出日志反馈。'
};
function issue(code,status){const e=new Error(messages[code]||messages['operation-failed']);e.code=Object.hasOwn(messages,code)?code:'operation-failed';if(Number.isInteger(status))e.status=status;return e;}
function networkIssue(error){
  const code=error?.cause?.code||error?.code;
  if(error?.name==='TimeoutError'||['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'].includes(code))return issue('timeout');
  if(error?.name==='AbortError')return issue('canceled');
  return issue(['ENOTFOUND','EAI_AGAIN'].includes(code)?'dns':code==='ECONNREFUSED'?'refused':'network');
}
// Persist only a fixed vocabulary; upstream errors may contain prompts, keys or URLs.
function accountTimeout(entry){return ['quota-context','quota-account'].includes(entry.operation)&&['workspace-routing','gpt-timeout','timeout'].includes(entry.code);}
class Diagnostics{
  constructor(dataDir,{maxBytes=262144,ignoreAccountTimeouts=()=>false}={}){this.dir=path.join(dataDir,'logs');this.maxBytes=maxBytes;this.ignoreAccountTimeouts=ignoreAccountTimeouts;this.recentKeys=new Map();this.writeFailed=false;}
  file(index=0){return path.join(this.dir,index?'errors.'+index+'.jsonl':'errors.jsonl');}
  record(operation,error,fallback='operation-failed'){
    const code=Object.hasOwn(messages,error?.code)?error.code:fallback;
    const op=operations.includes(operation)?operation:'runtime';
    const status=Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:undefined;
    const stage=stages.includes(error?.stage)?error.stage:undefined;
    if(this.ignoreAccountTimeouts()&&accountTimeout({operation:op,code}))return {ignored:true,persisted:false,message:messages[code],code};
    const fingerprint=JSON.stringify([op,code,status,stage]),previous=this.recentKeys.get(fingerprint);
    if(previous&&Date.now()-previous.at<60000)return previous.value;
    const entry={id:crypto.randomUUID().slice(0,8),at:new Date().toISOString(),operation:op,code,message:messages[code]||messages['operation-failed'],...(status?{status}:{}),...(stage?{stage}:{})};
    let persisted=true;
    try{
      fs.mkdirSync(this.dir,{recursive:true});
      const line=JSON.stringify(entry)+'\n';
      if(fs.existsSync(this.file())&&fs.statSync(this.file()).size+Buffer.byteLength(line)>this.maxBytes){
        fs.rmSync(this.file(2),{force:true});
        if(fs.existsSync(this.file(1)))fs.renameSync(this.file(1),this.file(2));
        fs.renameSync(this.file(),this.file(1));
      }
      fs.appendFileSync(this.file(),line);this.writeFailed=false;
    }catch{persisted=false;this.writeFailed=true;}
    const value={...entry,persisted};
    if(persisted){this.recentKeys.set(fingerprint,{at:Date.now(),value});if(this.recentKeys.size>100)this.recentKeys.delete(this.recentKeys.keys().next().value);}
    return value;
  }
  entries(){
    const items=[];
    for(const index of [2,1,0]){try{for(const line of fs.readFileSync(this.file(index),'utf8').split('\n')){try{const e=JSON.parse(line);if(Object.hasOwn(messages,e.code)&&/^[0-9a-f]{8}$/.test(e.id)&&!isNaN(Date.parse(e.at)))items.push({id:e.id,at:new Date(e.at).toISOString(),operation:operations.includes(e.operation)?e.operation:'runtime',code:e.code,message:messages[e.code],...(stages.includes(e.stage)?{stage:e.stage}:{}),...(Number.isInteger(e.status)&&e.status>=100&&e.status<=599?{status:e.status}:{})});}catch{}}}catch(e){if(e.code!=='ENOENT')throw new Error('日志读取失败，请检查目录权限');}}
    return items;
  }
  visibleEntries(){return this.entries().filter(e=>!this.ignoreAccountTimeouts()||!accountTimeout(e));}
  summary(){const all=this.entries(),items=all.filter(e=>!this.ignoreAccountTimeouts()||!accountTimeout(e));return {directory:this.dir,count:items.length,ignoredCount:all.length-items.length,ignoreAccountTimeouts:this.ignoreAccountTimeouts(),entries:items.slice(-20).reverse(),writeFailed:this.writeFailed};}
  exportText(){return JSON.stringify({application:require('./project.cjs').PRODUCT_NAME,version:require('./package.json').version,exportedAt:new Date().toISOString(),platform:process.platform,versions:{node:process.versions.node,electron:process.versions.electron},privacy:'No credentials, URLs, prompts, replies or raw upstream responses.',errors:this.visibleEntries()},null,2);}
  clear(){for(const i of [0,1,2])fs.rmSync(this.file(i),{force:true});this.recentKeys.clear();this.writeFailed=false;return this.summary();}
}
module.exports={Diagnostics,issue,networkIssue,messages};
