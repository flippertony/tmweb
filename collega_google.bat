@echo off
chcp 65001 >nul
title Collega Google a Jarvis
cd /d "%~dp0"
if not exist config\google_credentials.json (
  echo  [!] Manca config\google_credentials.json
  echo      Segui la sezione "Collegare Gmail e Drive" del README per scaricarlo.
  pause
  exit /b 1
)
set PYTHONUTF8=1
call .venv\Scripts\activate.bat
echo Si aprira' il browser: accedi con il tuo account Google e autorizza Jarvis.
python -m jarvis.google_auth
echo Riavvia Jarvis per usare Gmail e Drive.
pause
