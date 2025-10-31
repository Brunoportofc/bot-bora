import logger from '../config/logger.js';

class WhatsAppController {
  constructor(whatsappService) {
    this.whatsappService = whatsappService;
  }

  async generateQR(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const result = await this.whatsappService.generateQR(sessionId);
      
      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Erro ao gerar QR:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async logout(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const result = await this.whatsappService.logout(sessionId);
      
      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getStatus(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const status = await this.whatsappService.getSessionStatus(sessionId);
      
      return res.json({
        success: true,
        ...status
      });
    } catch (error) {
      logger.error('Erro ao obter status:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async saveConfig(req, res) {
    try {
      const { sessionId } = req.params;
      const { 
        name, 
        apiKey, 
        aiProvider, 
        assistantId, 
        model, 
        systemPrompt, 
        temperature, 
        enabled,
        ttsEnabled,
        ttsVoice
      } = req.body;

      logger.info('=== RECEBENDO CONFIGURAÇÃO ===');
      logger.info('SessionId:', sessionId);
      logger.info('Body recebido:', JSON.stringify(req.body, null, 2));
      logger.info('================================');

      if (!sessionId) {
        logger.error('Session ID não fornecido');
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      // API Key agora é opcional - se não fornecida, usará a do .env
      if (!apiKey && !process.env.GEMINI_API_KEY) {
        logger.error('API Key não fornecida e não há chave padrão no .env');
        return res.status(400).json({
          success: false,
          error: 'API Key é obrigatória (configure no .env ou forneça na configuração)'
        });
      }

      // Validar configurações baseadas no provedor
      if (aiProvider === 'openai' && !assistantId) {
        return res.status(400).json({
          success: false,
          error: 'Assistant ID é obrigatório para OpenAI'
        });
      }

      const result = this.whatsappService.setSessionConfig(sessionId, {
        name: name || `Instância ${sessionId}`,
        apiKey: apiKey || process.env.GEMINI_API_KEY, // Usa a chave fornecida ou a do .env
        aiProvider: aiProvider || 'gemini',
        assistantId,
        model: model || 'gemini-2.0-flash-exp',
        systemPrompt: systemPrompt || '',
        temperature: temperature !== undefined ? temperature : 1.5,
        ttsEnabled: ttsEnabled || false,
        ttsVoice: ttsVoice || 'Aoede',
        enabled
      });
      
      return res.json(result);
    } catch (error) {
      logger.error('Erro ao salvar configuração:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getConfig(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const config = this.whatsappService.getConfig(sessionId);
      
      return res.json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Erro ao obter configuração:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllSessions(req, res) {
    try {
      const sessions = this.whatsappService.getAllSessions();
      
      return res.json({
        success: true,
        sessions
      });
    } catch (error) {
      logger.error('Erro ao listar sessões:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async forceReconnect(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const result = await this.whatsappService.forceReconnect(sessionId);
      
      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      logger.error('Erro ao forçar reconexão:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async testAssistant(req, res) {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      const config = this.whatsappService.getConfig(sessionId);
      if (!config || !config.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'Configuração do assistente não encontrada'
        });
      }

      let response;
      const testMessage = message || 'Olá, este é um teste!';
      
      // Detectar provedor
      if (config.aiProvider === 'gemini' || !config.assistantId) {
        // Usar Gemini
        const { processMessageWithGemini } = await import('../services/geminiService.js');
        response = await processMessageWithGemini(
          testMessage,
          'test-user',
          config.apiKey,
          config.model || 'gemini-2.0-flash-exp',
          config.systemPrompt || '',
          config.temperature || 1.0
        );
      } else {
        // Usar OpenAI
        if (!config.assistantId) {
          return res.status(400).json({
            success: false,
            error: 'Assistant ID é obrigatório para OpenAI'
          });
        }
        const { processMessageWithAI } = await import('../services/openaiService.js');
        response = await processMessageWithAI(
          testMessage,
          'test-user',
          config.apiKey,
          config.assistantId
        );
      }

      return res.json({
        success: true,
        message: 'Teste realizado com sucesso',
        response,
        provider: config.aiProvider || 'gemini'
      });
    } catch (error) {
      logger.error('Erro ao testar assistente:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async testAudioTranscription(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Arquivo de áudio é obrigatório'
        });
      }

      const config = this.whatsappService.getConfig(sessionId);
      if (!config || !config.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API Key não configurada'
        });
      }

      // Importar o serviço OpenAI dinamicamente
      const { transcribeAudio } = await import('../services/openaiService.js');
      
      const transcription = await transcribeAudio(
        req.file.buffer,
        config.apiKey
      );

      return res.json({
        success: true,
        message: 'Transcrição realizada com sucesso',
        transcription
      });
    } catch (error) {
      logger.error('Erro ao testar transcrição:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async testImageAnalysis(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Arquivo de imagem é obrigatório'
        });
      }

      const config = this.whatsappService.getConfig(sessionId);
      if (!config || !config.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API Key não configurada'
        });
      }

      // Importar o serviço OpenAI dinamicamente
      const { analyzeImage } = await import('../services/openaiService.js');
      
      const analysis = await analyzeImage(
        req.file.buffer,
        config.apiKey
      );

      return res.json({
        success: true,
        message: 'Análise de imagem realizada com sucesso',
        analysis
      });
    } catch (error) {
      logger.error('Erro ao testar análise de imagem:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async testDocumentProcessing(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID é obrigatório'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Arquivo de documento é obrigatório'
        });
      }

      const config = this.whatsappService.getConfig(sessionId);
      if (!config || !config.apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API Key não configurada'
        });
      }

      // Importar o serviço OpenAI dinamicamente
      const { processDocument } = await import('../services/openaiService.js');
      
      const content = await processDocument(
        req.file.buffer,
        req.file.originalname || 'documento',
        config.apiKey
      );

      return res.json({
        success: true,
        message: 'Processamento de documento realizado com sucesso',
        content,
        filename: req.file.originalname
      });
    } catch (error) {
      logger.error('Erro ao testar processamento de documento:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default WhatsAppController;

