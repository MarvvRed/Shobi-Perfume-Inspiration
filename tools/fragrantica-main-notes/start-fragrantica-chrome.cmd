@echo off
setlocal
set "PROFILE=%USERPROFILE%\.shobi-fragrantica-chrome-profile"
set "URL=https://www.fragrantica.com/"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Chrome non trovato.
  echo Installa Google Chrome oppure modifica questo file con il percorso corretto.
  pause
  exit /b 1
)
echo Profilo Fragrantica: %PROFILE%
echo Remote debugging: http://127.0.0.1:9222
start "Shobi Fragrantica Chrome" "%CHROME%" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check "%URL%"
endlocal
