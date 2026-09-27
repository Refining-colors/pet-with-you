const fs=require('node:fs');
const path=require('node:path');
const {execFileSync,spawn}=require('node:child_process');
const psString=s=>"'"+String(s).replaceAll("'","''")+"'";
function syncStartup({dataDir,preferences,executable,root,packaged=false,shortcutDir}){
  if(process.platform!=='win32'){
    if(preferences.autostart||preferences.followClientStart)throw new Error('启动联动目前仅支持 Windows');
    return;
  }
  const watch=preferences.mode==='connected'&&preferences.followClientStart;
  const enabled=preferences.autostart||watch;
  // Paths are generated on the current user's machine, never distributed in source.
  fs.writeFileSync(path.join(dataDir,'startup-target.json'),JSON.stringify({executable,root,packaged}));
  const script=path.join(root,'startup-watch.ps1');
  const args=`-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${script}" -DataDir "${dataDir}"`;
  const folder=shortcutDir?psString(shortcutDir):"([Environment]::GetFolderPath('Startup'))";
  const command=`$p=Join-Path ${folder} 'DSH Pet Companion.lnk'; if(${enabled?'$true':'$false'}){$s=(New-Object -ComObject WScript.Shell).CreateShortcut($p);$s.TargetPath=Join-Path $PSHOME 'powershell.exe';$s.Arguments=${psString(args)};$s.WorkingDirectory=${psString(root)};$s.WindowStyle=7;$s.Save()}elseif(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p}`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:'pipe'});
  if(watch){const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-DataDir',dataDir,'-WatchOnly'],{detached:true,windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}
}
module.exports={syncStartup,psString};
