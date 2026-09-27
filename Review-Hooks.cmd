@echo off
cd /d "%~dp0"
if exist "%~dp0..\..\pet-with-you.exe" (
  set "ELECTRON_RUN_AS_NODE=1"
  "%~dp0..\..\pet-with-you.exe" "%~dp0review-hooks.cjs"
  goto finished
)
node review-hooks.cjs
:finished
if errorlevel 1 echo.
echo Review window closed with exit code %errorlevel%. Press any key to close this diagnostic window.
pause >nul
