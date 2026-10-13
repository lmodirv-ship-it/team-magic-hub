@echo off
REM NAWAT Studio - always-on launcher (bridge 8788 + factory 8789), auto-restart + start at Windows logon.
REM Merge rule "add, never remove": updates are ADDED/merged on every start; nothing is ever deleted.
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
if "%NAWAT_UPDATE_URL%"=="" set "NAWAT_UPDATE_URL=https://hn-ai.site/downloads/nawat-studio-latest.zip"

if /i "%1"=="run" goto run
if /i "%1"=="merge" (call :merge & exit /b 0)

echo [NAWAT] Registering autostart task "NAWAT-Studio-Always"...
schtasks /Create /F /SC ONLOGON /RL LIMITED /TN "NAWAT-Studio-Always" /TR "cmd /c \"\"%ROOT%START-STUDIO-ALWAYS.bat\" run\"" >nul
if errorlevel 1 (echo [NAWAT] Could not register task. Run as administrator.) else (echo [NAWAT] Autostart enabled.)
start "NAWAT Studio" /min cmd /c ""%ROOT%START-STUDIO-ALWAYS.bat" run"
echo [NAWAT] Studio started in background. Bridge port saved in bridge-port.txt (8788 or next free).
exit /b 0

:merge
REM Sources: 1) ZIP from NAWAT_UPDATE_URL  2) any folder/zip dropped into "updates\"
set "STAMP=%DATE:/=-%_%TIME::=-%"
set "STAMP=%STAMP: =0%"
set "STAMP=%STAMP:,=-%"
set "INBOX=%TEMP%\nawat-update"
if not exist "updates" mkdir "updates"
if exist "%INBOX%" rmdir /s /q "%INBOX%"
mkdir "%INBOX%"
echo [NAWAT] Checking updates: %NAWAT_UPDATE_URL%
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 '%NAWAT_UPDATE_URL%' -OutFile '%INBOX%\latest.zip'; Expand-Archive -Force '%INBOX%\latest.zip' '%INBOX%\net' } catch { Write-Host '[NAWAT] Online update unavailable, continuing.' }" 2>nul
for %%Z in ("updates\*.zip") do powershell -NoProfile -Command "Expand-Archive -Force '%%~fZ' '%INBOX%\zip-%%~nZ'" 2>nul
for /d %%D in ("%INBOX%\*" "updates\*") do call :mergeone "%%~fD"
echo [NAWAT] Merge done. Overwritten files saved in backups\%STAMP% (nothing deleted).
exit /b 0

:mergeone
set "SRC=%~1"
REM If the archive has a single top folder, step into it.
if not exist "%SRC%\bridge" for /d %%S in ("%SRC%\*") do if exist "%%~fS\bridge" set "SRC=%%~fS"
echo [NAWAT] Merging %SRC%
REM 1) Back up any existing file that will be replaced (list-only pass -> copy originals).
for /f "tokens=*" %%F in ('robocopy "%SRC%" "%ROOT%." /E /XO /L /NJH /NJS /NDL /NC /NS /FP /XD node_modules .git backups updates /XF .env* *.local.json nawat.config.json bridge-config.local.json 2^>nul') do call :backup "%%F" "%SRC%"
REM 2) Add new files + update older ones. No /MIR, no /PURGE: local additions are never removed.
robocopy "%SRC%" "%ROOT%." /E /XO /R:1 /W:1 /NFL /NDL /NJH /NJS /XD node_modules .git backups updates /XF .env* *.local.json nawat.config.json bridge-config.local.json >nul
REM 3) Additive dependency install (adds missing packages, removes none).
if exist "bridge\package.json" (pushd bridge & call npm install --no-audit --no-fund --omit=dev >nul 2>nul & popd)
exit /b 0

:backup
set "F=%~1"
set "REL=%F:*%~2\=%"
if exist "%ROOT%%REL%" (
  for %%P in ("backups\%STAMP%\%REL%") do if not exist "%%~dpP" mkdir "%%~dpP"
  copy /y "%ROOT%%REL%" "backups\%STAMP%\%REL%" >nul
)
exit /b 0

:run
where node >nul 2>nul || (echo [NAWAT] Node.js not found. Run INSTALL-ALL.bat first. & pause & exit /b 1)
call :merge
if exist "deploy\factory\factory_server.py" (
  start "NAWAT Factory" /min cmd /c "for /l %%i in (0,0,1) do (python deploy\factory\factory_server.py & timeout /t 5 >nul)"
)
:loop
REM Pick a free port: NAWAT_PORT if set, else 8788, else next free (8790-8799). Old instance keeps its port.
set "BRIDGE_PORT="
for %%P in (%NAWAT_PORT% 8788 8790 8791 8792 8793 8794 8795 8796 8797 8798 8799) do if not defined BRIDGE_PORT (
  netstat -ano | findstr /r /c:":%%P .*LISTENING" >nul || set "BRIDGE_PORT=%%P"
)
if not defined BRIDGE_PORT set "BRIDGE_PORT=8800"
echo %BRIDGE_PORT%> "%ROOT%bridge-port.txt"
echo [NAWAT] Starting bridge on %BRIDGE_PORT%...  (http://127.0.0.1:%BRIDGE_PORT%)
node bridge\server.mjs
echo [NAWAT] Bridge stopped. Merging updates, restarting in 5 seconds...
timeout /t 5 >nul
call :merge
goto loop
