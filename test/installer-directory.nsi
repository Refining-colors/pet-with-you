Unicode true
RequestExecutionLevel user
SilentInstall silent
OutFile "${PET_OUTPUT}"
!define INSTALL_REGISTRY_KEY "Software\pet-with-you-directory-test-${PET_TEST_ID}"
!include "${PET_DIRECTORY}"
Section
  Call PetNormalizeInstallDirectory
  CreateDirectory "$INSTDIR"
  FileOpen $0 "$EXEDIR\normalized.txt" w
  FileWriteUTF16LE $0 "$INSTDIR"
  FileClose $0
SectionEnd
