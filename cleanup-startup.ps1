param([Parameter(Mandatory=$true)][string]$Root)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$petDesktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'pet-with-you.lnk'
$petInstalledExe = [IO.Path]::GetFullPath((Join-Path $Root '..\..\pet-with-you.exe'))
if (Test-Path -LiteralPath $petDesktopLink) {
  $petShortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($petDesktopLink)
  if ($petShortcut.TargetPath -eq $petInstalledExe) { Remove-Item -LiteralPath $petDesktopLink }
}
foreach($petFolder in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'))) {
  $petJointLink=Join-Path $petFolder 'GPT 联动启动.lnk'
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
