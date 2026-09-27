Option Explicit
Dim sh, fso, root, mode, args, nodeExe, q
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = "node.exe"
q = Chr(34)
args = ""
If WScript.Arguments.Count > 0 Then
  mode = WScript.Arguments(0)
  If mode = "connect" Then args = " --connect-only"
  If mode = "both" Then args = " --connect"
End If
sh.CurrentDirectory = root
sh.Run q & nodeExe & q & " " & q & root & "\launch.cjs" & q & args, 0, False
