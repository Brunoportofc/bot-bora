@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   Verificacao de Status - Bot-Bora Backend
echo ==================================================
echo.

set SSH_KEY=C:\Users\Porto\.ssh\clinica-ai.pem
set SERVER_USER=ubuntu
set SERVER_HOST=ec2-54-153-91-186.us-west-1.compute.amazonaws.com
set PM2_NAME=bot-bora-backend
set DOMAIN=bora.factoriasolution.com

echo Conectando ao servidor...
echo.

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "bash -s" << 'EOF'
echo "=========================================="
echo "  STATUS DO SERVIDOR"
echo "=========================================="
echo ""

echo "[PM2 Status]"
pm2 status
echo ""

echo "[PM2 Info - bot-bora-backend]"
pm2 info bot-bora-backend 2>/dev/null || echo "bot-bora-backend nao encontrado no PM2"
echo ""

echo "[Teste Local - Porta 3003]"
curl -s http://localhost:3003/api/status | python3 -m json.tool 2>/dev/null || echo "API nao respondeu"
echo ""

echo "[Teste Externo - HTTPS]"
curl -s https://bora.factoriasolution.com/api/status | python3 -m json.tool 2>/dev/null || echo "Dominio nao respondeu"
echo ""

echo "[Nginx Status]"
sudo systemctl status nginx | grep Active
echo ""

echo "[Nginx Config - bora]"
if [ -f /etc/nginx/sites-enabled/bora ]; then
    echo "Configuracao existe: /etc/nginx/sites-enabled/bora"
    sudo nginx -t
else
    echo "Configuracao NAO encontrada!"
fi
echo ""

echo "[Portas em Uso]"
sudo netstat -tuln | grep -E ':(3001|3002|3003|80|443)' || echo "Nenhuma porta encontrada"
echo ""

echo "[Disco]"
df -h | grep -E '(Filesystem|/$)'
echo ""

echo "[Memoria]"
free -h
echo ""

echo "[Processos Node]"
ps aux | grep node | grep -v grep || echo "Nenhum processo Node encontrado"
echo ""

echo "[Logs recentes - PM2]"
pm2 logs bot-bora-backend --lines 10 --nostream 2>/dev/null || echo "Sem logs"
echo ""

echo "=========================================="
echo "  FIM DA VERIFICACAO"
echo "=========================================="
EOF

echo.
echo Verificacao concluida!
echo.
pause

