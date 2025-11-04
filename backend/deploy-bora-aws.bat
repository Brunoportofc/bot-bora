@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   Deploy Bot-Bora Backend - AWS EC2
echo ==================================================
echo.

set SSH_KEY=C:\Users\Porto\.ssh\clinica-ai.pem
set SERVER_USER=ubuntu
set SERVER_HOST=ec2-54-153-91-186.us-west-1.compute.amazonaws.com
set SERVER_PATH=~/bot-bora-backend
set PM2_NAME=bot-bora-backend
set PORT=3003
set DOMAIN=bora.factoriasolution.com

echo Configuracoes:
echo   SSH Key: %SSH_KEY%
echo   Servidor: %SERVER_USER%@%SERVER_HOST%
echo   Path: %SERVER_PATH%
echo   PM2 Name: %PM2_NAME%
echo   Porta: %PORT%
echo   Dominio: %DOMAIN%
echo.

if not exist "%SSH_KEY%" (
    echo [ERRO] Chave SSH nao encontrada: %SSH_KEY%
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERRO] package.json nao encontrado. Execute na raiz do backend.
    pause
    exit /b 1
)

echo.
echo IMPORTANTE: Este script vai fazer o deploy do bot-bora-backend!
echo.
set /p CONFIRM="Deseja continuar? (S/N): "
if /i not "%CONFIRM%"=="S" (
    echo Deploy cancelado.
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

echo Copiando arquivos (excluindo node_modules e sessions)...

xcopy /E /I /Y /Q src "%TEMP_DIR%\src" >nul
copy /Y package.json "%TEMP_DIR%\" >nul
copy /Y package-lock.json "%TEMP_DIR%\" >nul

if exist ".env" (
    copy /Y .env "%TEMP_DIR%\" >nul
    echo ✅ .env incluido no pacote
) else (
    echo ⚠️ AVISO: .env nao encontrado localmente
)

if exist "nodemon.json" copy /Y nodemon.json "%TEMP_DIR%\" >nul
if exist "README.md" copy /Y README.md "%TEMP_DIR%\" >nul

echo Arquivos copiados!
echo.

echo Compactando arquivos...
powershell -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%TEMP%\bot-bora-deploy.zip' -Force"

if not exist "%TEMP%\bot-bora-deploy.zip" (
    echo [ERRO] Falha ao compactar arquivos
    pause
    exit /b 1
)

for %%A in ("%TEMP%\bot-bora-deploy.zip") do set SIZE=%%~zA
set /a SIZE_MB=%SIZE% / 1048576
echo Arquivo criado: %TEMP%\bot-bora-deploy.zip (%SIZE_MB% MB)
echo.

echo ================================================
echo   PASSO 2: Upload para o servidor
echo ================================================
echo.
echo Fazendo upload... (pode demorar alguns minutos)
echo.

scp -i "%SSH_KEY%" "%TEMP%\bot-bora-deploy.zip" %SERVER_USER%@%SERVER_HOST%:/tmp/bot-bora-deploy.zip

if errorlevel 1 (
    echo [ERRO] Falha no upload
    pause
    exit /b 1
)

echo Upload concluido!
echo.

rmdir /s /q "%TEMP_DIR%"
del /q "%TEMP%\bot-bora-deploy.zip"

echo ================================================
echo   PASSO 3: Configurando servidor
echo ================================================
echo.
echo Criando script de instalacao...
echo.

set DEPLOY_SCRIPT=%TEMP%\deploy-bora-script.sh

echo #!/bin/bash > "%DEPLOY_SCRIPT%"
echo set -e >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [1/9] Verificando estrutura do servidor ===" >> "%DEPLOY_SCRIPT%"
echo echo "Diretorio home: $(pwd)" >> "%DEPLOY_SCRIPT%"
echo echo "Estrutura atual:" >> "%DEPLOY_SCRIPT%"
echo ls -lah ~ ^| grep -E '^d' ^|^| echo "Nenhum diretorio encontrado" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [2/9] Criando backup (se existir) ===" >> "%DEPLOY_SCRIPT%"
echo if [ -d ~/bot-bora-backend ]; then >> "%DEPLOY_SCRIPT%"
echo     BACKUP_DATE=$(date +%%Y%%m%%d-%%H%%M%%S) >> "%DEPLOY_SCRIPT%"
echo     cp -r ~/bot-bora-backend ~/backup-bot-bora-$BACKUP_DATE >> "%DEPLOY_SCRIPT%"
echo     echo "✅ Backup criado: ~/backup-bot-bora-$BACKUP_DATE" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     echo "✅ Primeira instalacao - sem backup necessario" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [3/9] Parando PM2 (se existir) ===" >> "%DEPLOY_SCRIPT%"
echo if pm2 list ^| grep -q "bot-bora-backend"; then >> "%DEPLOY_SCRIPT%"
echo     pm2 stop bot-bora-backend ^|^| true >> "%DEPLOY_SCRIPT%"
echo     pm2 delete bot-bora-backend ^|^| true >> "%DEPLOY_SCRIPT%"
echo     echo "✅ PM2 parado e removido" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     echo "✅ PM2 nao estava rodando" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [4/9] Preparando diretorio dedicado ===" >> "%DEPLOY_SCRIPT%"
echo if [ ! -d ~/bot-bora-backend ]; then >> "%DEPLOY_SCRIPT%"
echo     mkdir -p ~/bot-bora-backend >> "%DEPLOY_SCRIPT%"
echo     echo "✅ Diretorio ~/bot-bora-backend criado" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     echo "✅ Diretorio ~/bot-bora-backend ja existe" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo cd ~/bot-bora-backend >> "%DEPLOY_SCRIPT%"
echo echo "✅ Trabalhando em: $(pwd)" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo if [ -f .env ]; then >> "%DEPLOY_SCRIPT%"
echo     cp .env /tmp/bot-bora-env-backup >> "%DEPLOY_SCRIPT%"
echo     echo ".env salvo temporariamente" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo if [ -d sessions ]; then >> "%DEPLOY_SCRIPT%"
echo     cp -r sessions /tmp/bot-bora-sessions-backup >> "%DEPLOY_SCRIPT%"
echo     echo "Sessions salvas temporariamente" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo rm -rf src package*.json node_modules >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [5/9] Descompactando novos arquivos ===" >> "%DEPLOY_SCRIPT%"
echo unzip -o /tmp/bot-bora-deploy.zip >> "%DEPLOY_SCRIPT%"
echo rm /tmp/bot-bora-deploy.zip >> "%DEPLOY_SCRIPT%"
echo echo "✅ Arquivos descompactados" >> "%DEPLOY_SCRIPT%"
echo ls -lah >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [6/9] Configurando .env ===" >> "%DEPLOY_SCRIPT%"
echo if [ -f /tmp/bot-bora-env-backup ]; then >> "%DEPLOY_SCRIPT%"
echo     mv /tmp/bot-bora-env-backup .env >> "%DEPLOY_SCRIPT%"
echo     echo "✅ .env restaurado do backup" >> "%DEPLOY_SCRIPT%"
echo elif [ -f .env ]; then >> "%DEPLOY_SCRIPT%"
echo     echo "✅ .env enviado do PC local" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     echo "❌ .env nao encontrado!" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo if [ -d /tmp/bot-bora-sessions-backup ]; then >> "%DEPLOY_SCRIPT%"
echo     mv /tmp/bot-bora-sessions-backup sessions >> "%DEPLOY_SCRIPT%"
echo     echo "Sessions restauradas" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     mkdir -p sessions >> "%DEPLOY_SCRIPT%"
echo     echo "Pasta sessions criada" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [7/9] Instalando dependencias ===" >> "%DEPLOY_SCRIPT%"
echo npm install --production >> "%DEPLOY_SCRIPT%"
echo echo "✅ Dependencias instaladas" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [8/9] Iniciando PM2 ===" >> "%DEPLOY_SCRIPT%"
echo pm2 start src/server.js --name "bot-bora-backend" >> "%DEPLOY_SCRIPT%"
echo pm2 save >> "%DEPLOY_SCRIPT%"
echo echo "✅ PM2 iniciado e salvo" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "=== [9/9] Configurando Nginx ===" >> "%DEPLOY_SCRIPT%"
echo if [ ! -f /etc/nginx/sites-available/bora ]; then >> "%DEPLOY_SCRIPT%"
echo     echo "Criando configuracao do Nginx..." >> "%DEPLOY_SCRIPT%"
echo     sudo tee /etc/nginx/sites-available/bora ^> /dev/null ^<^< 'NGINXEOF' >> "%DEPLOY_SCRIPT%"
echo server { >> "%DEPLOY_SCRIPT%"
echo     listen 80; >> "%DEPLOY_SCRIPT%"
echo     server_name bora.factoriasolution.com; >> "%DEPLOY_SCRIPT%"
echo     location / { >> "%DEPLOY_SCRIPT%"
echo         proxy_pass http://localhost:3003; >> "%DEPLOY_SCRIPT%"
echo         proxy_http_version 1.1; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Upgrade $http_upgrade; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Connection 'upgrade'; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Host $host; >> "%DEPLOY_SCRIPT%"
echo         proxy_cache_bypass $http_upgrade; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header X-Real-IP $remote_addr; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header X-Forwarded-Proto $scheme; >> "%DEPLOY_SCRIPT%"
echo     } >> "%DEPLOY_SCRIPT%"
echo     location /socket.io/ { >> "%DEPLOY_SCRIPT%"
echo         proxy_pass http://localhost:3003/socket.io/; >> "%DEPLOY_SCRIPT%"
echo         proxy_http_version 1.1; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Upgrade $http_upgrade; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Connection "upgrade"; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header Host $host; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header X-Real-IP $remote_addr; >> "%DEPLOY_SCRIPT%"
echo         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; >> "%DEPLOY_SCRIPT%"
echo     } >> "%DEPLOY_SCRIPT%"
echo } >> "%DEPLOY_SCRIPT%"
echo NGINXEOF >> "%DEPLOY_SCRIPT%"
echo     sudo ln -sf /etc/nginx/sites-available/bora /etc/nginx/sites-enabled/ >> "%DEPLOY_SCRIPT%"
echo     sudo nginx -t ^&^& sudo systemctl reload nginx >> "%DEPLOY_SCRIPT%"
echo     echo "Nginx configurado" >> "%DEPLOY_SCRIPT%"
echo else >> "%DEPLOY_SCRIPT%"
echo     echo "Nginx ja configurado" >> "%DEPLOY_SCRIPT%"
echo fi >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo. >> "%DEPLOY_SCRIPT%"
echo echo "==========================================" >> "%DEPLOY_SCRIPT%"
echo echo "  DEPLOY CONCLUIDO!" >> "%DEPLOY_SCRIPT%"
echo echo "==========================================" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo pm2 status >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"
echo curl -s http://localhost:3003/api/status ^|^| echo "API ainda nao respondeu" >> "%DEPLOY_SCRIPT%"
echo echo "" >> "%DEPLOY_SCRIPT%"

echo Enviando script para o servidor...
scp -i "%SSH_KEY%" "%DEPLOY_SCRIPT%" %SERVER_USER%@%SERVER_HOST%:/tmp/deploy-bora.sh

if errorlevel 1 (
    echo [ERRO] Falha no envio do script
    del "%DEPLOY_SCRIPT%"
    pause
    exit /b 1
)

echo.
echo Executando script no servidor...
ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "bash /tmp/deploy-bora.sh && rm /tmp/deploy-bora.sh"

del "%DEPLOY_SCRIPT%"

if errorlevel 1 (
    echo.
    echo [ERRO] Falha na configuracao do servidor
    pause
    exit /b 1
)

echo.
echo ================================================
echo   PASSO 4: Instalando SSL (HTTPS)
echo ================================================
echo.
echo Deseja instalar o certificado SSL agora? (S/N)
set /p SSL_CONFIRM="Resposta: "

if /i "%SSL_CONFIRM%"=="S" (
    echo.
    echo Instalando SSL com Certbot...
    ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "sudo certbot --nginx -d %DOMAIN% --non-interactive --agree-tos --email contato@factoriasolution.com || echo 'Certbot falhou ou ja instalado'"
    echo.
)

echo.
echo ==================================================
echo   DEPLOY CONCLUIDO COM SUCESSO!
echo ==================================================
echo.
echo Informacoes importantes:
echo.
echo   Backend URL: https://%DOMAIN%
echo   Porta local: %PORT%
echo   PM2 Name: %PM2_NAME%
echo.
echo Proximos passos:
echo.
echo 1. Verifique o status:
echo    ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST%
echo    pm2 status
echo    pm2 logs %PM2_NAME%
echo.
echo 2. Edite o .env se necessario:
echo    nano ~/bot-bora-backend/.env
echo    pm2 restart %PM2_NAME%
echo.
echo 3. Teste a API:
echo    https://%DOMAIN%/api/status
echo.
echo 4. Configure o frontend na Vercel:
echo    VITE_API_URL=https://%DOMAIN%
echo.
echo Comandos uteis:
echo   pm2 status
echo   pm2 logs %PM2_NAME%
echo   pm2 restart %PM2_NAME%
echo   pm2 stop %PM2_NAME%
echo   sudo nginx -t
echo   sudo systemctl reload nginx
echo.
pause

