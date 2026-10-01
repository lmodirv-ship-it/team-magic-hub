@echo off
REM NAWAT Studio - build des trois formats de distribution (Windows).
setlocal
set VERSION=1.0.0
set ROOT=%~dp0
set DESKTOP=%ROOT%distributions\nawat-studio-desktop
set OUT=%ROOT%distributions

echo ==^> 1/4 Installation des dependances
call npm install || goto :error

echo ==^> 2/4 Build de l'interface web (PWA incluse)
call npm run build || goto :error

echo ==^> 3/4 Build de l'application desktop
if not exist "%DESKTOP%\renderer" mkdir "%DESKTOP%\renderer"
xcopy /E /I /Y "%ROOT%dist" "%DESKTOP%\renderer" >nul
pushd "%DESKTOP%"
call npm install || goto :error
call npm run build:win || goto :error
popd

echo ==^> 4/4 Archive ZIP
powershell -NoProfile -Command ^
  "Compress-Archive -Force -Path '%ROOT%src','%ROOT%public','%ROOT%docs','%ROOT%electron','%ROOT%package.json','%ROOT%README.md' -DestinationPath '%OUT%\nawat-studio-v%VERSION%.zip'"

echo ==^> Sommes de controle
powershell -NoProfile -Command ^
  "Get-ChildItem -Recurse -Path '%OUT%' -Include *.zip,*.exe | Get-FileHash -Algorithm SHA256 | ForEach-Object { \"$($_.Hash)  $($_.Path)\" } | Set-Content '%OUT%\checksums.txt'"

echo Termine. Fichiers dans: %OUT%
goto :eof

:error
echo BUILD ECHOUE.
exit /b 1
