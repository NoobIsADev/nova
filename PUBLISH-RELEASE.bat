@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title Nova Browser - Publish GitHub Release
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Install Git from https://git-scm.com/download/win
  pause
  exit /b 1
)
for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "VERSION=%%V"
if not defined VERSION goto fail
set "TAG=v%VERSION%"
echo.
echo =============================================
echo   NOVA - PUBLISH WINDOWS AUTO-UPDATE
 echo =============================================
echo This will push source and publish the tag %TAG%.
echo GitHub Actions will build the Windows Setup installer, portable EXE,
echo and latest.yml update metadata for installed Nova browsers.
echo.
choice /M "Publish %TAG% now"
if errorlevel 2 exit /b 0
call "%~dp0UPLOAD-TO-GITHUB.bat" --no-pause
if errorlevel 1 goto fail
git rev-parse -q --verify "refs/tags/%TAG%" >nul 2>nul
if not errorlevel 1 (
  echo [ERROR] The local tag %TAG% already exists. Increase version in package.json first.
  goto fail
)
git ls-remote --exit-code --tags origin "refs/tags/%TAG%" >nul 2>nul
if not errorlevel 1 (
  echo [ERROR] GitHub already has tag %TAG%. Increase version in package.json first.
  goto fail
)
git tag "%TAG%"
if errorlevel 1 goto fail
git push origin "%TAG%"
if errorlevel 1 goto fail
echo.
echo [SUCCESS] Version tag %TAG% pushed.
echo View build: https://github.com/NoobIsADev/nova/actions
 echo After GitHub Actions succeeds, the release will appear at:
 echo https://github.com/NoobIsADev/nova/releases
pause
exit /b 0
:fail
echo.
echo [NOVA] Release was not published. Check the error above.
pause
exit /b 1
