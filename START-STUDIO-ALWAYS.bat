@echo off
REM NAWAT Studio - always-on launcher (bridge 8788 + factory 8789), auto-restart + start at Windows logon.
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

if /i "%1"=="run" goto run

echo [NAWAT] Registering autostart task "NAWAT-Studio-Always"...
schtasks /Create /F /SC ONLOGON /RL LIMITED /TN "NAWAT-Studio-Always" /TR "cmd /c \"\"%ROOT%START-STUDIO-ALWAYS.bat\" run\"" >nul
if errorlevel 1 (echo [NAWAT] Could not register task. Run as administrator.) else (echo [NAWAT] Autostart enabled.)
start "NAWAT Studio" /min cmd /c ""%ROOT%START-STUDIO-ALWAYS.bat" run"
echo [NAWAT] Studio started in background. Bridge: http://127.0.0.1:8788
exit /b 0

:run
where node >nul 2>nul || (echo [NAWAT] Node.js not found. Run INSTALL-ALL.bat first. & pause & exit /b 1)
if exist "deploy\factory\factory_server.py" (
  start "NAWAT Factory" /min cmd /c "for /l %%i in (0,0,1) do (python deploy\factory\factory_server.py & timeout /t 5 >nul)"
)
:loop
echo [NAWAT] Starting bridge on 8788...
node bridge\server.mjs
echo [NAWAT] Bridge stopped. Restarting in 5 seconds...
timeout /t 5 >nul
goto loop
