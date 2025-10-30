# Backend - Sistema WhatsApp + OpenAI Assistants

Backend Node.js com Express, Baileys (WhatsApp Web API) e Socket.io para gerenciamento de múltiplas instâncias WhatsApp com IA.

## 🚀 Tecnologias

- **Node.js** (v18+)
- **Express** - Framework web
- **Baileys** - WhatsApp Web API
- **Socket.io** - Comunicação em tempo real
- **OpenAI Assistants API** - IA para respostas automáticas
- **QRCode** - Geração de QR codes

## 📦 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
```

## 🏃 Executar

```bash
# Desenvolvimento
npm run dev

# Produção
npm start

# Limpar sessões antigas
npm run clean
```

## 📡 Endpoints da API

### WhatsApp

- `POST /api/whatsapp/qr/:sessionId` - Gerar QR Code
- `POST /api/whatsapp/logout/:sessionId` - Desconectar sessão
- `GET /api/whatsapp/status/:sessionId` - Status da conexão
- `POST /api/whatsapp/config/:sessionId` - Configurar assistente AI

### Status

- `GET /api/status` - Status do servidor
- `GET /api/sessions` - Listar todas as sessões ativas

## 🔌 Eventos Socket.io

### Cliente → Servidor

- `generate-qr` - Solicitar QR Code
- `logout` - Desconectar sessão
- `force-reconnect` - Forçar reconexão

### Servidor → Cliente

- `qr` - QR Code gerado
- `qr-scanned` - QR Code escaneado
- `connecting` - Conectando...
- `connected` - Conectado com sucesso
- `user-info` - Informações do usuário
- `already-connected` - Já estava conectado
- `logged-out` - Desconectado
- `qr-error` - Erro ao gerar QR
- `connection-error` - Erro de conexão
- `disconnected` - Desconectado
- `reconnection-failed` - Falha na reconexão

## 📁 Estrutura

```
backend/
├── src/
│   ├── server.js              # Servidor principal
│   ├── config/
│   │   └── logger.js          # Config Logger
│   ├── services/
│   │   ├── whatsappService.js # Serviço Baileys
│   │   ├── openaiService.js   # Serviço OpenAI
│   │   └── geminiService.js   # Serviço Gemini
│   ├── controllers/
│   │   └── whatsappController.js
│   ├── routes/
│   │   └── whatsappRoutes.js
│   └── utils/
│       └── cleanSessions.js   # Limpeza de sessões
├── sessions/                  # Sessões WhatsApp (auto-criado)
├── package.json
└── .env
```

## 🔒 Segurança

- CORS configurado para frontend específico
- Sessões isoladas por ID

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se a porta 3001 está livre
- Confirme que o FRONTEND_URL está correto

### Sessão não conecta
- Limpe as sessões antigas: `npm run clean`
- Reinicie o servidor

## 📝 Notas

- Cada instância WhatsApp usa uma sessão separada
- As sessões são salvas localmente em `./sessions/`
- O sistema detecta automaticamente reconexões
- Suporta múltiplas instâncias simultâneas

## 🚀 Deploy

### Railway / Render

```bash
# Build command
npm install

# Start command
npm start
```

### AWS EC2

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clonar e instalar
git clone <seu-repo>
cd backend
npm install
npm start
```

## 📄 Licença

MIT

