param([Parameter(Mandatory=$true)][string]$DataDir,[switch]$WatchOnly)
$ErrorActionPreference='Stop'
$petMutex=New-Object System.Threading.Mutex($false,'Local\DSHPetStartupWatcher')
if(-not $petMutex.WaitOne(0)){exit}
function Start-Pet {
  $target=Get-Content -LiteralPath (Join-Path $DataDir 'startup-target.json') -Raw | ConvertFrom-Json
  if(-not (Test-Path -LiteralPath $target.executable)){return}
  $petArgs=if($target.packaged){'--background'}else{'"'+$target.root+'" --background'}
  Start-Process -FilePath $target.executable -ArgumentList $petArgs -WorkingDirectory $target.root -WindowStyle Hidden
}
try {
  $petPrefs=Get-Content -LiteralPath (Join-Path $DataDir 'preferences.json') -Raw | ConvertFrom-Json
  if(-not $WatchOnly -and $petPrefs.autostart){Start-Pet}
  $wasRunning=$false
  while($true){
    $petPrefs=Get-Content -LiteralPath (Join-Path $DataDir 'preferences.json') -Raw | ConvertFrom-Json
    if($petPrefs.mode -ne 'connected' -or -not $petPrefs.followClientStart){break}
    $running=@(Get-Process -Name Codex,ChatGPT -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0}).Count -gt 0
    if($running -and -not $wasRunning){Start-Pet}
    $wasRunning=$running
    Start-Sleep -Seconds 3
  }
} finally {$petMutex.ReleaseMutex();$petMutex.Dispose()}
