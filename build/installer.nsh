!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!include MUI2.nsh

!ifndef BUILD_UNINSTALLER
!include "${BUILD_RESOURCES_DIR}\install-preflight.nsh"
!include "${BUILD_RESOURCES_DIR}\install-directory.nsh"
Var PetShortcutCheckbox
Var PetCreateDesktopShortcut
Var PetInstallPathLabel


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
  ; Replace the builder's substring check with a final-component check, including upgrades.
  !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !define MUI_PAGE_CUSTOMFUNCTION_PRE PetNormalizeInstallDirectory
  Page custom PetShortcutPage PetShortcutLeave
!macroend

Function PetShortcutPage
  Call PetNormalizeInstallDirectory
  ; Retain the builder hook only where it cannot relocate a legacy installation.
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 == "pet-with-you"
    Call instFilesPre
  ${EndIf}
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
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎使用 pet-with-you"
  !define MUI_WELCOMEPAGE_TEXT "一只蓝毛小女仆，陪你工作，也陪你发呆。安装程序会把文件放入独立的 pet-with-you 文件夹。"
  !define MUI_WELCOMEPAGE_BITMAP "${BUILD_RESOURCES_DIR}\pet-finish.bmp"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "pet-with-you 安装完成"
  !define MUI_FINISHPAGE_TEXT "安装已经完成。你可以从开始菜单或桌面上的 pet-with-u 启动。"
  !define MUI_FINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\pet-finish.bmp"
  !insertmacro MUI_PAGE_FINISH
!macroend

!endif

!macro customUnInstall
  ${IfNot} ${isUpdated}
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c ""$INSTDIR\resources\app\Uninstall-Integration.cmd""'
  ${EndIf}
!macroend
