@echo off
setlocal
set "PROFILE=%USERPROFILE%\.shobi-fragrantica-edge-profile"
set "URL=https://www.fragrantica.com/"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  echo Microsoft Edge non trovato.
  pause
  exit /b 1
)
echo Profilo Fragrantica: %PROFILE%
echo Remote debugging: http://127.0.0.1:9222
start "Shobi Fragrantica Edge" "%EDGE%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "%URL%"
endlocal
