@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   Deploy Bot-Bora Backend - AWS EC2 (v2)
echo ==================================================
echo.

set SSH_KEY=C:\Users\Porto\.ssh\clinica-ai.pem
set SERVER_USER=ubuntu
set SERVER_HOST=ec2-54-153-91-186.us-west-1.compute.amazonaws.com
set PM2_NAME=bot-bora-backend
set PORT=3003
set DOMAIN=bora.factoriasolution.com

echo Configuracoes:
echo   SSH Key: %SSH_KEY%
echo   Servidor: %SERVER_USER%@%SERVER_HOST%
echo   PM2 Name: %PM2_NAME%
echo   Porta: %PORT%
echo   Dominio: %DOMAIN%
echo.

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

set /p CONFIRM="Deseja continuar? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Cancelado.
    pause
    exit /b 0
)

echo.
echo ================================================
echo   PASSO 1: Preparando arquivos
echo ================================================
echo.

set TEMP_DIR=%TEMP%\bot-bora-deploy
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo Copiando arquivos...
xcopy /E /I /Y /Q src "%TEMP_DIR%\src" >nul
copy /Y package.json "%TEMP_DIR%\" >nul
copy /Y package-lock.json "%TEMP_DIR%\" >nul

if exist ".env" (
    copy /Y .env "%TEMP_DIR%\" >nul
    echo ✅ .env incluido
) else (
    echo ⚠️ .env nao encontrado
)

if exist "nodemon.json" copy /Y nodemon.json "%TEMP_DIR%\" >nul

powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%TEMP%\bot-bora-deploy.zip' -Force"

if not exist "%TEMP%\bot-bora-deploy.zip" (
    echo [ERRO] Falha ao compactar
    pause
    exit /b 1
)

for %%A in ("%TEMP%\bot-bora-deploy.zip") do set SIZE=%%~zA
set /a SIZE_MB=%SIZE% / 1048576
echo ✅ Pacote criado: %SIZE_MB% MB
echo.

echo ================================================
echo   PASSO 2: Upload para o servidor
echo ================================================
echo.

scp -i "%SSH_KEY%" "%TEMP%\bot-bora-deploy.zip" %SERVER_USER%@%SERVER_HOST%:/tmp/bot-bora-deploy.zip

if errorlevel 1 (
    echo [ERRO] Falha no upload
    rmdir /s /q "%TEMP_DIR%"
    del /q "%TEMP%\bot-bora-deploy.zip"
    pause
    exit /b 1
)

echo ✅ Upload concluido
rmdir /s /q "%TEMP_DIR%"
del /q "%TEMP%\bot-bora-deploy.zip"
echo.

echo ================================================
echo   PASSO 3: Instalando no servidor
echo ================================================
echo.

echo [1/9] Verificando estrutura...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "ls -lah ~ | grep backend || echo 'Nenhum backend encontrado'"

echo.
echo [2/9] Criando backup (se existir)...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "if [ -d ~/bot-bora-backend ]; then BACKUP_DATE=$(date +%%Y%%m%%d-%%H%%M%%S); cp -r ~/bot-bora-backend ~/backup-bot-bora-$BACKUP_DATE; echo 'Backup criado'; else echo 'Primeira instalacao'; fi"

echo.
echo [3/9] Parando PM2 (se existir)...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "pm2 stop %PM2_NAME% 2>/dev/null || echo 'PM2 nao estava rodando'; pm2 delete %PM2_NAME% 2>/dev/null || true"

echo.
echo [4/9] Preparando diretorio...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "mkdir -p ~/bot-bora-backend && echo 'Diretorio criado' && cd ~/bot-bora-backend && pwd"

echo.
echo [5/9] Salvando .env e sessions...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && if [ -f .env ]; then cp .env /tmp/bot-bora-env-backup; echo '.env salvo'; fi && if [ -d sessions ]; then cp -r sessions /tmp/bot-bora-sessions-backup; echo 'Sessions salvas'; fi"

echo.
echo [6/9] Limpando arquivos antigos...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && rm -rf src package*.json node_modules && echo 'Arquivos antigos removidos'"

echo.
echo [7/9] Descompactando novos arquivos...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && unzip -o /tmp/bot-bora-deploy.zip && rm /tmp/bot-bora-deploy.zip && echo 'Arquivos descompactados' && ls -lah"

echo.
echo [8/9] Restaurando .env e sessions...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && if [ -f /tmp/bot-bora-env-backup ]; then mv /tmp/bot-bora-env-backup .env; echo '.env restaurado'; elif [ -f .env ]; then echo '.env enviado do PC'; cat .env; else echo 'ERRO: .env nao encontrado!'; fi && if [ -d /tmp/bot-bora-sessions-backup ]; then mv /tmp/bot-bora-sessions-backup sessions; else mkdir -p sessions; fi"

echo.
echo [9/9] Instalando dependencias...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && npm install --production"

if errorlevel 1 (
    echo [ERRO] Falha na instalacao
    pause
    exit /b 1
)

echo.
echo ================================================
echo   PASSO 4: Iniciando PM2
echo ================================================
echo.

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "cd ~/bot-bora-backend && pm2 start src/server.js --name '%PM2_NAME%' && pm2 save"

echo.
echo ================================================
echo   PASSO 5: Configurando Nginx
echo ================================================
echo.

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "if [ ! -f /etc/nginx/sites-available/bora ]; then echo 'Criando configuracao Nginx...'; sudo bash -c 'cat > /etc/nginx/sites-available/bora' << 'NGINXEOF'
server {
    listen 80;
    server_name %DOMAIN%;
    location / {
        proxy_pass http://localhost:%PORT%;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /socket.io/ {
        proxy_pass http://localhost:%PORT%/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXEOF
sudo ln -sf /etc/nginx/sites-available/bora /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx && echo 'Nginx configurado'; else echo 'Nginx ja configurado'; fi"

echo.
echo ================================================
echo   VERIFICACAO FINAL
echo ================================================
echo.

echo Status do PM2:
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "pm2 status"

echo.
echo Teste da API:
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "sleep 2 && curl -s http://localhost:%PORT%/api/status || echo 'API ainda nao respondeu'"

echo.
echo ==================================================
echo   DEPLOY CONCLUIDO!
echo ==================================================
echo.
echo Informacoes:
echo   URL: http://%DOMAIN% (ou https:// se SSL estiver configurado)
echo   Porta: %PORT%
echo   PM2: %PM2_NAME%
echo.
echo Proximos passos:
echo   1. Verificar logs: ssh e depois pm2 logs %PM2_NAME%
echo   2. Instalar SSL: sudo certbot --nginx -d %DOMAIN%
echo   3. Testar API: curl http://localhost:%PORT%/api/status
echo.
pause

