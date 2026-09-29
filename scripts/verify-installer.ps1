param([string]$Installer, [string]$PreviousInstaller)
$ErrorActionPreference = 'Stop'
$petRoot = Split-Path -Parent $PSScriptRoot
if (-not $Installer) {
  $petVersion = (Get-Content -LiteralPath (Join-Path $petRoot 'package.json') -Raw | ConvertFrom-Json).version
  $Installer = Join-Path $petRoot "dist\pet-with-you-$petVersion-x64-setup.exe"
}
$Installer = (Resolve-Path -LiteralPath $Installer).Path
if ($PreviousInstaller) { $PreviousInstaller = (Resolve-Path -LiteralPath $PreviousInstaller).Path }
$petDesktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'pet-with-u.lnk'
$petMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'pet-with-u.lnk'
$petLegacyLinks = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs')) | ForEach-Object { Join-Path $_ 'pet-with-you.lnk' }
if (@($petLegacyLinks | Where-Object { Test-Path -LiteralPath $_ }).Count) { throw 'A legacy shortcut exists; use a clean Windows account for this test.' }
$petLegacyJointName='GPT '+[char]0x8054+[char]0x52A8+[char]0x542F+[char]0x52A8+'.lnk'
foreach ($petFolder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) { if (Test-Path -LiteralPath (Join-Path $petFolder $petLegacyJointName)) { throw 'A legacy joint launcher exists; use a clean Windows account.' } }
$petJointName='Codex withu.lnk'
$petJointDesktop=Join-Path ([Environment]::GetFolderPath('Desktop')) $petJointName
$petJointMenu=Join-Path ([Environment]::GetFolderPath('Programs')) $petJointName
$petExisting = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'pet-with-you*' }
if ($petExisting -or (Test-Path -LiteralPath $petDesktop) -or (Test-Path -LiteralPath $petMenu)) { throw 'An existing installation or shortcut exists; use a clean Windows account for this test.' }
if((Test-Path -LiteralPath $petJointDesktop) -or (Test-Path -LiteralPath $petJointMenu)){throw 'Joint launcher already exists; use a clean Windows account for this test.'}
$petTempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$petTemp = Join-Path $petTempBase ('pet installer check ' + [Guid]::NewGuid().ToString('N'))
$petInstallParent = Join-Path $petTemp ('custom ' + [char]0x4E2D + [char]0x6587)
$petInstall = Join-Path $petInstallParent 'pet-with-you'
$petData = Join-Path $petTemp 'user-data'
$petOldCodex = $env:CODEX_HOME
$petOldData = $env:PET_TEST_DATA_DIR
New-Item -ItemType Directory -Path $petData -Force | Out-Null
$env:CODEX_HOME = Join-Path $petTemp 'codex-home'
$env:PET_TEST_DATA_DIR = $petData
New-Item -ItemType Directory -Path $env:CODEX_HOME -Force | Out-Null
Set-Content -LiteralPath (Join-Path $petData 'retain.txt') -Value 'Preserve user data.'
. (Join-Path $petRoot 'shell-shortcut.ps1')
function Uninstall-TestPet {
  $petUninstaller = Join-Path $petInstall 'Uninstall pet-with-you.exe'
  if (Test-Path -LiteralPath $petUninstaller) {
    $petProcess = Start-Process -FilePath $petUninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if ($petProcess.ExitCode -ne 0) { throw 'Uninstaller failed.' }
    for ($petWait = 0; $petWait -lt 100 -and (Test-Path -LiteralPath (Join-Path $petInstall 'pet-with-you.exe')); $petWait++) { Start-Sleep -Milliseconds 200 }
    if (Test-Path -LiteralPath (Join-Path $petInstall 'pet-with-you.exe')) { throw 'Uninstaller left the program behind.' }
  }
}
try {
  $petBlocked = Join-Path $petTemp 'blocked-target'
  Set-Content -LiteralPath $petBlocked -Value 'Preserve this file.'
  $petProcess = Start-Process -FilePath $Installer -ArgumentList "/S /D=$petBlocked" -WindowStyle Hidden -Wait -PassThru
  if ($petProcess.ExitCode -ne 60001 -or (Get-Content -LiteralPath $petBlocked -Raw).Trim() -ne 'Preserve this file.') { throw 'Installer did not reject an unwritable target before extraction.' }
  if ((Test-Path -LiteralPath $petDesktop) -or (Test-Path -LiteralPath $petMenu)) { throw 'Failed preflight created shortcuts.' }
  Write-Output 'PASS: failed directory preflight stops installation before extraction.'
  foreach ($petShortcut in @($false, $true)) {
    $petOptions = if ($petShortcut) { '/S' } else { '/S /NoDesktopShortcut' }
    # NSIS requires /D last and consumes its remaining text as the path, including spaces.
    # Pass the selected parent to verify the installer creates the branded child directory.
    $petFirstInstaller = if ($PreviousInstaller) { $PreviousInstaller } else { $Installer }
    # Older installers interpret /D as the final folder in silent mode.
    $petFirstDirectory = if ($PreviousInstaller) { $petInstall } else { $petInstallParent }
    $petProcess = Start-Process -FilePath $petFirstInstaller -ArgumentList "$petOptions /D=$petFirstDirectory" -WindowStyle Hidden -Wait -PassThru
    if ($petProcess.ExitCode -ne 0) { throw 'Installer failed.' }
    $petExe = Join-Path $petInstall 'pet-with-you.exe'
    if (-not (Test-Path -LiteralPath $petExe)) { throw 'Installation path was not honored.' }
    if ((Test-Path -LiteralPath $petDesktop) -ne $petShortcut) { throw 'Desktop shortcut choice was not honored.' }
    foreach ($petLinkPath in @($petMenu, $(if ($petShortcut) { $petDesktop } else { $petMenu }))) {
      if (-not (Test-Path -LiteralPath $petLinkPath)) { throw 'Missing shortcut.' }
      $petLink = (New-PetShortcut $petLinkPath)
      if ($petLink.TargetPath -ne $petExe -or -not $petLink.IconLocation.StartsWith($petExe, [StringComparison]::OrdinalIgnoreCase)) { throw 'Shortcut target or icon does not match the installed executable.' }
    }
    $petHooksPath = Join-Path $env:CODEX_HOME 'hooks.json'
    foreach($petJointFile in @($petJointDesktop,$petJointMenu)){
      $petJoint=(New-PetShortcut $petJointFile);$petJoint.TargetPath=$petExe;$petJoint.Arguments='--launch-client';$petJoint.Save()
    }
    $petHookCommand = '"' + (Join-Path $petInstall 'resources\app\hook.cmd').Replace('\', '/') + '"'
    $petHooks = @{ hooks = @{ Stop = @(@{ hooks = @(@{type='command'; command=$petHookCommand}, @{type='command'; command='echo fixture-unrelated'}) }) } } | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($petHooksPath, $petHooks, (New-Object Text.UTF8Encoding($false)))
    $petOldVersion = (Get-Content -LiteralPath (Join-Path $petInstall 'resources\app\package.json') -Raw | ConvertFrom-Json).version
    # No /D: a normal upgrade must discover and reuse the registered location.
    $petProcess = Start-Process -FilePath $Installer -ArgumentList $petOptions -WindowStyle Hidden -Wait -PassThru
    $petNewVersion = (Get-Content -LiteralPath (Join-Path $petInstall 'resources\app\package.json') -Raw | ConvertFrom-Json).version
    $petExpectedVersion = (Get-Content -LiteralPath (Join-Path $petRoot 'package.json') -Raw | ConvertFrom-Json).version
    if ($petProcess.ExitCode -ne 0 -or $petNewVersion -ne $petExpectedVersion -or (Get-Content -LiteralPath $petHooksPath -Raw -Encoding UTF8).Trim() -ne $petHooks.Trim()) { throw 'In-place upgrade failed or changed Hooks.' }
    if ((Test-Path -LiteralPath (Join-Path $petInstall 'pet-with-you\pet-with-you.exe')) -or -not (Test-Path -LiteralPath (Join-Path $petData 'retain.txt'))) { throw 'Upgrade nested the installation or lost user data.' }
    foreach ($petLinkPath in @($petMenu, $petJointDesktop, $petJointMenu)) {
      if ((New-PetShortcut $petLinkPath).TargetPath -ne $petExe) { throw 'Upgrade broke an existing shortcut.' }
    }
    Write-Output "PASS: upgrade $petOldVersion -> $petNewVersion reuses its registered folder, preserves Hooks, user data and links."
    & node (Join-Path $PSScriptRoot 'verify-packaged.cjs') $petExe
    if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed.' }
    if ($petShortcut) {
      $petBefore = (Get-FileHash -LiteralPath $petExe -Algorithm SHA256).Hash
      $petIcon = Join-Path $petInstall 'uninstallerIcon.ico'
      try {
        (Get-Item -LiteralPath $petIcon).IsReadOnly = $true
        $petProcess = Start-Process -FilePath $Installer -ArgumentList "$petOptions /D=$petInstallParent" -WindowStyle Hidden -Wait -PassThru
        if ($petProcess.ExitCode -ne 60001) { throw 'Read-only icon did not stop reinstallation.' }
      } finally { (Get-Item -LiteralPath $petIcon).IsReadOnly = $false }
      if ((Get-FileHash -LiteralPath $petExe -Algorithm SHA256).Hash -ne $petBefore -or (Get-Content -LiteralPath $petHooksPath -Raw -Encoding UTF8).Trim() -ne $petHooks.Trim()) { throw 'Failed preflight damaged the existing installation.' }
      Write-Output 'PASS: failed reinstall preserves the installed program and Hooks.'
      $petProcess = Start-Process -FilePath $Installer -ArgumentList "$petOptions /D=$petInstallParent" -WindowStyle Hidden -Wait -PassThru
      if ($petProcess.ExitCode -ne 0 -or (Get-Content -LiteralPath $petHooksPath -Raw -Encoding UTF8).Trim() -ne $petHooks.Trim()) { throw 'Reinstallation changed existing Hooks.' }
      Write-Output 'PASS: same-version reinstall preserves Hooks.'
    }
    Uninstall-TestPet
    $petRemaining = Get-Content -LiteralPath $petHooksPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (@($petRemaining.hooks.Stop[0].hooks).Count -ne 1 -or $petRemaining.hooks.Stop[0].hooks[0].command -ne 'echo fixture-unrelated') { throw 'Uninstaller did not remove only its own Hooks.' }
    if ((Test-Path -LiteralPath $petDesktop) -or (Test-Path -LiteralPath $petMenu)) { throw 'Uninstaller left its shortcut behind.' }
    if((Test-Path -LiteralPath $petJointDesktop) -or (Test-Path -LiteralPath $petJointMenu)){throw 'Uninstaller left its joint launcher behind.'}
    if (-not (Test-Path -LiteralPath (Join-Path $petData 'retain.txt'))) { throw 'Uninstaller removed user data.' }
    Write-Output "PASS: installed app, desktop shortcut=$petShortcut, Start Menu icon, uninstall, retained user data."
  }
} finally {
  Uninstall-TestPet
  $env:CODEX_HOME = $petOldCodex
  $env:PET_TEST_DATA_DIR = $petOldData
  $petResolved = [IO.Path]::GetFullPath($petTemp)
  if (-not $petResolved.StartsWith($petTempBase, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $petResolved -Leaf) -notlike 'pet installer check *') { throw 'Refusing cleanup outside the temporary test directory.' }
  Remove-Item -LiteralPath $petResolved -Recurse -Force
}
