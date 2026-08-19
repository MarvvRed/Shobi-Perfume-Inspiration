@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Shobi Fragrantica Main Notes - One Click

echo.
echo ===============================================
echo   SHOBI FRAGRANTICA MAIN NOTES - ONE CLICK
echo ===============================================
echo.

set "NODE_EXE=node"
set "NPM_CMD=npm"
where node >nul 2>nul
if errorlevel 1 (
  echo [1/4] Node non trovato. Preparo una copia portable locale...
  set "NODE_VERSION=v22.18.0"
  set "NODE_DIR=%CD%\.runtime\node-v22.18.0-win-x64"
  set "NODE_ZIP=%CD%\.runtime\node.zip"
  if not exist "!NODE_DIR!\node.exe" (
    if not exist "%CD%\.runtime" mkdir "%CD%\.runtime"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/v22.18.0/node-v22.18.0-win-x64.zip' -OutFile '!NODE_ZIP!'; Expand-Archive -Force -Path '!NODE_ZIP!' -DestinationPath '%CD%\.runtime'"
    if errorlevel 1 goto :fail
  )
  set "PATH=!NODE_DIR!;!PATH!"
  set "NODE_EXE=!NODE_DIR!\node.exe"
  set "NPM_CMD=!NODE_DIR!\npm.cmd"
  echo       Node portable pronto.
) else (
  echo [1/4] Node trovato.
)

echo [2/4] Preparo Playwright Core...
if not exist "node_modules\playwright-core\package.json" (
  call "!NPM_CMD!" install --no-save --no-audit --no-fund playwright-core@1.55.0
  if errorlevel 1 goto :fail
) else (
  echo       Playwright Core gia presente.
)

echo [3/4] Avvio la cattura automatica dei 10 bestseller...
echo       Si aprira Microsoft Edge. Non devi fare nulla.
echo.
"!NODE_EXE!" capture.mjs
if errorlevel 1 goto :fail

echo.
echo [4/4] COMPLETATO.
echo.
if exist "results\bestsellers-1-10.json" (
  echo Risultato: %CD%\results\bestsellers-1-10.json
  start "" notepad.exe "%CD%\results\bestsellers-1-10.json"
)
echo.
pause
exit /b 0

:fail
echo.
echo ERRORE: il processo non e terminato correttamente.
echo Copia quello che vedi in questa finestra e mandamelo.
echo.
pause
exit /b 1
