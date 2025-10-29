@echo off
echo.
echo ========================================
echo   REINICIANDO BACKEND COM TTS
echo ========================================
echo.

REM Parar processos Node.js
echo Parando servidor...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Ir para a pasta do backend
cd /d "%~dp0"

echo.
echo Iniciando servidor com Google Cloud TTS...
echo.

REM Iniciar o servidor
npm run dev

