param([Parameter(Mandatory=$true)][string]$DataDir,[switch]$WatchOnly)
$ErrorActionPreference='Stop'
if($WatchOnly){exit}
$petFile=Join-Path $DataDir 'settings.json'
if(-not(Test-Path -LiteralPath $petFile)){exit}
$petSettings=Get-Content -LiteralPath $petFile -Raw -Encoding UTF8 | ConvertFrom-Json
if($petSettings.schemaVersion -ne 1 -or $petSettings.sections.preferences.autostart -ne $true){exit}
$petTarget=Get-Content -LiteralPath (Join-Path $DataDir 'startup-target.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not(Test-Path -LiteralPath $petTarget.executable)){exit}
$petArgs=if($petTarget.packaged){'--background'}else{'"'+$petTarget.root+'" --background'}
if(-not $petTarget.packaged -and $petTarget.nodeExecutable){$petArgs+=' "--pet-node-exe='+$petTarget.nodeExecutable+'"'}
& (Join-Path $PSScriptRoot 'launch-detached.ps1') -Executable $petTarget.executable -Arguments $petArgs -WorkingDirectory $petTarget.root
