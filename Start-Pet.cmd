@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS first. See docs\INSTALL.md.
  pause
  exit /b 1
)
node launch.cjs
if errorlevel 1 pause
