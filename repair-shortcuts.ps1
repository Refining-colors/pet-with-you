param(
  [Parameter(Mandatory=$true)][string]$InstallDirectory,
  [string[]]$ShortcutDirectories
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'shell-shortcut.ps1')
$petExe = [IO.Path]::GetFullPath((Join-Path $InstallDirectory 'pet-with-you.exe'))
if (-not (Test-Path -LiteralPath $petExe -PathType Leaf)) { throw 'Installed executable is missing.' }
if (-not $ShortcutDirectories) {
  $ShortcutDirectories = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
}
$petRepaired = 0
foreach ($petDirectory in $ShortcutDirectories) {
  if (-not (Test-Path -LiteralPath $petDirectory -PathType Container)) { continue }
  foreach ($petFile in Get-ChildItem -LiteralPath $petDirectory -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue) {
    try {
      $petLink = New-PetShortcut $petFile.FullName
      # Match the installed target, not the name. Preserve joint launchers and all other link fields.
      if ($petLink.TargetPath -ine $petExe -or $petLink.Arguments -match '--launch-client' -or $petLink.Description -like 'Codex withu*') { continue }
      [PetUnicodeShortcut]::UpdateIcon($petFile.FullName, $petExe)
      $petRepaired++
    } catch { Write-Warning 'One shortcut could not be inspected or refreshed; it was left in place.' }
  }
}
# Replacing an EXE at the same path does not reliably invalidate Explorer's icon cache.
[PetUnicodeShortcut]::RefreshIcons()
Write-Output "Shortcut icons refreshed: $petRepaired"
