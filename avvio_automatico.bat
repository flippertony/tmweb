@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Crea un collegamento nella cartella Esecuzione automatica di Windows:
rem Jarvis partira' da solo (ridotto a icona) a ogni accensione del PC.
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Jarvis.lnk');" ^
  "$s.TargetPath='%~dp0avvia_jarvis.bat'; $s.WorkingDirectory='%~dp0'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo [!] Non sono riuscito a creare il collegamento.
) else (
  echo Fatto: Jarvis partira' automaticamente all'avvio di Windows.
  echo Per disattivarlo: Win+R, scrivi shell:startup, cancella "Jarvis".
)
pause
