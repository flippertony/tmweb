@echo off
chcp 65001 >nul
title Jarvis
cd /d "%~dp0"
if not exist .venv (
  echo Prima esegui installa.bat
  pause
  exit /b 1
)
set PYTHONUTF8=1
call .venv\Scripts\activate.bat
python -m jarvis.server
pause
