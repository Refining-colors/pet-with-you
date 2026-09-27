@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\..\pet-with-you.exe" "%~dp0hook.cjs"
