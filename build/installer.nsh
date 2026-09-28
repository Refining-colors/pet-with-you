!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh
!include MUI2.nsh

!ifndef BUILD_UNINSTALLER
!include "${BUILD_RESOURCES_DIR}\install-preflight.nsh"
Var PetShortcutCheckbox
Var PetCreateDesktopShortcut

!macro customInit
  StrCpy $PetCreateDesktopShortcut ${BST_CHECKED}
  ${GetParameters} $R0
  ${GetOptions} $R0 "/NoDesktopShortcut" $R1
  ${IfNot} ${Errors}
    StrCpy $PetCreateDesktopShortcut ${BST_UNCHECKED}
  ${EndIf}
  ${If} ${Silent}
    Call PetCheckInstallDirectory
    ${If} $PetInstallError != 0
      Call PetReportInstallError
      SetErrorLevel 60001
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  Page custom PetShortcutPage PetShortcutLeave
!macroend

Function PetShortcutPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "桌面快捷方式 / Desktop shortcut" "选择安装选项 / Choose installation options"
  ${NSD_CreateCheckbox} 0 12u 100% 20u "创建桌面快捷方式 / Create a desktop shortcut"
  Pop $PetShortcutCheckbox
  ${NSD_SetState} $PetShortcutCheckbox $PetCreateDesktopShortcut
  nsDialogs::Show
FunctionEnd

Function PetShortcutLeave
  ${NSD_GetState} $PetShortcutCheckbox $PetCreateDesktopShortcut
  ; Use electron-builder's final directory before testing, not the parent selected in Browse.
  Call instFilesPre
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

!endif

!macro customUnInstall
  ${IfNot} ${isUpdated}
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c ""$INSTDIR\resources\app\Uninstall-Integration.cmd""'
  ${EndIf}
!macroend
