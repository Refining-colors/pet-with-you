@echo off
cd /d "%~dp0"
node scripts\dev.cjs
if errorlevel 1 pause
