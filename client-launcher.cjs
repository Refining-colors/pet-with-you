const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {launchDetached}=require('./detached-launch.cjs');
const {atomic}=require('./settings-store.cjs');
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
  if(value?.kind==='file'&&typeof value.file==='string'&&path.isAbsolute(value.file)&&/\.(exe|lnk)$/i.test(value.file)&&fs.existsSync(value.file)&&!/pet-with-you|pet-with-u|Codex withu|GPT 联动启动/i.test(path.basename(value.file)))return {kind:'file',file:value.file,name:String(value.name||'GPT').slice(0,80)};
  throw new Error('请选择 GPT 客户端的原始启动程序或快捷方式，不能选择桌宠或联动入口自身。');
}
function clientLauncherStatus(dataDir){
  try{const target=validateTarget(JSON.parse(fs.readFileSync(configFile(dataDir),'utf8')));return {configured:true,name:target.name};}
  catch{return {configured:false};}
}
function createClientLauncher({dataDir,root=__dirname,executable=process.execPath,packaged=false,target,directory,nodeExecutable}){
  target=validateTarget(target);
  if(!path.isAbsolute(directory)||!fs.statSync(directory).isDirectory())throw new Error('请选择已存在的启动器保存目录。');
  const launcher=packaged?executable:path.join(process.env.WINDIR,'System32','wscript.exe');
  const icon=path.join(root,'build','codex-withu.ico');
  if(!fs.existsSync(launcher)||!fs.existsSync(icon))throw new Error('启动程序或联动图标缺失，请先修复安装。');
  if(!packaged){
    nodeExecutable ||= require('./node-runtime.cjs').locateNode();
    if(!fs.existsSync(nodeExecutable)||!fs.existsSync(path.join(root,'launcher.vbs')))throw new Error('源码启动文件缺失，请先修复安装。');
  }
  const args=packaged?'--launch-client':'"'+path.join(root,'launcher.vbs')+'" client "'+nodeExecutable+'"';
  let file=path.join(directory,'Codex withu.lnk');
  for(let index=2;fs.existsSync(file);index++)file=path.join(directory,`Codex withu (${index}).lnk`);
  const script=`$ErrorActionPreference='Stop';if(Test-Path -LiteralPath ${ps(file)}){throw 'Shortcut already exists.'};$shell=New-Object -ComObject WScript.Shell;$link=$shell.CreateShortcut(${ps(file)});$link.TargetPath=${ps(launcher)};$link.Arguments=${ps(args)};$link.WorkingDirectory=${ps(root)};$link.IconLocation=${ps(icon+',0')};$link.Description='Codex withu - Codex + pet-with-you';$link.WindowStyle=7;$link.Save()`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,stdio:'pipe'});
  let previous;try{previous=JSON.parse(fs.readFileSync(configFile(dataDir),'utf8'));}catch{}
  const shortcuts=[...new Set([...(Array.isArray(previous?.shortcuts)?previous.shortcuts.filter(p=>typeof p==='string'&&path.isAbsolute(p)):[]),file])];
  try{atomic(configFile(dataDir),{...target,shortcuts});}
  catch(error){fs.unlinkSync(file);throw error;}
  return {ok:true,file,name:target.name};
}
async function createClientLauncherWithDialogs({dialog,parent,desktop,discover=discoverClients,create=createClientLauncher,...options}){
  const targets=discover(),labels=targets.map(target=>target.name+'（系统应用）');
  const choice=await dialog.showMessageBox(parent,{title:'创建 Codex withu 联动启动器',message:'选择要一起启动的 Codex / GPT 桌面客户端',detail:'下一步选择启动器保存目录。双击 Codex withu 会同时打开客户端与桌宠，保留桌宠当前模式。',buttons:[...labels,'选择其他程序或原始快捷方式','取消'],cancelId:labels.length+1});
  if(choice.response===labels.length+1)return {canceled:true};
  let target=targets[choice.response];
  if(!target){
    const selected=await dialog.showOpenDialog(parent,{title:'选择客户端原始启动程序或快捷方式（不是命令行 CLI）',properties:['openFile'],filters:[{name:'应用或快捷方式',extensions:['exe','lnk']}]});
    if(selected.canceled||!selected.filePaths.length)return {canceled:true};
    target={kind:'file',file:selected.filePaths[0],name:path.parse(selected.filePaths[0]).name};
  }
  target=validateTarget(target);
  const selected=await dialog.showOpenDialog(parent,{title:'选择 Codex withu 保存目录',defaultPath:desktop,properties:['openDirectory','createDirectory']});
  if(selected.canceled||!selected.filePaths.length)return {canceled:true};
  return create({...options,target,directory:selected.filePaths[0]});
}
async function launchLinkedClient({dataDir,root=__dirname,executable=process.execPath,packaged=false,open=launchDetached,nodeExecutable}){
  let target;try{target=validateTarget(JSON.parse(fs.readFileSync(configFile(dataDir),'utf8')));}catch(error){throw new Error('请先在 GPT 连接设置中创建 Codex withu 联动启动器。\n配置文件：'+configFile(dataDir)+'\n原因：'+(error.code==='ENOENT'?'文件不存在':error.code==='EACCES'?'没有读取权限':'配置无效'));}
  if(target.kind==='appId')await open(path.join(process.env.WINDIR,'explorer.exe'),['shell:AppsFolder\\'+target.appId],root);
  else if(/\.lnk$/i.test(target.file))await open(path.join(process.env.WINDIR,'explorer.exe'),[target.file],path.dirname(target.file));
  else await open(target.file,[],path.dirname(target.file));
  await open(executable,[...(packaged?[]:[root]),'--background',...(!packaged&&nodeExecutable?['--pet-node-exe='+nodeExecutable]:[])],root);
  return {startedPet:true};
}
module.exports={discoverClients,createClientLauncher,createClientLauncherWithDialogs,launchLinkedClient,validateTarget,clientLauncherStatus};
