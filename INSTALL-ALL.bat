@echo off
chcp 65001 >nul
REM NAWAT Studio / NAWAT Code - INSTALL ALL : installe tout et construit la version complete pour Windows.
setlocal
set ROOT=%~dp0
cd /d "%ROOT%"
echo ==^> NAWAT INSTALL ALL

where node >nul 2>nul || (
  echo Node.js absent - installation via winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements || (echo Installez Node.js 20+ depuis https://nodejs.org puis relancez. & pause & exit /b 1)
)
where ffmpeg >nul 2>nul || winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
where ollama >nul 2>nul || winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
where python >nul 2>nul && python -m pip install --user fastapi uvicorn flask requests numpy pandas ollama ffmpeg-python

echo ==^> Bibliotheques JavaScript (FFmpeg, Express...)
call npm install || goto :error
call npm install --no-save fluent-ffmpeg ffmpeg-static ffprobe-static express cors multer ws axios ollama

echo ==^> Construction complete (web + bureau + ZIP)
call "%ROOT%BUILD-ALL.bat" || goto :error

echo ==^> Raccourci sur le bureau
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\NAWAT Studio.lnk');$s.TargetPath='%ROOT%distributions';$s.Save()"

echo Termine ! Le programme est dans: %ROOT%distributions
pause
goto :eof
:error
echo ECHEC. Relancez INSTALL-ALL.bat apres avoir verifie votre connexion.
pause
exit /b 1
