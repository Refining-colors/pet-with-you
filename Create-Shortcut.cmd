@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"
if errorlevel 1 pause
