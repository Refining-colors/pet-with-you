param([Parameter(Mandatory=$true)][string]$Executable,[string]$Arguments='',[string]$WorkingDirectory='')
$ErrorActionPreference='Stop'
if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Application executable was not found.' }
# Use the existing Explorer desktop, not a new in-process Shell.Application launcher.
$petWindows=(New-Object -ComObject Shell.Application).Windows()
$petHandle=0
$petDesktop=$petWindows.FindWindowSW(0,0,8,[ref]$petHandle,1)
if(-not $petDesktop.Document.Application){throw 'Windows Explorer desktop is unavailable.'}
$petDesktop.Document.Application.ShellExecute($Executable,$Arguments,$WorkingDirectory,'open',1)
