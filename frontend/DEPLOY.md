# 🚀 Deploy do Frontend - Bot Bora

## 📦 Deploy na Vercel

### 1. **Instalar Vercel CLI (opcional)**
```bash
npm install -g vercel
```

### 2. **Deploy via Vercel Dashboard**

1. Acesse: https://vercel.com
2. Clique em **"Add New"** > **"Project"**
3. Importe o repositório do GitHub
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` (se o projeto estiver em monorepo)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 3. **Variáveis de Ambiente**

Adicione esta variável de ambiente na Vercel:

```
VITE_API_URL=https://bora.factoriasolutions.com
```

**Como adicionar:**
1. No projeto na Vercel, vá em **Settings** > **Environment Variables**
2. Adicione:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://bora.factoriasolutions.com`
   - **Environment:** Production, Preview, Development

### 4. **Redesploy**

Após adicionar a variável de ambiente:
1. Vá em **Deployments**
2. Clique nos **três pontinhos** do último deploy
3. Clique em **"Redeploy"**

---

## 🔧 Desenvolvimento Local

### **Opção 1: Usar API de produção**
```bash
cd frontend
npm install
npm run dev
```

O frontend vai usar automaticamente: `https://bora.factoriasolutions.com`

### **Opção 2: Usar API local**

Crie um arquivo `.env.local`:
```env
VITE_API_URL=http://localhost:3003
```

Depois rode:
```bash
npm run dev
```

---

## 🌐 URLs

| Ambiente | Frontend | Backend |
|----------|----------|---------|
| **Produção** | `https://seu-app.vercel.app` | `https://bora.factoriasolutions.com` |
| **Local** | `http://localhost:5173` | `http://localhost:3003` |

---

## 🧪 Testar Conexão

Após o deploy, teste:

1. **API Backend:**
   ```
   https://bora.factoriasolutions.com/api/status
   ```
   Deve retornar:
   ```json
   {"success":true,"status":"online","sessions":[]}
   ```

2. **Frontend:**
   - Acesse o app na Vercel
   - Verifique se conecta no backend
   - Teste gerar QR Code

---

## 🔒 CORS

O backend já está configurado para aceitar requisições da Vercel:
- Todos os domínios `*.vercel.app` são permitidos
- Domínio específico em `FRONTEND_URL` é permitido

---

## 🐛 Troubleshooting

### **Erro de CORS**
- Verifique se `FRONTEND_URL` no backend está correto
- Verifique se o domínio da Vercel está sendo detectado

### **API não conecta**
- Verifique se `VITE_API_URL` está configurado na Vercel
- Teste a API diretamente: `https://bora.factoriasolutions.com/api/status`
- Verifique logs do backend: `pm2 logs bot-bora-backend`

### **Socket.IO não conecta**
- Verifique se o Nginx está configurado corretamente para `/socket.io/`
- Teste com: `https://bora.factoriasolutions.com/socket.io/`

---

## 📝 Checklist de Deploy

- [ ] Backend rodando em `https://bora.factoriasolutions.com`
- [ ] API testada e funcionando
- [ ] SSL instalado (HTTPS)
- [ ] Frontend commitado no Git
- [ ] Projeto criado na Vercel
- [ ] Variável `VITE_API_URL` configurada
- [ ] Deploy realizado
- [ ] Teste de conexão frontend → backend
- [ ] Teste de geração de QR Code

---

**🎉 Deploy concluído!**

