@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [START001] Node.js is missing. Install Node.js 24 LTS from https://nodejs.org/
  echo See README.md for setup instructions, then run this file again.
  pause
  exit /b 1
)
node scripts\start.mjs %*
if errorlevel 1 pause
endlocal
