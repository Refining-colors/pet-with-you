# WScript.Shell can lose Unicode paths on non-Chinese Windows installations.
# Use the wide-character Shell Link interface for both reading and saving.
if (-not ('PetUnicodeShortcut' -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
class PetShellLink {}
[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPetShellLinkW {
 void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, IntPtr data, uint flags);
 void GetIDList(out IntPtr pidl);
 void SetIDList(IntPtr pidl);
 void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
 void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
 void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count);
 void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string path);
 void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
 void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string text);
 void GetHotkey(out short key);
 void SetHotkey(short key);
 void GetShowCmd(out int command);
 void SetShowCmd(int command);
 void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, out int index);
 void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
 void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
 void Resolve(IntPtr window, uint flags);
 void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
}
public sealed class PetUnicodeShortcut {
 readonly string file;
 public string TargetPath { get; set; }
 public string Arguments { get; set; }
 public string WorkingDirectory { get; set; }
 public string IconLocation { get; set; }
 public string Description { get; set; }
 public int WindowStyle { get; set; }
 public PetUnicodeShortcut(string path) {
  file=Path.GetFullPath(path); WindowStyle=1;
  TargetPath=Arguments=WorkingDirectory=IconLocation=Description="";
  if (!File.Exists(file)) return;
  var link=(IPetShellLinkW)new PetShellLink();
  try {
   ((IPersistFile)link).Load(file,0);
   var text=new StringBuilder(32768); int index, show;
   link.GetPath(text,text.Capacity,IntPtr.Zero,0); TargetPath=text.ToString();
   text.Clear(); link.GetArguments(text,text.Capacity); Arguments=text.ToString();
   text.Clear(); link.GetWorkingDirectory(text,text.Capacity); WorkingDirectory=text.ToString();
   text.Clear(); link.GetDescription(text,text.Capacity); Description=text.ToString();
   text.Clear(); link.GetIconLocation(text,text.Capacity,out index); IconLocation=text.ToString()+","+index;
   link.GetShowCmd(out show); WindowStyle=show;
  } finally { Marshal.FinalReleaseComObject(link); }
 }
 public void Save() {
  var link=(IPetShellLinkW)new PetShellLink();
  try {
   link.SetPath(TargetPath); link.SetArguments(Arguments); link.SetWorkingDirectory(WorkingDirectory);
   link.SetDescription(Description); link.SetShowCmd(WindowStyle);
   int comma=IconLocation.LastIndexOf(','), index=0;
   string icon=IconLocation;
   if(comma>=0 && int.TryParse(IconLocation.Substring(comma+1),out index)) icon=IconLocation.Substring(0,comma);
   link.SetIconLocation(icon,index); ((IPersistFile)link).Save(file,true);
  } finally { Marshal.FinalReleaseComObject(link); }
 }
}
'@
}
function New-PetShortcut([string]$Path) { return New-Object PetUnicodeShortcut($Path) }
