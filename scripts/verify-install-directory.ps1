param([string]$Compiler)
$ErrorActionPreference = 'Stop'
$petRoot = Split-Path -Parent $PSScriptRoot
if (-not $Compiler) {
  $petCache = if ($env:ELECTRON_BUILDER_CACHE) { $env:ELECTRON_BUILDER_CACHE } else { Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'electron-builder\Cache' }
  $Compiler = Get-ChildItem -LiteralPath $petCache -Filter makensis.exe -File -Recurse | Where-Object { Test-Path -LiteralPath (Join-Path $_.DirectoryName 'Include\LogicLib.nsh') } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Compiler) { throw 'NSIS compiler not found. Build the Windows installer first, or pass -Compiler.' }
$petQa = Join-Path $petRoot 'qa-output'
$petTemp = Join-Path $petQa ('install-directory-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $petTemp -Force | Out-Null
$petCheck = Join-Path $petTemp 'check.exe'
$petLock = $null
$petReadOnly = $null
$petDenied = $null
$petOriginalAcl = $null
function Test-PetDirectory([string]$Target, [int[]]$Expected) {
  $petProcess = Start-Process -FilePath $petCheck -ArgumentList "/D=$Target" -WindowStyle Hidden -Wait -PassThru
  if ($petProcess.ExitCode -notin $Expected) { throw "Unexpected directory check result $($petProcess.ExitCode), expected $Expected for $Target" }
  Write-Output "PASS: directory preflight returned $($petProcess.ExitCode) for $(Split-Path $Target -Leaf)"
}
try {
  & $Compiler /V2 "/DPET_OUTPUT=$petCheck" "/DPET_PREFLIGHT=$(Join-Path $petRoot 'build\install-preflight.nsh')" (Join-Path $petRoot 'test\installer-preflight.nsi')
  if ($LASTEXITCODE -ne 0) { throw 'Directory check compilation failed.' }
  Test-PetDirectory (Join-Path $petTemp 'Apifox\pet-with-you') @(0)
  $petUnicode = Join-Path $petTemp ("custom ' " + [char]0x4E2D + [char]0x6587 + '\pet-with-you')
  Test-PetDirectory $petUnicode @(0)
  if (@(Get-ChildItem -LiteralPath $petUnicode -File -Recurse).Count -ne 0) { throw 'Preflight left probe files behind.' }

  $petBlocked = Join-Path $petTemp 'not-a-directory'
  Set-Content -LiteralPath $petBlocked -Value 'Keep this file.'
  Test-PetDirectory $petBlocked @(3,267)
  if ((Get-Content -LiteralPath $petBlocked -Raw).Trim() -ne 'Keep this file.') { throw 'Preflight modified a blocking file.' }

  $petReadOnly = Join-Path $petUnicode 'uninstallerIcon.ico'
  Set-Content -LiteralPath $petReadOnly -Value 'Keep this icon.'
  (Get-Item -LiteralPath $petReadOnly).IsReadOnly = $true
  Test-PetDirectory $petUnicode @(5)
  (Get-Item -LiteralPath $petReadOnly).IsReadOnly = $false
  if ((Get-Content -LiteralPath $petReadOnly -Raw).Trim() -ne 'Keep this icon.') { throw 'Preflight modified the existing icon.' }

  $petVideo = Join-Path $petUnicode 'resources\app\assets\webm\locked.webm'
  Set-Content -LiteralPath $petVideo -Value 'Keep this animation.'
  $petLock = [IO.File]::Open($petVideo, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  Test-PetDirectory $petUnicode @(32)
  $petLock.Dispose(); $petLock = $null
  Test-PetDirectory $petUnicode @(0)
  if ((Get-Content -LiteralPath $petVideo -Raw).Trim() -ne 'Keep this animation.') { throw 'Preflight modified an existing animation.' }

  # Apply a denial only to this owned fixture, then restore its original ACL before cleanup.
  $petDenied = Join-Path $petTemp 'access-denied'
  New-Item -ItemType Directory -Path $petDenied | Out-Null
  $petOriginalAcl = Get-Acl -LiteralPath $petDenied
  $petDeniedAcl = Get-Acl -LiteralPath $petDenied
  $petSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $petRule = New-Object Security.AccessControl.FileSystemAccessRule($petSid, 'Write', 'ContainerInherit,ObjectInherit', 'None', 'Deny')
  $petDeniedAcl.AddAccessRule($petRule)
  Set-Acl -LiteralPath $petDenied -AclObject $petDeniedAcl
  Test-PetDirectory $petDenied @(5)
} finally {
  if ($petLock) { $petLock.Dispose() }
  if ($petReadOnly -and (Test-Path -LiteralPath $petReadOnly)) { (Get-Item -LiteralPath $petReadOnly).IsReadOnly = $false }
  if ($petDenied -and $petOriginalAcl) { Set-Acl -LiteralPath $petDenied -AclObject $petOriginalAcl }
  $petResolved = [IO.Path]::GetFullPath($petTemp)
  if (-not $petResolved.StartsWith([IO.Path]::GetFullPath($petQa) + '\', [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $petResolved -Leaf) -notlike 'install-directory-*') { throw 'Refusing cleanup outside the isolated test directory.' }
  Remove-Item -LiteralPath $petResolved -Recurse -Force
}
