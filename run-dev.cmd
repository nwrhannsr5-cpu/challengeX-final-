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

"%NPM_CMD%" run dev -- --host 127.0.0.1 --port 5173
