@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   Atualizacao Rapida - Bot-Bora Backend
echo ==================================================
echo.
echo Este script atualiza APENAS o codigo (preserva .env e sessions)
echo.

set SSH_KEY=C:\Users\Porto\.ssh\clinica-ai.pem
set SERVER_USER=ubuntu
set SERVER_HOST=ec2-54-153-91-186.us-west-1.compute.amazonaws.com
set PM2_NAME=bot-bora-backend

if not exist "%SSH_KEY%" (
    echo [ERRO] Chave SSH nao encontrada
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERRO] Execute na raiz do backend
    pause
    exit /b 1
)

set /p CONFIRM="Continuar com a atualizacao? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Cancelado.
    pause
    exit /b 0
)

echo.
echo [1/4] Preparando arquivos...

set TEMP_DIR=%TEMP%\bot-bora-update
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

xcopy /E /I /Y /Q src "%TEMP_DIR%\src" >nul
copy /Y package.json "%TEMP_DIR%\" >nul
copy /Y package-lock.json "%TEMP_DIR%\" >nul

powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%TEMP%\bot-bora-update.zip' -Force"

echo.
echo [2/4] Fazendo upload...

scp -i "%SSH_KEY%" "%TEMP%\bot-bora-update.zip" %SERVER_USER%@%SERVER_HOST%:/tmp/bot-bora-update.zip

if errorlevel 1 (
    echo [ERRO] Falha no upload
    pause
    exit /b 1
)

rmdir /s /q "%TEMP_DIR%"
del /q "%TEMP%\bot-bora-update.zip"

echo.
echo [3/4] Atualizando servidor...

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "bash -s" << 'EOF'
cd ~/bot-bora-backend
rm -rf src package*.json node_modules
unzip -o /tmp/bot-bora-update.zip
rm /tmp/bot-bora-update.zip
npm install --production
pm2 restart bot-bora-backend
EOF

echo.
echo [4/4] Verificando...

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "pm2 status && sleep 2 && curl -s http://localhost:3003/api/status"

echo.
echo ==================================================
echo   Atualizacao Concluida!
echo ==================================================
echo.
echo Ver logs: pm2 logs %PM2_NAME%
echo.
pause

