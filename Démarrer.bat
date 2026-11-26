@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe ou Windows ne le trouve pas.
  echo Installe Node.js LTS depuis https://nodejs.org, puis reouvre cette fenetre.
  pause
  exit /b 1
)
start "" http://localhost:3000
node server.js
pause
