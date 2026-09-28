const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const psString=s=>"'"+String(s).replaceAll("'","''")+"'";
function syncStartup({dataDir,preferences,executable,root,packaged=false,shortcutDir}){
  if(process.platform!=='win32'){
    if(preferences.autostart)throw new Error('开机启动目前仅支持 Windows');
    return;
  }
  const enabled=preferences.autostart;
  // Paths are generated on the current user's machine, never distributed in source.
  fs.writeFileSync(path.join(dataDir,'startup-target.json'),JSON.stringify({executable,root,packaged,...(!packaged&&process.env.PET_NODE_EXE?{nodeExecutable:process.env.PET_NODE_EXE}:{})}));
  const script=path.join(root,'startup-watch.ps1');
  const args=`-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${script}" -DataDir "${dataDir}"`;
  const folder=shortcutDir?psString(shortcutDir):"([Environment]::GetFolderPath('Startup'))";
  const command=`Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {$_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains('startup-watch.ps1') -and $_.CommandLine.Contains(${psString('"'+dataDir+'"')})} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue};$p=Join-Path ${folder} 'DSH Pet Companion.lnk'; if(${enabled?'$true':'$false'}){$s=(New-Object -ComObject WScript.Shell).CreateShortcut($p);$s.TargetPath=Join-Path $PSHOME 'powershell.exe';$s.Arguments=${psString(args)};$s.WorkingDirectory=${psString(root)};$s.WindowStyle=7;$s.Save()}elseif(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p}`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:'pipe'});
}
module.exports={syncStartup,psString};
