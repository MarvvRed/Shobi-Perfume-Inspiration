@echo off
setlocal
cd /d "%~dp0\.."

echo [%date% %time%] Starting Shobi Master local capture...
git pull --ff-only
if errorlevel 1 exit /b 10

py -3 -m pip install -q -r local-agent\requirements.txt
if errorlevel 1 exit /b 11

py -3 local-agent\shobi_local_capture.py --push
set CODE=%ERRORLEVEL%
echo [%date% %time%] Finished with exit code %CODE%.
exit /b %CODE%
