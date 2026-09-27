@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or later, then run this file again.
  if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||a===22&&b>=12?0:1)"
if errorlevel 1 (
  echo Node.js 22.12 or later is required.
  if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
  exit /b 1
)
call npm ci --cache .npm-cache
if errorlevel 1 (
  echo Dependency installation failed. Check the output above.
  if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
  exit /b 1
)
node scripts\doctor.cjs
if errorlevel 1 (
  echo Installation is incomplete. See docs\TROUBLESHOOTING.md.
  if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
  exit /b 1
)
if /i "%~1"=="--no-shortcut" goto ready
if /i "%~1"=="--shortcut" goto shortcut
choice /c YN /n /m "Create a desktop shortcut? [Y/N]: "
if errorlevel 2 goto ready
:shortcut
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"
if errorlevel 1 (
  echo Dependencies are ready, but shortcut creation failed. Try Create-Shortcut.cmd later.
  if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
  exit /b 1
)
:ready
echo Ready. Double-click Start-Pet.cmd to launch.
if /i not "%~1"=="--no-shortcut" if /i not "%~1"=="--shortcut" pause
