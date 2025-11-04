# 📁 Estrutura do Servidor AWS EC2

Documentação da organização dos backends no servidor.

---

## 🗂️ Estrutura Atual do Servidor

```
/home/ubuntu/
├── clinica-backend/           # Backend da clínica (porta 3001)
│   ├── src/
│   ├── node_modules/
│   ├── package.json
│   ├── .env
│   └── sessions/
│
├── whatsapp-ai-backend/       # Backend WhatsApp (porta 3002)
│   ├── src/
│   ├── node_modules/
│   ├── package.json
│   ├── .env
│   └── sessions/
│
├── bot-bora-backend/          # Bot Bora Backend (porta 3003) ✨
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   ├── sessions/              # Sessões WhatsApp (persistente)
│   ├── temp/                  # Arquivos temporários
│   ├── node_modules/
│   ├── package.json
│   ├── package-lock.json
│   └── .env                   # Configurações (não versionado)
│
├── backup-bot-bora-YYYYMMDD-HHMMSS/  # Backups automáticos
│
└── [outros arquivos]
```

---

## 🚪 Portas em Uso

| Serviço | Porta | Domínio | PM2 Name |
|---------|-------|---------|----------|
| Clínica Backend | 3001 | ? | `clinica-backend` |
| WhatsApp Backend | 3002 | ? | `whatsapp-backend` |
| **Bot Bora Backend** | **3003** | **bora.factoriasolution.com** | **`bot-bora-backend`** |

---

## 📋 Configurações do Nginx

### Arquivo: `/etc/nginx/sites-available/bora`

```nginx
server {
    listen 80;
    server_name bora.factoriasolution.com;

    location / {
        proxy_pass http://localhost:3003;
        # ... configurações de proxy
    }

    location /socket.io/ {
        proxy_pass http://localhost:3003/socket.io/;
        # ... configurações de WebSocket
    }
}
```

**Link simbólico:** `/etc/nginx/sites-enabled/bora` → `/etc/nginx/sites-available/bora`

---

## 🔧 Comandos Úteis por Serviço

### Bot Bora Backend (porta 3003)

```bash
# Ver logs
pm2 logs bot-bora-backend

# Reiniciar
pm2 restart bot-bora-backend

# Parar
pm2 stop bot-bora-backend

# Status
pm2 status bot-bora-backend

# Acessar pasta
cd ~/bot-bora-backend

# Editar .env
nano ~/bot-bora-backend/.env

# Ver sessões WhatsApp
ls -lah ~/bot-bora-backend/sessions/

# Testar API
curl http://localhost:3003/api/status
curl https://bora.factoriasolution.com/api/status
```

### Todos os serviços

```bash
# Ver todos os processos PM2
pm2 status

# Ver uso de recursos
pm2 monit

# Reiniciar todos
pm2 restart all

# Ver logs de todos
pm2 logs

# Salvar configuração PM2
pm2 save
```

---

## 🔐 Variáveis de Ambiente (.env)

### Bot Bora Backend

```env
PORT=3003
FRONTEND_URL=https://bot-bora.vercel.app
GEMINI_API_KEY=sua_chave_aqui
SESSIONS_PATH=./sessions
NODE_ENV=production
```

**⚠️ IMPORTANTE:** O arquivo `.env` é **preservado** durante atualizações!

---

## 📦 Backups Automáticos

Toda vez que você roda o deploy, um backup é criado automaticamente:

```bash
# Listar backups
ls -lah ~ | grep backup-bot-bora

# Restaurar de um backup
cp -r ~/backup-bot-bora-20251031-123456/* ~/bot-bora-backend/
pm2 restart bot-bora-backend
```

---

## 🔄 Processo de Deploy

### 1. Deploy Completo (primeira vez)
```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\deploy-bora-aws.bat
```

**O que acontece:**
1. Cria `~/bot-bora-backend/` se não existir
2. Faz backup se já existir
3. Para o PM2 se estiver rodando
4. Limpa arquivos antigos (preserva `.env` e `sessions`)
5. Descompacta novos arquivos
6. Instala dependências
7. Inicia PM2
8. Configura Nginx
9. Oferece instalar SSL

### 2. Atualização Rápida
```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\atualizar-bora.bat
```

**O que acontece:**
1. Upload apenas do código
2. Preserva `.env` e `sessions`
3. Reinstala dependências
4. Reinicia PM2

---

## 🧪 Testes

### Teste Local (no servidor)
```bash
curl http://localhost:3003/api/status
```

### Teste Externo (domínio)
```bash
curl https://bora.factoriasolution.com/api/status
```

### Resposta Esperada
```json
{
  "success": true,
  "status": "online",
  "timestamp": "2025-10-31T...",
  "sessions": []
}
```

---

## 🔍 Diagnóstico

### Verificar Estrutura
```bash
# Ver todos os backends
ls -lah ~ | grep backend

# Ver conteúdo do bot-bora-backend
ls -lah ~/bot-bora-backend/

# Ver tamanho das pastas
du -sh ~/bot-bora-backend/*
```

### Verificar Processos
```bash
# PM2
pm2 status

# Node.js rodando
ps aux | grep node

# Portas em uso
sudo netstat -tuln | grep -E ':(3001|3002|3003)'
```

### Verificar Nginx
```bash
# Testar configuração
sudo nginx -t

# Status
sudo systemctl status nginx

# Sites habilitados
ls -lah /etc/nginx/sites-enabled/

# Logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 🚨 Troubleshooting

### Problema: "Pasta bot-bora-backend não existe"
```bash
mkdir -p ~/bot-bora-backend
cd ~/bot-bora-backend
```

### Problema: "PM2 não encontrado"
```bash
npm install -g pm2
pm2 update
```

### Problema: "Nginx não configurado"
```bash
# Criar configuração manualmente
sudo nano /etc/nginx/sites-available/bora

# Ativar
sudo ln -sf /etc/nginx/sites-available/bora /etc/nginx/sites-enabled/

# Testar e reiniciar
sudo nginx -t
sudo systemctl reload nginx
```

### Problema: "Porta 3003 já em uso"
```bash
# Ver o que está usando
sudo lsof -i :3003

# Parar processo
pm2 stop bot-bora-backend
```

---

## 📊 Monitoramento

### Uso de Recursos
```bash
# CPU e Memória
pm2 monit

# Disco
df -h

# Memória do sistema
free -h

# Processos mais pesados
top
```

### Logs em Tempo Real
```bash
# Bot Bora
pm2 logs bot-bora-backend --lines 100

# Todos os serviços
pm2 logs --lines 50

# Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## 🔐 Segurança

### Arquivos Sensíveis (nunca commitar)
- ❌ `.env` → Contém API keys
- ❌ `sessions/` → Credenciais do WhatsApp
- ❌ `node_modules/` → Desnecessário no Git

### Backups
- ✅ Backup automático antes de cada deploy
- ✅ Formato: `backup-bot-bora-YYYYMMDD-HHMMSS`
- ✅ `.env` e `sessions` preservados

---

## 📞 Acesso SSH

```bash
ssh -i "C:\Users\Porto\.ssh\clinica-ai.pem" ubuntu@ec2-54-153-91-186.us-west-1.compute.amazonaws.com
```

**Atalho:**
```bash
cd ~/bot-bora-backend
pm2 logs bot-bora-backend
```

---

**Última atualização:** 31/10/2025

