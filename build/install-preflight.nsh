!include LogicLib.nsh

Var PetInstallError
Var PetInstallErrorPath
Var PetCheckPath
Var PetInstallLog

Function PetCheckFolder
  Push $0
  Push $1
  Push $2
  Push $3
  ${If} $PetInstallError == 0
    CreateDirectory "$PetCheckPath"
    System::Call 'kernel32::GetTempFileNameW(w "$PetCheckPath", w "pwu", i 0, w .r1) i.r0 ?e'
    Pop $3
    ${If} $0 == 0
      StrCpy $PetInstallError $3
      StrCpy $PetInstallErrorPath $PetCheckPath
    ${Else}
      ; Check actual write access; never truncate or modify an existing application file.
      System::Call 'kernel32::CreateFileW(w r1, i 0x40000000, i 7, p 0, i 3, i 0, p 0) p.r2 ?e'
      Pop $3
      ${If} $2 == -1
        StrCpy $PetInstallError $3
        StrCpy $PetInstallErrorPath $PetCheckPath
      ${Else}
        System::Call 'kernel32::CloseHandle(p r2)'
      ${EndIf}
      System::Call 'kernel32::DeleteFileW(w r1)'
    ${EndIf}
  ${EndIf}
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function PetCheckExistingFile
  Push $0
  Push $1
  ${If} $PetInstallError == 0
    System::Call 'kernel32::GetFileAttributesW(w "$PetCheckPath") i.r0 ?e'
    Pop $1
    ${If} $0 == -1
      ${If} $1 != 2
      ${AndIf} $1 != 3
        StrCpy $PetInstallError $1
        StrCpy $PetInstallErrorPath $PetCheckPath
      ${EndIf}
    ${Else}
      System::Call 'kernel32::CreateFileW(w "$PetCheckPath", i 0x40000000, i 7, p 0, i 3, i 0, p 0) p.r0 ?e'
      Pop $1
      ${If} $0 == -1
        StrCpy $PetInstallError $1
        StrCpy $PetInstallErrorPath $PetCheckPath
      ${Else}
        System::Call 'kernel32::CloseHandle(p r0)'
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $1
  Pop $0
FunctionEnd

Function PetCheckInstallDirectory
  Push $0
  Push $1
  StrCpy $PetInstallError 0
  StrCpy $PetInstallErrorPath ""
  StrCpy $PetCheckPath "$INSTDIR"
  Call PetCheckFolder
  StrCpy $PetCheckPath "$INSTDIR\resources"
  Call PetCheckFolder
  StrCpy $PetCheckPath "$INSTDIR\resources\app"
  Call PetCheckFolder
  StrCpy $PetCheckPath "$INSTDIR\resources\app\assets"
  Call PetCheckFolder
  StrCpy $PetCheckPath "$INSTDIR\resources\app\assets\webm"
  Call PetCheckFolder
  StrCpy $PetCheckPath "$INSTDIR\uninstallerIcon.ico"
  Call PetCheckExistingFile
  StrCpy $PetCheckPath "$INSTDIR\pet-with-you.exe"
  Call PetCheckExistingFile
  ${If} $PetInstallError == 0
    FindFirst $0 $1 "$INSTDIR\resources\app\assets\webm\*.webm"
    ${DoWhile} $1 != ""
      StrCpy $PetCheckPath "$INSTDIR\resources\app\assets\webm\$1"
      Call PetCheckExistingFile
      ${If} $PetInstallError != 0
        ${ExitDo}
      ${EndIf}
      FindNext $0 $1
    ${Loop}
    FindClose $0
  ${EndIf}
  ClearErrors
  Pop $1
  Pop $0
FunctionEnd

Function PetReportInstallError
  Push $0
  Push $1
  StrCpy $1 "路径不可用、权限不足或文件被拦截。"
  ${If} $PetInstallError == 5
    StrCpy $1 "访问被拒绝：请检查目录权限、只读文件或安全软件拦截记录。"
  ${ElseIf} $PetInstallError == 32
  ${OrIf} $PetInstallError == 33
    StrCpy $1 "文件被占用：请退出桌宠及正在打开这些文件的程序后重试。"
  ${ElseIf} $PetInstallError == 112
    StrCpy $1 "磁盘空间不足：请释放空间或选择其他磁盘。"
  ${ElseIf} $PetInstallError == 19
    StrCpy $1 "磁盘处于写保护状态。"
  ${EndIf}
  StrCpy $PetInstallLog "$TEMP\pet-with-you-install-check.txt"
  ClearErrors
  FileOpen $0 "$PetInstallLog" w
  ${IfNot} ${Errors}
    FileWriteUTF16LE $0 "pet-with-you installation preflight$\r$\nWindows error: $PetInstallError$\r$\nTarget: $INSTDIR$\r$\nFailed path: $PetInstallErrorPath$\r$\n"
    FileClose $0
  ${Else}
    StrCpy $PetInstallLog "临时目录不可写，未能保存日志。"
  ${EndIf}
  MessageBox MB_OK|MB_ICONSTOP "安装目录暂时无法写入（Windows 错误 $PetInstallError）$\r$\n$PetInstallErrorPath$\r$\n$\r$\n$1$\r$\n$\r$\n请返回选择有写入权限的独立目录，例如：$\r$\n$LOCALAPPDATA\Programs\pet-with-you$\r$\n自定义目录仍受支持。不要忽略文件错误继续安装。$\r$\n$\r$\n检测记录：$PetInstallLog" /SD IDOK
  Pop $1
  Pop $0
FunctionEnd
