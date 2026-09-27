@echo off
cd /d "%~dp0"
node review-hooks.cjs
if errorlevel 1 echo.
echo Review window closed with exit code %errorlevel%. Press any key to close this diagnostic window.
pause >nul
