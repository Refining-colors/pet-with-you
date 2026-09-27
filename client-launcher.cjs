const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {launchDetached}=require('./detached-launch.cjs');
const {atomic,SettingsStore}=require('./settings-store.cjs');
const ps=value=>"'"+String(value).replaceAll("'","''")+"'";
const configFile=dir=>path.join(dir,'client-launcher.local.json');
function discoverClients(){
  try{
    const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding=[Text.Encoding]::UTF8; ConvertTo-Json -Compress -InputObject @(Get-StartApps | Where-Object {$_.Name -match '^(Codex|ChatGPT)$'} | Select-Object Name,AppID)"],{encoding:'utf8',windowsHide:true,timeout:15000}).replace(/^\uFEFF/,'');
    return JSON.parse(result).filter(item=>typeof item.AppID==='string'&&/^[\w.!-]+$/.test(item.AppID)&&item.AppID.includes('!')).map(item=>({kind:'appId',appId:item.AppID,name:item.Name}));
  }catch{return [];}
}
function validateTarget(value){
  if(value?.kind==='appId'&&typeof value.appId==='string'&&/^[\w.!-]+![\w.!-]+$/.test(value.appId))return {kind:'appId',appId:value.appId,name:String(value.name||'GPT').slice(0,80)};
  if(value?.kind==='file'&&typeof value.file==='string'&&path.isAbsolute(value.file)&&/\.(exe|lnk)$/i.test(value.file)&&fs.existsSync(value.file)&&!/pet-with-you|GPT 联动启动/i.test(path.basename(value.file)))return {kind:'file',file:value.file,name:String(value.name||'GPT').slice(0,80)};
  throw new Error('请选择 GPT 客户端的原始启动程序或快捷方式，不能选择桌宠或联动入口自身。');
}
function createClientLaunchers({dataDir,root=__dirname,executable=process.execPath,packaged=false,target,desktop,programs}){
  target=validateTarget(target);
  const launcher=packaged?executable:path.join(process.env.WINDIR,'System32','wscript.exe');
  const args=packaged?'--launch-client':'"'+path.join(root,'launcher.vbs')+'" client "'+require('./node-runtime.cjs').locateNode()+'"';
  const destinations=[desktop?ps(desktop):"([Environment]::GetFolderPath('Desktop'))",programs?ps(programs):"([Environment]::GetFolderPath('Programs'))"];
  const script=`$ErrorActionPreference='Stop';$shell=New-Object -ComObject WScript.Shell;foreach($folder in @(${destinations.join(',')})){$file=Join-Path $folder 'GPT 联动启动.lnk';$link=$shell.CreateShortcut($file);if((Test-Path -LiteralPath $file)-and $link.Description -ne 'GPT + pet-with-you' -and($link.TargetPath -ne ${ps(launcher)} -or $link.Arguments -ne ${ps(args)})){throw 'A different shortcut already uses this name.'};$link.TargetPath=${ps(launcher)};$link.Arguments=${ps(args)};$link.WorkingDirectory=${ps(root)};$link.IconLocation=${ps(path.join(root,'build','icon.ico')+',0')};$link.Description='GPT + pet-with-you';$link.WindowStyle=7;$link.Save()}`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,stdio:'pipe'});
  atomic(configFile(dataDir),target);
  return {ok:true};
}
async function launchLinkedClient({dataDir,root=__dirname,executable=process.execPath,packaged=false,open=launchDetached,preferences,nodeExecutable}){
  let target;try{target=validateTarget(JSON.parse(fs.readFileSync(configFile(dataDir),'utf8')));}catch{throw new Error('请先在 GPT 连接设置中配置联动启动入口。');}
  const pref=preferences||new SettingsStore(dataDir).get('preferences',{});
  if(target.kind==='appId')await open(path.join(process.env.WINDIR,'explorer.exe'),['shell:AppsFolder\\'+target.appId],root);
  else if(/\.lnk$/i.test(target.file))await open(path.join(process.env.WINDIR,'explorer.exe'),[target.file],path.dirname(target.file));
  else await open(target.file,[],path.dirname(target.file));
  const startPet=pref.mode==='connected'&&pref.followClientStart===true;
  if(startPet)await open(executable,[...(packaged?[]:[root]),'--background',...(!packaged&&nodeExecutable?['--pet-node-exe='+nodeExecutable]:[])],root);
  return {startedPet:startPet};
}
module.exports={discoverClients,createClientLaunchers,launchLinkedClient,validateTarget};
