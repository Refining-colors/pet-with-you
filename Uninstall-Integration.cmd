@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\pet-with-you.exe" "%~dp0uninstall-hooks.cjs"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0cleanup-startup.ps1" -Root "%~dp0."
