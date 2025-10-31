@echo off
chcp 65001 >nul
echo.
echo ==================================================
echo   Verificacao de Estrutura do Servidor
echo ==================================================
echo.

set SSH_KEY=C:\Users\Porto\.ssh\clinica-ai.pem
set SERVER_USER=ubuntu
set SERVER_HOST=ec2-54-153-91-186.us-west-1.compute.amazonaws.com

echo Conectando ao servidor...
echo.

ssh -i "%SSH_KEY%" %SERVER_USER%@%SERVER_HOST% "bash -s" << 'EOF'
echo "=========================================="
echo "  ESTRUTURA DO SERVIDOR AWS EC2"
echo "=========================================="
echo ""

echo "📁 [1/6] Diretorios principais:"
echo ""
ls -lah ~ | grep -E '^d' | grep -v '^\.$' | grep -v '^\.\.$'
echo ""

echo "📊 [2/6] Uso de disco:"
echo ""
df -h | grep -E '(Filesystem|/$)'
echo ""

echo "📦 [3/6] Conteudo de ~/bot-bora-backend:"
echo ""
if [ -d ~/bot-bora-backend ]; then
    echo "✅ Diretorio existe"
    ls -lah ~/bot-bora-backend/
    echo ""
    echo "Tamanho total:"
    du -sh ~/bot-bora-backend/
else
    echo "❌ Diretorio NAO existe"
    echo "Execute o deploy primeiro: .\deploy-bora-aws.bat"
fi
echo ""

echo "🔧 [4/6] Processos PM2:"
echo ""
pm2 status
echo ""

echo "🌐 [5/6] Configuracoes Nginx:"
echo ""
if [ -f /etc/nginx/sites-enabled/bora ]; then
    echo "✅ Nginx configurado para bora.factoriasolution.com"
    echo "Arquivo: /etc/nginx/sites-enabled/bora"
else
    echo "❌ Nginx NAO configurado"
fi
echo ""

echo "🚪 [6/6] Portas em uso:"
echo ""
sudo netstat -tuln | grep -E ':(3001|3002|3003|80|443)' | grep LISTEN || echo "Nenhuma porta encontrada"
echo ""

echo "=========================================="
echo "  RESUMO"
echo "=========================================="
echo ""
echo "Backends instalados:"
[ -d ~/clinica-backend ] && echo "  ✅ clinica-backend (porta 3001)" || echo "  ❌ clinica-backend"
[ -d ~/whatsapp-ai-backend ] && echo "  ✅ whatsapp-ai-backend (porta 3002)" || echo "  ❌ whatsapp-ai-backend"
[ -d ~/bot-bora-backend ] && echo "  ✅ bot-bora-backend (porta 3003)" || echo "  ❌ bot-bora-backend"
echo ""
echo "PM2 rodando:"
pm2 list | grep -c online || echo "  0 processos"
echo ""
echo "=========================================="
EOF

echo.
echo Verificacao concluida!
echo.
pause

