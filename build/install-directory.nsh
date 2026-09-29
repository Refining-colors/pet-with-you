!include LogicLib.nsh
!include FileFunc.nsh
!define /ifndef INSTALL_REGISTRY_KEY "Software\${APP_GUID}"

Function PetNormalizeInstallDirectory
  Push $0
  Push $1
  System::Call 'kernel32::GetFullPathNameW(w "$INSTDIR", i ${NSIS_MAX_STRLEN}, w .r0, p 0) i.r1'
  ${If} $1 > 0
  ${AndIf} $1 < ${NSIS_MAX_STRLEN}
    StrCpy $INSTDIR $0
  ${EndIf}
  pet_directory_trim:
  StrLen $0 $INSTDIR
  ${If} $0 > 3
    StrCpy $1 $INSTDIR 1 -1
    ${If} $1 == "\"
      StrCpy $INSTDIR $INSTDIR -1
      Goto pet_directory_trim
    ${EndIf}
  ${EndIf}
  ; Existing installations may predate the branded subfolder rule. Keep their hooks and links valid.
  ReadRegStr $1 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $1 != ""
    ${If} $INSTDIR == $1
    ${AndIf} ${FileExists} "$INSTDIR\pet-with-you.exe"
      Goto pet_directory_done
    ${EndIf}
  ${EndIf}
  ${GetFileName} "$INSTDIR" $0
  ${If} $0 != "pet-with-you"
    StrCpy $INSTDIR "$INSTDIR\pet-with-you"
  ${EndIf}
  pet_directory_done:
  Pop $1
  Pop $0
FunctionEnd
