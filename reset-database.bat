@echo off
setlocal
cd /d %~dp0

echo ==========================================
echo Resetando banco SQLite local

echo ==========================================

if exist backend\prisma\dev.db del /f /q backend\prisma\dev.db
if exist backend\prisma\dev.db-journal del /f /q backend\prisma\dev.db-journal

echo Banco removido.
echo Execute setup-windows.bat novamente para recriar.
pause
