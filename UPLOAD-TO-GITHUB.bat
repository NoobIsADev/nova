@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title Nova Browser - Upload source to GitHub
set "REPO=https://github.com/NoobIsADev/nova.git"
set "QUIET_PAUSE=0"
if /I "%~1"=="--no-pause" set "QUIET_PAUSE=1"
echo.
echo =============================================
echo   NOVA - UPLOAD SOURCE TO GITHUB
 echo =============================================
echo Repository: https://github.com/NoobIsADev/nova
 echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed. Install Git for Windows: https://git-scm.com/download/win
  goto fail
)
if not exist ".git\HEAD" (
  echo [1/5] Setting up local Git...
  git init -b main
  if errorlevel 1 goto fail
)
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="main" (
  echo [ERROR] Please use the main branch. Current branch: %CURRENT_BRANCH%
  echo [HELP] Switch to main yourself before running this script.
  goto fail
)
set "CURRENT_ORIGIN="
for /f "delims=" %%O in ('git remote get-url origin 2^>nul') do set "CURRENT_ORIGIN=%%O"
if not defined CURRENT_ORIGIN (
  git remote add origin "%REPO%"
  if errorlevel 1 goto fail
) else (
  if /I not "%CURRENT_ORIGIN%"=="%REPO%" (
    if /I not "%CURRENT_ORIGIN%"=="git@github.com:NoobIsADev/nova.git" (
      echo [ERROR] This folder points to a different origin: %CURRENT_ORIGIN%
      echo [HELP] No remote URL was changed. Check your repository first.
      goto fail
    )
  )
)
echo [2/5] Checking GitHub branch...
git ls-remote --exit-code --heads origin main >nul 2>nul
if errorlevel 1 (
  echo [NOVA] No remote main branch found, or it could not be checked.
  echo [NOVA] Attempting an initial push. Make sure GitHub authentication succeeds.
) else (
  git rev-parse HEAD >nul 2>nul
  if errorlevel 1 (
    echo [NOVA] Importing existing GitHub history without replacing your source files...
    git fetch origin main
    if errorlevel 1 goto fail
    git reset --mixed FETCH_HEAD
    if errorlevel 1 goto fail
  )
)
echo [3/5] Staging project files...
git add -A
if errorlevel 1 goto fail
git diff --cached --quiet
if errorlevel 1 (
  echo [4/5] Committing changes...
  git commit -m "Update Nova Browser source"
  if errorlevel 1 (
    echo [ERROR] Git needs your name/email configured.
    echo Run: git config --global user.name "Your Name"
    echo Run: git config --global user.email "your-email@example.com"
    goto fail
  )
) else (
  echo [4/5] No local file changes to commit.
)
echo [5/5] Synchronizing and uploading to GitHub...
git ls-remote --exit-code --heads origin main >nul 2>nul
if not errorlevel 1 (
  git fetch origin main
  if errorlevel 1 goto fail
  git rebase origin/main
  if errorlevel 1 (
    echo [ERROR] Rebase conflict. Your files were not force-pushed.
    echo Fix conflicts and run git rebase --continue before uploading again.
    goto fail
  )
)
git push -u origin main
if errorlevel 1 goto fail
echo.
echo [SUCCESS] Source uploaded to https://github.com/NoobIsADev/nova
 echo To publish a downloadable update for installed browsers, run PUBLISH-RELEASE.bat
if "%QUIET_PAUSE%"=="0" pause
exit /b 0
:fail
echo.
echo [NOVA] Upload stopped. Read the error above; nothing was force-pushed.
if "%QUIET_PAUSE%"=="0" pause
exit /b 1
