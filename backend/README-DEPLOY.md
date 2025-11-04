# 🚀 Scripts de Deploy - Bot Bora Backend

Guia rápido dos scripts automatizados para deploy no AWS EC2.

---

## 📦 Scripts Disponíveis

### 1. `deploy-bora-aws.bat` - Deploy Completo ⭐
**Uso:** Primeira instalação ou reinstalação completa

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\deploy-bora-aws.bat
```

**O que faz:**
- ✅ Cria pasta `~/bot-bora-backend` no servidor
- ✅ Backup automático (se já existir)
- ✅ Upload do código
- ✅ Preserva `.env` e `sessions`
- ✅ Instala dependências
- ✅ Configura PM2 (porta 3003)
- ✅ Configura Nginx
- ✅ Oferece instalar SSL

**Tempo:** ~3-5 minutos

---

### 2. `atualizar-bora.bat` - Atualização Rápida 🚀
**Uso:** Atualizar apenas o código

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\atualizar-bora.bat
```

**O que faz:**
- ✅ Upload apenas do código novo
- ✅ Preserva `.env` e `sessions`
- ✅ Reinstala dependências
- ✅ Reinicia PM2

**Tempo:** ~1-2 minutos

---

### 3. `verificar-status.bat` - Diagnóstico Completo 🔍
**Uso:** Ver status de tudo

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\verificar-status.bat
```

**O que mostra:**
- ✅ Status do PM2
- ✅ Status do Nginx
- ✅ Teste da API (local + externo)
- ✅ Portas em uso
- ✅ Uso de disco e memória
- ✅ Logs recentes

**Tempo:** ~10 segundos

---

### 4. `verificar-estrutura.bat` - Estrutura do Servidor 📁
**Uso:** Ver organização dos backends

```powershell
cd C:\Users\Porto\Desktop\bot-bora\backend
.\verificar-estrutura.bat
```

**O que mostra:**
- ✅ Todos os diretórios de backends
- ✅ Conteúdo de `~/bot-bora-backend`
- ✅ Processos PM2
- ✅ Configurações Nginx
- ✅ Portas em uso
- ✅ Resumo completo

**Tempo:** ~5 segundos

---

## 🎯 Fluxo de Trabalho Recomendado

### Primeira Vez (Deploy Completo)
```powershell
# 1. Verificar estrutura do servidor (opcional)
.\verificar-estrutura.bat

# 2. Fazer deploy completo
.\deploy-bora-aws.bat

# 3. Verificar se está funcionando
.\verificar-status.bat
```

### Atualizações de Código
```powershell
# 1. Atualizar código
.\atualizar-bora.bat

# 2. Verificar status
.\verificar-status.bat
```

### Diagnóstico de Problemas
```powershell
# Ver status geral
.\verificar-status.bat

# Ver estrutura
.\verificar-estrutura.bat

# Conectar via SSH para detalhes
ssh -i "C:\Users\Porto\.ssh\clinica-ai.pem" ubuntu@ec2-54-153-91-186.us-west-1.compute.amazonaws.com
```

---

## 📋 Checklist Antes do Deploy

### Pré-requisitos
- [ ] Chave SSH em: `C:\Users\Porto\.ssh\clinica-ai.pem`
- [ ] DNS configurado: `bora.factoriasolution.com` → `54.153.91.186`
- [ ] Nova API Key do Gemini gerada
- [ ] Security Group AWS com portas 80 e 443 abertas

### Configurações
- [ ] `.env` local atualizado (não será enviado, mas serve de referência)
- [ ] `package.json` com dependências corretas

---

## 🗂️ Estrutura no Servidor

Após o deploy, você terá:

```
/home/ubuntu/
└── bot-bora-backend/          ✨ Nova pasta dedicada
    ├── src/                   # Código fonte
    ├── sessions/              # Sessões WhatsApp (persistente)
    ├── temp/                  # Arquivos temporários
    ├── node_modules/          # Dependências
    ├── .env                   # Configurações (persistente)
    ├── package.json
    └── package-lock.json
```

---

## 🔧 Comandos Úteis no Servidor

### PM2
```bash
pm2 status                      # Ver status
pm2 logs bot-bora-backend       # Ver logs
pm2 restart bot-bora-backend    # Reiniciar
pm2 stop bot-bora-backend       # Parar
pm2 monit                       # Monitorar recursos
```

### Nginx
```bash
sudo nginx -t                   # Testar configuração
sudo systemctl reload nginx     # Recarregar
sudo tail -f /var/log/nginx/error.log  # Ver erros
```

### Testes
```bash
curl http://localhost:3003/api/status              # Local
curl https://bora.factoriasolution.com/api/status  # Externo
```

---

## 🐛 Troubleshooting

### Script não executa
```powershell
# Permitir execução de scripts (PowerShell Admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro de conexão SSH
```powershell
# Verificar chave SSH
dir C:\Users\Porto\.ssh\clinica-ai.pem

# Conectar manualmente
ssh -i "C:\Users\Porto\.ssh\clinica-ai.pem" ubuntu@ec2-54-153-91-186.us-west-1.compute.amazonaws.com
```

### PM2 não inicia
```bash
# No servidor
pm2 delete bot-bora-backend
pm2 start ~/bot-bora-backend/src/server.js --name "bot-bora-backend"
pm2 save
```

### Nginx erro 502
```bash
# Verificar se backend está rodando
curl http://localhost:3003/api/status

# Ver logs
pm2 logs bot-bora-backend
sudo tail -f /var/log/nginx/error.log
```

---

## 📞 URLs Importantes

| Serviço | URL |
|---------|-----|
| **API Backend** | https://bora.factoriasolution.com |
| **Status Endpoint** | https://bora.factoriasolution.com/api/status |
| **Frontend Vercel** | https://bot-bora.vercel.app |

---

## 🔐 Segurança

### Arquivos que NUNCA devem estar no Git:
- ❌ `.env` → API keys sensíveis
- ❌ `sessions/` → Credenciais WhatsApp
- ❌ `node_modules/` → Desnecessário
- ❌ Arquivos `.pem` → Chaves SSH

### Backups Automáticos
Cada deploy cria um backup em:
```
~/backup-bot-bora-YYYYMMDD-HHMMSS/
```

---

## 📚 Documentação Adicional

- [`DEPLOY-BORA.md`](./DEPLOY-BORA.md) - Guia completo de deploy
- [`ESTRUTURA-SERVIDOR.md`](./ESTRUTURA-SERVIDOR.md) - Estrutura detalhada do servidor
- [`README.md`](./README.md) - Documentação do projeto

---

## ✅ Checklist Pós-Deploy

Após executar `deploy-bora-aws.bat`:

- [ ] PM2 mostra status "online"
- [ ] API responde em `http://localhost:3003/api/status`
- [ ] Nginx configurado
- [ ] SSL instalado (HTTPS)
- [ ] API responde em `https://bora.factoriasolution.com/api/status`
- [ ] Frontend atualizado com `VITE_API_URL=https://bora.factoriasolution.com`
- [ ] Deploy do frontend na Vercel

---

**🎉 Pronto para fazer o deploy!**

Execute: `.\deploy-bora-aws.bat`

