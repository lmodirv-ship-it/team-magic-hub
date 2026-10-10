; NAWAT Code — Windows installer (NSIS). Build: makensis -DSRC=<packaged dir> installer.nsi
Unicode true
!include "MUI2.nsh"
!ifndef SRC
  !define SRC "NAWAT Code-win32-x64"
!endif
Name "NAWAT Code"
OutFile "NAWAT-Code-Setup-1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\NAWAT Code"
InstallDirRegKey HKCU "Software\NAWAT Code" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\NAWAT Code.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\NAWAT Code.lnk" "$INSTDIR\NAWAT Code.exe"
  CreateDirectory "$SMPROGRAMS\NAWAT Code"
  CreateShortcut "$SMPROGRAMS\NAWAT Code\NAWAT Code.lnk" "$INSTDIR\NAWAT Code.exe"
  CreateShortcut "$SMPROGRAMS\NAWAT Code\Uninstall NAWAT Code.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\NAWAT Code" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code" "DisplayName" "NAWAT Code"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code" "DisplayIcon" "$INSTDIR\NAWAT Code.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code" "Publisher" "Groupe-HN"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code" "DisplayVersion" "1.0.0"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\NAWAT Code.lnk"
  RMDir /r "$SMPROGRAMS\NAWAT Code"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\NAWAT Code"
  DeleteRegKey HKCU "Software\NAWAT Code"
SectionEnd
