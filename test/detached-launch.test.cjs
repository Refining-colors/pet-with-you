const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
test('shell-launched process survives destruction of its initiating Windows job',{skip:process.platform!=='win32',timeout:25000},t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"pet detached ' job-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
  const signal=path.join(dir,'ready'),survived=path.join(dir,'survived'),worker=path.join(dir,'worker.ps1'),parent=path.join(dir,'parent.cjs');
  const literal=value=>"'"+value.replaceAll("'","''")+"'";
  fs.writeFileSync(worker,'Start-Sleep -Seconds 3\n[IO.File]::WriteAllText('+literal(survived)+",'alive')\n");
  const launcher=path.resolve(__dirname,'../detached-launch.cjs');
  fs.writeFileSync(parent,`setInterval(()=>{},1000);setTimeout(async()=>{await require(${JSON.stringify(launcher)}).launchDetached(${JSON.stringify(path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/powershell.exe'))},['-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',${JSON.stringify(worker)}],${JSON.stringify(dir)});require('fs').writeFileSync(${JSON.stringify(signal)},'ready');},1000);`);
  const driver=path.join(dir,'driver.ps1');
  fs.writeFileSync(driver,`$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class PetJobTest {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr a,string n);
 [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr j,int k,IntPtr b,uint s);
 [DllImport("kernel32.dll")] public static extern bool AssignProcessToJobObject(IntPtr j,IntPtr p);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
 public static IntPtr Create(){var j=CreateJobObject(IntPtr.Zero,null);int n=IntPtr.Size==8?144:112;var b=Marshal.AllocHGlobal(n);for(int i=0;i<n;i++)Marshal.WriteByte(b,i,0);Marshal.WriteInt32(b,16,0x2000);bool ok=SetInformationJobObject(j,9,b,(uint)n);Marshal.FreeHGlobal(b);if(!ok)throw new Exception("Job limits failed");return j;}
}
'@
$job=[PetJobTest]::Create()
$parent=$null
try {
 $parent=Start-Process -FilePath ${literal(process.execPath)} -ArgumentList ${literal('"'+parent+'"')} -WindowStyle Hidden -PassThru
 if(-not[PetJobTest]::AssignProcessToJobObject($job,$parent.Handle)){throw 'Job assignment failed'}
 for($i=0;$i -lt 70 -and -not(Test-Path -LiteralPath ${literal(signal)});$i++){Start-Sleep -Milliseconds 100}
 if(-not(Test-Path -LiteralPath ${literal(signal)})){throw 'Detached launch did not finish'}
 $null=[PetJobTest]::CloseHandle($job);$job=[IntPtr]::Zero
 $parent.WaitForExit(3000)|Out-Null
 for($i=0;$i -lt 70 -and -not(Test-Path -LiteralPath ${literal(survived)});$i++){Start-Sleep -Milliseconds 100}
 if(-not(Test-Path -LiteralPath ${literal(survived)})){throw 'Launched process died with the initiating job'}
 Write-Output 'survived'
} finally {if($job -ne [IntPtr]::Zero){$null=[PetJobTest]::CloseHandle($job)};if($parent -and -not $parent.HasExited){Stop-Process -Id $parent.Id -ErrorAction SilentlyContinue}}
`);
  const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',driver],{encoding:'utf8',windowsHide:true,timeout:22000});
  assert.match(output,/survived/);assert.equal(fs.readFileSync(survived,'utf8'),'alive');
});
