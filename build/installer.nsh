!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!include MUI2.nsh

ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
!define /ifndef MUI_TEXTCOLOR "203D54"

!macro customHeader
  ; Language tables otherwise replace the font with small bitmap SimSun glyphs.
  SetFont /LANG=2052 "Microsoft YaHei UI" 10
  SetFont /LANG=1033 "Segoe UI" 10
!macroend

!ifndef BUILD_UNINSTALLER
!include "${BUILD_RESOURCES_DIR}\install-preflight.nsh"
!include "${BUILD_RESOURCES_DIR}\install-directory.nsh"
Var PetShortcutCheckbox
Var PetCreateDesktopShortcut
Var PetInstallPathLabel
Var PetDirectoryText

Function PetDirectoryPage
  Call PetNormalizeInstallDirectory
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "选择安装位置" "选择文件夹后，下面会显示实际安装的完整路径。"
  ${NSD_CreateLabel} 0 10u 100% 24u "实际安装目录（自动补齐 pet-with-you）："
  Pop $0
  ${NSD_CreateText} 0 40u 100% 26u "$INSTDIR"
  Pop $PetDirectoryText
  SendMessage $PetDirectoryText ${EM_SETREADONLY} 1 0
  ${NSD_CreateButton} 0 80u 100u 26u "选择文件夹…"
  Pop $0
  ${NSD_OnClick} $0 PetBrowseDirectory
  ${NSD_CreateLabel} 0 122u 100% 36u "所选位置下会实际创建 pet-with-you 文件夹；选择已有的同名文件夹不会重复嵌套。"
  Pop $0
  nsDialogs::Show
FunctionEnd

Function PetBrowseDirectory
  Pop $0
  nsDialogs::SelectFolderDialog "选择安装位置的上级文件夹" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    StrCpy $INSTDIR $0
    Call PetNormalizeInstallDirectory
    ${NSD_SetText} $PetDirectoryText "$INSTDIR"
  ${EndIf}
FunctionEnd


!macro customInit
  StrCpy $PetCreateDesktopShortcut ${BST_CHECKED}
  ${GetParameters} $R0
  ${GetOptions} $R0 "/NoDesktopShortcut" $R1
  ${IfNot} ${Errors}
    StrCpy $PetCreateDesktopShortcut ${BST_UNCHECKED}
  ${EndIf}
  ${If} ${Silent}
    ; Silent installs still receive /D directly, so apply the same branded subfolder rule.
    Call PetNormalizeInstallDirectory
    Call PetCheckInstallDirectory
    ${If} $PetInstallError != 0
      Call PetReportInstallError
      SetErrorLevel 60001
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page custom PetDirectoryPage
  Page custom PetShortcutPage PetShortcutLeave
!macroend

Function PetShortcutPage
  Call PetNormalizeInstallDirectory
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "安装选项 / Installation options" "pet-with-you 将安装到以下文件夹"
  ${NSD_CreateLabel} 0 8u 100% 30u "最终安装位置 / Final install folder:"
  Pop $PetInstallPathLabel
  ${NSD_CreateLabel} 0 28u 100% 32u "$INSTDIR"
  Pop $0
  ${NSD_CreateCheckbox} 0 68u 100% 20u "创建桌面快捷方式 / Create a desktop shortcut"
  Pop $PetShortcutCheckbox
  ${NSD_SetState} $PetShortcutCheckbox $PetCreateDesktopShortcut
  nsDialogs::Show
FunctionEnd

Function PetShortcutLeave
  Call PetNormalizeInstallDirectory
  ${NSD_GetState} $PetShortcutCheckbox $PetCreateDesktopShortcut
  Call PetCheckInstallDirectory
  ${If} $PetInstallError != 0
    Call PetReportInstallError
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $PetCreateDesktopShortcut == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\pet-with-u.lnk" "$INSTDIR\pet-with-you.exe" "" "$INSTDIR\pet-with-you.exe" 0
  ${EndIf}
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app\repair-shortcuts.ps1" -InstallDirectory "$INSTDIR"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Shortcut icon refresh did not finish; recreate the shortcut from Settings if needed."
  ${EndIf}
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎使用 pet-with-you"
  !define MUI_WELCOMEPAGE_TEXT "一只蓝毛小女仆，陪你工作，也陪你发呆。安装程序会把文件放入独立的 pet-with-you 文件夹。"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "pet-with-you 安装完成"
  !define MUI_FINISHPAGE_TEXT "安装已经完成。你可以从开始菜单或桌面上的 pet-with-u 启动。"
  !insertmacro MUI_PAGE_FINISH
!macroend

!endif

!macro customUnInstall
  ${IfNot} ${isUpdated}
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c ""$INSTDIR\resources\app\Uninstall-Integration.cmd""'
  ${EndIf}
!macroend
