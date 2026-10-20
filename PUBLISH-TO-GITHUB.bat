@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title Nova Browser - One Click GitHub Release
set "REPO=NoobIsADev/nova"
set "REPO_URL=https://github.com/%REPO%.git"
set "PROJECT=%~dp0."
echo.
echo =====================================================
echo   NOVA BROWSER - PUBLISH COMPLETE GITHUB RELEASE
echo =====================================================
echo.
echo This ONE script will:
echo   1. Copy this Nova Browser source into a clean Git clone.
echo   2. Push it to the main branch of %REPO%.
echo   3. Create a new release tag.
echo   4. Trigger GitHub Actions to build + publish AppImage,
echo      Windows Setup, Portable EXE and (if successful) Mac DMG/ZIP.
echo.
echo You do NOT need to build the AppImage on your PC.
echo.
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git for Windows is required: https://git-scm.com/download/win
  goto fail
)
where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell is required to read package.json.
  goto fail
)
for /f "usebackq delims=" %%V in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json).version"`) do set "VERSION=%%V"
if not defined VERSION (
  echo [ERROR] Cannot read package.json version. Run this inside the Nova project folder.
  goto fail
)
set "TAG=v%VERSION%"
echo Version: %TAG%
echo Repository: https://github.com/%REPO%
echo.
choice /C YN /N /M "Upload source and create release %TAG%? [Y/N]: "
if errorlevel 2 exit /b 0

echo.
echo [1/6] Checking whether the release tag already exists...
git ls-remote --exit-code --tags "%REPO_URL%" "refs/tags/%TAG%" >nul 2>nul
if not errorlevel 1 (
  echo [ERROR] %TAG% is already tagged on GitHub. Increase package.json version for a new release.
  goto fail
)
set "WORK=%TEMP%\nova-release-%RANDOM%-%RANDOM%"
if exist "%WORK%" (
  echo [ERROR] Temporary folder already exists. Try again.
  goto fail
)
echo [2/6] Cloning current main branch without touching your original project...
git clone --depth 1 --branch main "%REPO_URL%" "%WORK%"
if errorlevel 1 (
  echo [ERROR] Cannot clone repository. Check internet access and GitHub authentication.
  goto fail
)

echo [3/6] Copying updated source and GitHub Actions workflow...
robocopy "%PROJECT%" "%WORK%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD ".git" "node_modules" "dist" ".cache" ".vscode" ".idea" /XF ".env" ".env.local" "*.log" "*.tmp" "*.zip" "*.AppImage"
if errorlevel 8 (
  echo [ERROR] Failed to copy project files.
  goto fail
)

cd /d "%WORK%"
echo [4/6] Creating a source commit...
for /f "delims=" %%N in ('git config user.name') do set "GIT_NAME=%%N"
for /f "delims=" %%E in ('git config user.email') do set "GIT_EMAIL=%%E"
if not defined GIT_NAME git config user.name "NoobIsADev"
if not defined GIT_EMAIL git config user.email "216835424+NoobIsADev@users.noreply.github.com"
git add -A
if errorlevel 1 goto fail
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Release Nova Browser %TAG% with automatic AppImage publishing"
  if errorlevel 1 goto fail
) else (
  echo [INFO] Source is unchanged. Publishing the existing main commit.
)

echo [5/6] Uploading source to GitHub main...
git push origin HEAD:main
if errorlevel 1 (
  echo [ERROR] Push failed. The main branch may have changed. Re-run this script.
  goto fail
)

echo [6/6] Creating and pushing release tag %TAG%...
git tag "%TAG%"
if errorlevel 1 goto fail
git push origin "%TAG%"
if errorlevel 1 goto fail

echo.
echo =====================================================
echo   SUCCESS! SOURCE + RELEASE TAG UPLOADED
echo =====================================================
echo GitHub will now BUILD AND UPLOAD the AppImage itself.
echo GitHub Actions: https://github.com/%REPO%/actions
echo Release files: https://github.com/%REPO%/releases/tag/%TAG%
echo.
echo Wait for the Linux build and Publish jobs to finish.
echo When complete, anyone can download the AppImage directly.
echo If Mac fails, Linux still publishes.
echo.
pause
exit /b 0

:fail
echo.
echo [NOVA] Could not complete the release. Read the error above.
echo Nothing was force-pushed. Existing releases were not overwritten.
echo.
pause
exit /b 1
