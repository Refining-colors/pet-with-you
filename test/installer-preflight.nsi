Unicode true
Name "pet-with-you isolated directory check"
OutFile "${PET_OUTPUT}"
RequestExecutionLevel user
SilentInstall silent
!include "${PET_PREFLIGHT}"
Section
  Call PetCheckInstallDirectory
  SetErrorLevel $PetInstallError
  Quit
SectionEnd
