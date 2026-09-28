param([string]$DestinationDirectory)
$ErrorActionPreference = 'Stop'
$petRoot = Split-Path -Parent $PSScriptRoot
if (-not $DestinationDirectory) { $DestinationDirectory = [Environment]::GetFolderPath('Desktop') }
if (-not (Test-Path -LiteralPath $DestinationDirectory -PathType Container)) { throw 'Shortcut destination does not exist.' }
$petNode = (Get-Command node.exe -ErrorAction Stop).Source
. (Join-Path $petRoot 'shell-shortcut.ps1')
$petFile = Join-Path $DestinationDirectory 'pet-with-u.lnk'
for ($petIndex = 2; Test-Path -LiteralPath $petFile; $petIndex++) {
  $petFile = Join-Path $DestinationDirectory ("pet-with-u ($petIndex).lnk")
}
$petLink = New-PetShortcut $petFile
$petLink.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$petLink.Arguments = '"' + (Join-Path $petRoot 'launcher.vbs') + '" normal "' + $petNode + '"'
$petLink.WorkingDirectory = $petRoot
$petLink.IconLocation = (Join-Path $petRoot 'build\icon.ico') + ',0'
$petLink.Description = 'pet-with-you desktop companion'
$petLink.WindowStyle = 7
$petLink.Save()
Write-Output 'Desktop shortcut created.'
