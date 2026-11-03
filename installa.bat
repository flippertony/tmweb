@echo off
chcp 65001 >nul
title Installazione di Jarvis
cd /d "%~dp0"
echo.
echo  ===  Installazione di Jarvis  ===
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo  [!] Python non trovato.
  echo      Installalo da https://www.python.org/downloads/ e spunta "Add python.exe to PATH".
  echo      Poi esegui di nuovo questo file.
  pause
  exit /b 1
)

if not exist .venv (
  echo  - Creo l'ambiente Python...
  python -m venv .venv || goto errore
)
echo  - Installo le librerie (qualche minuto)...
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip -q
pip install -r requirements.txt -q || goto errore

if not exist .env (
  copy .env.example .env >nul
  echo  - Creato il file .env: ora si apre, incolla la tua ANTHROPIC_API_KEY e salva.
  notepad .env
)
if not exist config\siti.yaml (
  copy config\siti.esempio.yaml config\siti.yaml >nul
  echo  - Creato config\siti.yaml: inserisci i siti dei tuoi clienti quando vuoi.
)

echo.
echo  Installazione completata!
echo  - Avvia Jarvis con:            avvia_jarvis.bat
echo  - Collega Gmail e Drive con:   collega_google.bat   (vedi README)
echo.
pause
exit /b 0

:errore
echo.
echo  [!] Qualcosa e' andato storto. Copia il messaggio qui sopra e chiedi aiuto.
pause
exit /b 1
