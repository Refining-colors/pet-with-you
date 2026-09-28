param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$petInstalledExe = [IO.Path]::GetFullPath((Join-Path $Root '..\..\pet-with-you.exe'))
foreach ($petFolder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  foreach ($petName in @('pet-with-u.lnk', 'pet-with-you.lnk')) {
    $petShortcutPath = Join-Path $petFolder $petName
    if (Test-Path -LiteralPath $petShortcutPath) {
      $petShortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($petShortcutPath)
      if ($petShortcut.TargetPath -eq $petInstalledExe) { Remove-Item -LiteralPath $petShortcutPath }
    }
  }
}
$petJointLinks = @()
foreach($petFolder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))) {
  $petJointLinks += Join-Path $petFolder 'GPT 联动启动.lnk'
  $petJointLinks += Join-Path $petFolder 'Codex withu.lnk'
}
$petDataDirectory = if ($env:PET_TEST_DATA_DIR) { $env:PET_TEST_DATA_DIR } else { Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'DSH Pet Companion' }
try {
  $petLauncherRecord = Get-Content -LiteralPath (Join-Path $petDataDirectory 'client-launcher.local.json') -Raw | ConvertFrom-Json
  $petJointLinks += @($petLauncherRecord.shortcuts | Where-Object { $_ -is [string] -and [IO.Path]::IsPathRooted($_) -and [IO.Path]::GetExtension($_) -eq '.lnk' })
} catch { }
foreach($petJointLink in @($petJointLinks | Select-Object -Unique)) {
  if(Test-Path -LiteralPath $petJointLink) {
    $petJoint=(New-Object -ComObject WScript.Shell).CreateShortcut($petJointLink)
    if($petJoint.TargetPath -eq $petInstalledExe -and $petJoint.Arguments -eq '--launch-client') {Remove-Item -LiteralPath $petJointLink}
  }
}
$petLinkPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'DSH Pet Companion.lnk'
if (Test-Path -LiteralPath $petLinkPath) {
  $petLink = (New-Object -ComObject WScript.Shell).CreateShortcut($petLinkPath)
  $petScript = Join-Path $Root 'startup-watch.ps1'
  if ($petLink.Arguments.Contains('"' + $petScript + '"')) {
    Remove-Item -LiteralPath $petLinkPath
  }
}
