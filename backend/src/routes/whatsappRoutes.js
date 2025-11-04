import express from 'express';
import multer from 'multer';

// Configurar multer para upload de arquivos em memória
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB (limite da OpenAI)
  }
});

const createWhatsAppRoutes = (whatsappController) => {
  const router = express.Router();

  // Gerar QR Code para nova sessão
  router.post('/qr/:sessionId', (req, res) => whatsappController.generateQR(req, res));

  // Desconectar sessão
  router.post('/logout/:sessionId', (req, res) => whatsappController.logout(req, res));

  // Obter status da sessão
  router.get('/status/:sessionId', (req, res) => whatsappController.getStatus(req, res));

  // Salvar configuração do assistente
  router.post('/config/:sessionId', (req, res) => whatsappController.saveConfig(req, res));

  // Obter configuração
  router.get('/config/:sessionId', (req, res) => whatsappController.getConfig(req, res));

  // Listar todas as sessões
  router.get('/sessions', (req, res) => whatsappController.getAllSessions(req, res));

  // Forçar reconexão
  router.post('/reconnect/:sessionId', (req, res) => whatsappController.forceReconnect(req, res));

  // Testar assistente OpenAI
  router.post('/test-assistant/:sessionId', (req, res) => whatsappController.testAssistant(req, res));

  // Testar transcrição de áudio
  router.post('/test-audio/:sessionId', upload.single('audio'), (req, res) => whatsappController.testAudioTranscription(req, res));

  // Testar análise de imagem
  router.post('/test-image/:sessionId', upload.single('image'), (req, res) => whatsappController.testImageAnalysis(req, res));

  // Testar processamento de documento
  router.post('/test-document/:sessionId', upload.single('document'), (req, res) => whatsappController.testDocumentProcessing(req, res));

  return router;
};

export default createWhatsAppRoutes;

