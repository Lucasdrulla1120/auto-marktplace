@echo off
setlocal
cd /d %~dp0

echo ==========================================
echo Auto Marketplace V3.2 Operacional - Executando
echo ==========================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado.
  pause
  exit /b 1
)

start "Auto Marketplace API" cmd /k "cd /d %~dp0backend && node src\index.js"
timeout /t 2 >nul
start "Auto Marketplace Web" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Janelas abertas.
echo Frontend: http://127.0.0.1:3000
echo API:      http://127.0.0.1:4000/api/health
echo.
pause
