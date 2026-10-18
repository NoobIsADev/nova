@echo off
setlocal
cd /d "%~dp0"
title Nova Browser - Windows Builder
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js + npm are required. Install from https://nodejs.org/
  pause
  exit /b 1
)
echo.
echo =========================================
echo    NOVA BROWSER  -  WINDOWS BUILDER
 echo =========================================
echo.
echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto failed
echo.
echo [2/3] Checking JavaScript and tests...
call npm run check
if errorlevel 1 goto failed
echo.
echo [3/3] Building the Windows installer and portable EXE...
call npm run build:win
if errorlevel 1 goto failed
echo.
echo =========================================
echo BUILD COMPLETE: Open the dist folder
 echo =========================================
start "" "%~dp0dist"
pause
exit /b 0
:failed
echo.
echo [NOVA] Build failed. Check the error above.
pause
exit /b 1
