@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.12 or later, then run this file again.
  pause
  exit /b 1
)
call npm ci --cache .npm-cache
if errorlevel 1 (
  echo Dependency installation failed. Check the output above.
  pause
  exit /b 1
)
echo Ready. Double-click Start-Pet.cmd to launch.
pause
