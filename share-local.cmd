@echo off
setlocal
cd /d "%~dp0"

set "NPM_CMD=npm"
where npm >nul 2>nul
if errorlevel 1 (
  if exist "C:\Program Files\nodejs\npm.cmd" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
  ) else (
    echo npm was not found.
    echo Install Node.js LTS from https://nodejs.org/ then run this file again.
    pause
    exit /b 1
  )
)

if not exist "node_modules" (
  echo Installing dependencies...
  "%NPM_CMD%" install --cache .npm-cache
  if errorlevel 1 exit /b 1
)

echo.
echo ChallengeX will run on this computer and be visible on the same Wi-Fi.
echo Find your IPv4 address with: ipconfig
echo Share this shape of link: http://YOUR-IPV4-ADDRESS:5173/
echo.
"%NPM_CMD%" run dev -- --host 0.0.0.0 --port 5173
