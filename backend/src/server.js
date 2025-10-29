import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './config/logger.js';
import WhatsAppService from './services/whatsappService.js';
import WhatsAppController from './controllers/whatsappController.js';
import createWhatsAppRoutes from './routes/whatsappRoutes.js';


dotenv.config();

const app = express();
const httpServer = createServer(app);

// Função para verificar origem permitida
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Permitir requisições sem origin (ex: Postman)
  
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'https://clinicaia-adm.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);
  
  // Verificar se está na lista ou é domínio Vercel
  return allowedOrigins.includes(origin) || 
         origin.endsWith('.vercel.app') || 
         origin.includes('vercel.app');
};

// Configuração do Socket.io com CORS
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Origem bloqueada por CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  allowEIO3: true
});

// Middlewares CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn(`Origem bloqueada por CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging de requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Inicializar serviços
const whatsappService = new WhatsAppService(io);
const whatsappController = new WhatsAppController(whatsappService);

// Rotas
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp AI Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    sessions: whatsappService.getAllSessions()
  });
});

// Rota para verificar sessões ativas (compatibilidade com frontend)
app.get('/sessions/active', (req, res) => {
  const sessions = whatsappService.getAllSessions();
  const activeSessions = sessions.filter(s => s.connected);
  
  res.json({
    success: true,
    count: activeSessions.length,
    sessions: activeSessions.map(s => ({
      sessionId: s.sessionId,
      connected: s.connected,
      user: s.user || null
    }))
  });
});

// Rotas do WhatsApp
app.use('/api/whatsapp', createWhatsAppRoutes(whatsappController));

// Socket.io event handlers
io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}`);

  // Gerar QR Code
  socket.on('generate-qr', async (data) => {
    try {
      logger.info(`Recebido evento generate-qr:`, data);
      const { sessionId } = data;
      
      if (!sessionId) {
        throw new Error('SessionId não fornecido');
      }
      
      logger.info(`Solicitação de QR para sessão: ${sessionId}`);
      const result = await whatsappService.generateQR(sessionId);
      logger.info(`Resultado da geração de QR:`, result);
    } catch (error) {
      logger.error('Erro ao gerar QR via socket:', error);
      socket.emit('qr-error', {
        sessionId: data?.sessionId || 'unknown',
        error: error.message
      });
    }
  });

  // Logout
  socket.on('logout', async (data) => {
    try {
      const { sessionId } = data;
      logger.info(`Logout solicitado para sessão: ${sessionId}`);
      await whatsappService.logout(sessionId);
    } catch (error) {
      logger.error('Erro ao fazer logout via socket:', error);
      socket.emit('logout-error', {
        sessionId: data.sessionId,
        error: error.message
      });
    }
  });

  // Forçar reconexão
  socket.on('force-reconnect', async (data) => {
    try {
      const { sessionId } = data;
      logger.info(`Reconexão forçada para sessão: ${sessionId}`);
      await whatsappService.forceReconnect(sessionId);
    } catch (error) {
      logger.error('Erro ao reconectar via socket:', error);
      socket.emit('reconnection-failed', {
        sessionId: data.sessionId,
        error: error.message
      });
    }
  });

  // Salvar configuração
  socket.on('save-config', async (data) => {
    try {
      const { sessionId, config } = data;
      logger.info(`Salvando configuração para sessão: ${sessionId}`);
      await whatsappService.saveConfig(sessionId, config);
      socket.emit('config-updated', {
        sessionId,
        success: true
      });
    } catch (error) {
      logger.error('Erro ao salvar config via socket:', error);
      socket.emit('config-error', {
        sessionId: data.sessionId,
        error: error.message
      });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Erro não tratado:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('');
  console.log('   WhatsApp AI Backend Server');
  console.log('');
  console.log(`   Servidor rodando em: http://localhost:${PORT}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);

  console.log('   Socket.io: Ativo');
  console.log('   CORS: Vercel habilitado (.vercel.app)');
  console.log('');
  console.log('   Pronto para receber conexoes WhatsApp!');
  console.log('');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Encerrando servidor gracefully...');
  
  // Fechar todas as sessões
  const sessions = whatsappService.getAllSessions();
  for (const session of sessions) {
    try {
      await whatsappService.logout(session.sessionId);
    } catch (error) {
      logger.error(`Erro ao fechar sessão ${session.sessionId}:`, error);
    }
  }

  httpServer.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
});

export default app;

