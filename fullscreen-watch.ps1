param([int]$WatchProcessId=0)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class PetForeground {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int left,top,right,bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct Monitor { public int size; public Rect bounds,work; public int flags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint id);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int count);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr h,ref Monitor m);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h,int index);
  delegate bool EnumProc(IntPtr h,IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback,IntPtr data);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out Rect r,int size);
  public static string Owned(int processId,long foregroundId) {
    var result=new System.Collections.Generic.List<string>();
    bool passed=false;
    EnumWindows(delegate(IntPtr h,IntPtr data){
      if(h.ToInt64()==foregroundId)passed=true;
      uint pid;GetWindowThreadProcessId(h,out pid);
      if(pid==processId)result.Add("{\"id\":\""+h.ToInt64()+"\",\"visible\":"+(IsWindowVisible(h)?"true":"false")+",\"minimized\":"+(IsIconic(h)?"true":"false")+",\"topmost\":"+((GetWindowLong(h,-20)&8)!=0?"true":"false")+",\"aboveForeground\":"+(foregroundId==0?"null":passed?"false":"true")+"}");
      return true;
    },IntPtr.Zero);
    return "["+String.Join(",",result)+"]";
  }
  public static string Window(long handle) {
    var h=new IntPtr(handle);Rect r;
    if(IsIconic(h)||(DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(Rect)))!=0&&!GetWindowRect(h,out r)))return "null";
    return "{\"x\":"+r.left+",\"y\":"+r.top+",\"width\":"+(r.right-r.left)+",\"height\":"+(r.bottom-r.top)+"}";
  }
  public static string Read() {
    SetProcessDpiAwarenessContext(new IntPtr(-4));
    var h=GetForegroundWindow();if(h==IntPtr.Zero)return "{}";
    var cls=new StringBuilder(256);GetClassName(h,cls,256);
    if(cls.ToString()=="Progman"||cls.ToString()=="WorkerW"||IsIconic(h))return "{}";
    Rect r;if(DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(Rect)))!=0&&!GetWindowRect(h,out r))return "{}";
    var m=new Monitor();m.size=Marshal.SizeOf(typeof(Monitor));if(!GetMonitorInfo(MonitorFromWindow(h,2),ref m))return "{}";
    uint pid;GetWindowThreadProcessId(h,out pid);
    bool full=r.left<=m.bounds.left+2&&r.top<=m.bounds.top+2&&r.right>=m.bounds.right-2&&r.bottom>=m.bounds.bottom-2;
    return "{\"foregroundId\":\""+h.ToInt64()+"\",\"pid\":"+pid+",\"fullscreen\":"+(full?"true":"false")+",\"window\":{\"x\":"+r.left+",\"y\":"+r.top+",\"width\":"+(r.right-r.left)+",\"height\":"+(r.bottom-r.top)+"},\"monitor\":{\"x\":"+m.bounds.left+",\"y\":"+m.bounds.top+",\"width\":"+(m.bounds.right-m.bounds.left)+",\"height\":"+(m.bounds.bottom-m.bounds.top)+"}}";
  }
}
'@
$petKnownClients=New-Object 'System.Collections.Generic.HashSet[int]'
while($true){
  try{
    $petState=[PetForeground]::Read()|ConvertFrom-Json
    $petOwned=[PetForeground]::Owned($WatchProcessId,[long]$petState.foregroundId)|ConvertFrom-Json
    $petState|Add-Member -NotePropertyName ownedWindows -NotePropertyValue @($petOwned)
    if($petState.pid){
      $petProcess=Get-Process -Id $petState.pid -ErrorAction SilentlyContinue
      $petName=if($petProcess){$petProcess.ProcessName}else{''}
      $petState|Add-Member -NotePropertyName process -NotePropertyValue $petName
    }
    $petProcesses=@(Get-Process -Name Codex,ChatGPT -ErrorAction SilentlyContinue)
    $petClients=@($petProcesses | Where-Object {$_.MainWindowHandle -ne 0})
    foreach($petClient in $petClients){$null=$petKnownClients.Add($petClient.Id)}
    foreach($petId in @($petKnownClients)){if(-not($petProcesses | Where-Object {$_.Id -eq $petId})){$null=$petKnownClients.Remove($petId)}}
    $petWindows=@(foreach($p in $petClients){$r=[PetForeground]::Window($p.MainWindowHandle.ToInt64())|ConvertFrom-Json;if($r){$r|Add-Member -NotePropertyName id -NotePropertyValue ($p.Id.ToString()+'-'+$p.MainWindowHandle.ToString());$r}})
    $petState|Add-Member -NotePropertyName clientRunning -NotePropertyValue ($petKnownClients.Count -gt 0)
    $petState|Add-Member -NotePropertyName clientWindows -NotePropertyValue $petWindows
    [Console]::WriteLine(($petState|ConvertTo-Json -Compress -Depth 5))
  }catch{[Console]::WriteLine('{}')}
  Start-Sleep -Milliseconds 600
}
