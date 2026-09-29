Unicode true
Name "pet-with-you UI test"
OutFile "${PET_OUTPUT}"
InstallDir "${PET_DESTINATION}"
RequestExecutionLevel user
!define APP_GUID "pet-with-you-isolated-ui-test"
!define BUILD_RESOURCES_DIR "${PET_ROOT}\build"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\pet-finish.bmp"
!define MUI_CUSTOMFUNCTION_GUIINIT PetPreviewFont
!include "${BUILD_RESOURCES_DIR}\installer.nsh"
!insertmacro customWelcomePage
!insertmacro customPageAfterChangeDir
!insertmacro MUI_PAGE_INSTFILES
!insertmacro customFinishPage
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
!insertmacro customHeader
Function .onInit
  !insertmacro customInit
FunctionEnd
Function PetPreviewFont
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_GETFONT} 0 0 $1
  System::Alloc 92
  Pop $2
  System::Call 'gdi32::GetObjectW(p r1, i 92, p r2)'
  IntOp $3 $2 + 28
  System::Call '*$3(&w32 .r4)'
  FileOpen $0 "$EXEDIR\installer-font.txt" w
  FileWriteUTF16LE $0 "$4"
  FileClose $0
  System::Free $2
FunctionEnd
Section
  ; No program install, registration, shortcuts, or user-data writes in this UI fixture.
  CreateDirectory "$INSTDIR"
SectionEnd
