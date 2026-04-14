@echo off
setlocal
cd /d %~dp0

echo ==========================================
echo Auto Marketplace V3.2 Operacional - Setup
echo ==========================================

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instale o Node.js LTS e execute este arquivo novamente.
  pause
  exit /b 1
)

if not exist backend\.env (
  copy backend\.env.example backend\.env >nul
  echo Arquivo backend\.env criado a partir do exemplo.
)

echo.
echo [1/5] Instalando dependencias do backend...
cd /d %~dp0backend
call npm install
if errorlevel 1 goto fail

echo.
echo [2/5] Gerando cliente Prisma...
call npx prisma generate
if errorlevel 1 goto fail

echo.
echo [3/5] Criando banco SQLite...
call npx prisma db push
if errorlevel 1 goto fail

echo.
echo [4/5] Populando dados iniciais...
call npm run seed
if errorlevel 1 goto fail

echo.
echo [5/5] Instalando dependencias do frontend...
cd /d %~dp0frontend
call npm install
if errorlevel 1 goto fail

echo.
echo ==========================================
echo Setup concluido com sucesso.
echo Frontend: http://127.0.0.1:3000
echo API:      http://127.0.0.1:4000/api/health
echo ==========================================
pause
exit /b 0

:fail
echo.
echo O setup falhou. Veja a mensagem acima.
pause
exit /b 1
