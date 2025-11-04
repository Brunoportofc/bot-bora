# 🚀 Deploy Bot-Bora Backend - AWS EC2

Guia completo para fazer deploy do bot-bora-backend no AWS EC2.

---

## 📋 Pré-requisitos

### No seu computador (Windows):
- ✅ Git Bash ou PowerShell
- ✅ SSH configurado
- ✅ Chave SSH: `C:\Users\Porto\.ssh\clinica-ai.pem`

### No servidor AWS EC2:
- ✅ Ubuntu 24.04 LTS
- ✅ Node.js 18+ instalado
- ✅ PM2 instalado globalmente (`npm install -g pm2`)
- ✅ Nginx instalado
- ✅ Certbot instalado (para SSL)

### DNS:
- ✅ Registro A: `bora.factoriasolution.com` → `54.153.91.186`

---

## 🎯 Deploy Automático (Recomendado)

### 1. Execute o script de deploy

No PowerShell, na pasta `backend`:

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\deploy-bora-aws.bat
```

### 2. O script vai:
1. ✅ Compactar o código (excluindo `node_modules` e `sessions`)
2. ✅ Fazer upload via SCP para o servidor
3. ✅ Criar/atualizar o diretório no servidor
4. ✅ Preservar `.env` e `sessions` existentes
5. ✅ Instalar dependências
6. ✅ Configurar PM2
7. ✅ Configurar Nginx
8. ✅ Instalar SSL (opcional)

### 3. Resultado esperado:
```
=== Deploy Concluido! ===

Status do servico:
┌────┬────────────────────┬──────────┬──────┬───────────┐
│ id │ name               │ status   │ cpu  │ memory    │
├────┼────────────────────┼──────────┼──────┼───────────┤
│ 12 │ bot-bora-backend   │ online   │ 0%   │ 100mb     │
└────┴────────────────────┴──────────┴──────┴───────────┘
```

---

## 🔧 Configuração Manual (se necessário)

### 1. Editar .env no servidor

```bash
ssh -i "C:\Users\Porto\.ssh\clinica-ai.pem" ubuntu@ec2-54-153-91-186.us-west-1.compute.amazonaws.com

cd ~/bot-bora-backend
nano .env
```

Conteúdo do `.env`:
```env
PORT=3003
FRONTEND_URL=https://bot-bora.vercel.app
GEMINI_API_KEY=sua_chave_gemini_aqui
SESSIONS_PATH=./sessions
NODE_ENV=production
```

Salve: `CTRL + X` → `Y` → `Enter`

### 2. Reiniciar o serviço

```bash
pm2 restart bot-bora-backend
pm2 logs bot-bora-backend
```

---

## 🧪 Testar o Deploy

### 1. Testar localmente no servidor:
```bash
curl http://localhost:3003/api/status
```

### 2. Testar via domínio:
```bash
curl https://bora.factoriasolution.com/api/status
```

### 3. Testar no navegador:
```
https://bora.factoriasolution.com/api/status
```

**Resposta esperada:**
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2025-10-31T...",
  "sessions": []
}
```

---

## 📊 Comandos Úteis

### PM2:
```bash
# Ver status
pm2 status

# Ver logs
pm2 logs bot-bora-backend

# Ver logs em tempo real
pm2 logs bot-bora-backend --lines 100

# Reiniciar
pm2 restart bot-bora-backend

# Parar
pm2 stop bot-bora-backend

# Deletar
pm2 delete bot-bora-backend

# Monitorar recursos
pm2 monit
```

### Nginx:
```bash
# Testar configuração
sudo nginx -t

# Recarregar configuração
sudo systemctl reload nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver logs de erro
sudo tail -f /var/log/nginx/error.log

# Ver logs de acesso
sudo tail -f /var/log/nginx/access.log
```

### SSL:
```bash
# Instalar/renovar SSL
sudo certbot --nginx -d bora.factoriasolution.com

# Testar renovação
sudo certbot renew --dry-run

# Renovar manualmente
sudo certbot renew
```

---

## 🔄 Atualizações Rápidas

Para atualizar apenas o código (sem reconfigurar tudo):

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\deploy-bora-aws.bat
```

O script automaticamente:
- ✅ Preserva o `.env` atual
- ✅ Preserva as sessões do WhatsApp
- ✅ Atualiza apenas o código fonte
- ✅ Reinicia o serviço

---

## 🐛 Troubleshooting

### Problema: "PM2 não está rodando"
```bash
pm2 start src/server.js --name "bot-bora-backend"
pm2 save
pm2 startup
```

### Problema: "Porta 3003 já em uso"
```bash
# Ver o que está usando a porta
sudo lsof -i :3003

# Ou
sudo netstat -tuln | grep 3003
```

### Problema: "Nginx retorna 502 Bad Gateway"
```bash
# Verificar se o backend está rodando
curl http://localhost:3003/api/status

# Ver logs do backend
pm2 logs bot-bora-backend

# Ver logs do Nginx
sudo tail -f /var/log/nginx/error.log
```

### Problema: "DNS não resolve"
```bash
# Verificar DNS
nslookup bora.factoriasolution.com

# Limpar cache DNS (Windows)
ipconfig /flushdns
```

### Problema: "SSL não instala"
```bash
# Verificar se o domínio está resolvendo
nslookup bora.factoriasolution.com

# Verificar portas abertas no Security Group AWS
# Porta 80 (HTTP) e 443 (HTTPS) devem estar abertas
```

---

## 📦 Estrutura no Servidor

```
~/bot-bora-backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.js
├── sessions/          # Sessões do WhatsApp (persistente)
├── temp/              # Arquivos temporários
├── node_modules/
├── package.json
├── package-lock.json
├── .env              # Configurações (persistente)
└── README.md
```

---

## 🔐 Segurança

### Variáveis sensíveis (nunca commitar):
- ❌ `.env` → **NUNCA no Git**
- ❌ `GEMINI_API_KEY` → **Privada**
- ❌ `sessions/` → **Credenciais do WhatsApp**

### Backup automático:
O script cria backups automáticos em:
```
~/backup-bot-bora-YYYYMMDD-HHMMSS/
```

---

## 🌐 URLs e Portas

| Serviço | Porta Local | URL Pública |
|---------|------------|-------------|
| bot-bora-backend | 3003 | https://bora.factoriasolution.com |
| clinica-backend | 3001 | ? |
| whatsapp-backend | 3002 | ? |

---

## 📞 Suporte

- **SSH:** `ssh -i "C:\Users\Porto\.ssh\clinica-ai.pem" ubuntu@ec2-54-153-91-186.us-west-1.compute.amazonaws.com`
- **Logs PM2:** `pm2 logs bot-bora-backend`
- **Status:** `pm2 status`

---

**🎉 Deploy concluído com sucesso!**

