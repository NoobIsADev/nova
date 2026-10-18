@echo off
setlocal
cd /d "%~dp0"
title Nova Browser - Launch
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo [NOVA] Installing dependencies for first run...
  call npm install
  if errorlevel 1 goto failed
)
echo [NOVA] Opening browser...
call npm start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo [NOVA] Something went wrong. Check errors above.
pause
exit /b 1
