import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import logger, { baileysLogger } from '../config/logger.js';
import { 
  processMessageWithAI, 
  processAudioMessageWithAI,
  processImageMessageWithAI,
  processDocumentMessageWithAI 
} from './openaiService.js';
import {
  processMessageWithGemini,
  processAudioMessageWithGemini,
  processImageMessageWithGemini,
  processDocumentMessageWithGemini
} from './geminiService.js';
import {
  generateSpeech,
  shouldSendAsAudio,
  saveTempAudio,
  cleanupTempAudio
} from './ttsService.js';

const sessions = new Map();
const sessionConfigs = new Map();
const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';

// Buffer de mensagens por usuário (para agrupar mensagens antes de enviar ao Gemini)
const messageBuffers = new Map(); // { phoneNumber: { messages: [], timer: timeoutId } }
const BUFFER_TIMEOUT = 10000; // 10 segundos

// Garantir que o diretório de sessões existe
if (!fs.existsSync(SESSIONS_PATH)) {
  fs.mkdirSync(SESSIONS_PATH, { recursive: true });
}

class WhatsAppService {
  constructor(io) {
    this.io = io;
  }

  async createSession(sessionId) {
    if (sessions.has(sessionId)) {
      logger.info(`Sessão ${sessionId} já existe`);
      return sessions.get(sessionId);
    }

    const sessionPath = path.join(SESSIONS_PATH, sessionId);
    
    // Criar diretório da sessão se não existir
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      printQRInTerminal: false,
      logger: baileysLogger,
      browser: ['Chrome (Linux)', '', ''],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      getMessage: async (key) => {
        // Implementação básica do getMessage conforme documentação
        return { conversation: 'Mensagem não encontrada' };
      },
      shouldSyncHistoryMessage: () => false, // Desabilitar sync de histórico por enquanto
    });

    sessions.set(sessionId, { socket });

    // Event handlers
    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(sessionId, update);
    });

    socket.ev.on('messages.upsert', async ({ messages }) => {
      await this.handleIncomingMessages(sessionId, messages);
    });

    logger.info(`Sessao ${sessionId} criada com sucesso`);
    return { socket };
  }

  async handleConnectionUpdate(sessionId, update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataURL = await QRCode.toDataURL(qr);
        this.io.emit('qr', { sessionId, qr: qrDataURL });
        logger.info(`QR Code gerado para sessão ${sessionId}`);
      } catch (error) {
        logger.error(`Erro ao gerar QR Code para ${sessionId}:`, error);
        this.io.emit('qr-error', { sessionId, error: error.message });
      }
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      
      logger.info(`Conexão fechada para ${sessionId}. Status: ${statusCode}, Reconectar: ${shouldReconnect}`);

      // Limpar sessão atual
      sessions.delete(sessionId);

      if (shouldReconnect) {
        // Só emitir evento de desconexão se não for um erro temporário
        if (statusCode !== DisconnectReason.timedOut && statusCode !== DisconnectReason.connectionLost) {
          this.io.emit('disconnected', { sessionId, shouldReconnect: true });
        }
        
        // Aguardar antes de reconectar para evitar spam
        setTimeout(async () => {
          try {
            logger.info(`Tentando reconectar sessão ${sessionId}...`);
            await this.createSession(sessionId);
          } catch (error) {
            logger.error(`Erro ao reconectar ${sessionId}:`, error);
            this.io.emit('connection-error', { sessionId, error: error.message });
          }
        }, 3000);
      } else {
        sessionConfigs.delete(sessionId);
        this.io.emit('logged-out', { sessionId });
        
        // Limpar arquivos de sessão se logout
        const sessionPath = path.join(SESSIONS_PATH, sessionId);
        if (fs.existsSync(sessionPath)) {
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            logger.info(`Arquivos de sessão ${sessionId} removidos`);
          } catch (error) {
            logger.error(`Erro ao remover arquivos de sessão ${sessionId}:`, error);
          }
        }
      }
    } else if (connection === 'open') {
      logger.info(`Conexão estabelecida para ${sessionId}`);
      
      const session = sessions.get(sessionId);
      if (session?.socket) {
        const user = session.socket.user;
        this.io.emit('connected', { 
          sessionId,
          user: {
            id: user.id,
            name: user.name,
            phoneNumber: user.id.split(':')[0]
          }
        });
      }
    } else if (connection === 'connecting') {
      this.io.emit('connecting', { sessionId });
    }
  }

  async handleIncomingMessages(sessionId, messages) {
    const config = sessionConfigs.get(sessionId);
    
    for (const message of messages) {
      // Ignorar mensagens próprias e de status
      if (!message.message || message.key.fromMe || message.key.remoteJid === 'status@broadcast') {
        continue;
      }

      // 🚫 IGNORAR MENSAGENS DE GRUPOS - Só responder mensagens privadas
      if (message.key.remoteJid.endsWith('@g.us')) {
        logger.info(`⛔ Mensagem de grupo ignorada: ${message.key.remoteJid}`);
        continue;
      }

      const session = sessions.get(sessionId);
      if (!session?.socket) continue;

      try {
        // Verificar tipos de mensagem
        const audioMessage = message.message?.audioMessage;
        const imageMessage = message.message?.imageMessage;
        const documentMessage = message.message?.documentMessage;
        const messageText = this.extractMessageText(message);
        
        if (!audioMessage && !imageMessage && !documentMessage && !messageText) continue;

        // Se tem configuração de IA, processar com buffer para agrupar mensagens
        if (config?.apiKey) {
          const phoneNumber = message.key.remoteJid;
          
          // Se for mensagem de texto, usar buffer de 10 segundos
          if (messageText && !audioMessage && !imageMessage && !documentMessage) {
            await this.bufferTextMessage(sessionId, phoneNumber, messageText, config, session);
            continue; // Não processar imediatamente
          }
          
          // Para áudio, imagem e documentos, processar imediatamente (sem buffer)
          // Mas antes, enviar qualquer mensagem em buffer
          await this.flushMessageBuffer(sessionId, phoneNumber, config, session);
          
          // Agora processar mídia
          let aiResponse;
          let transcription = null;
          let imageAnalysis = null;
          let documentContent = null;
          
          // Detectar se está usando Gemini ou OpenAI
          const useGemini = config.aiProvider === 'gemini' || !config.assistantId;
          const useOpenAI = config.aiProvider === 'openai' && config.assistantId;

          if (audioMessage) {
            // Processar mensagem de áudio
            logger.info(`Mensagem de áudio recebida em ${sessionId}`, {
              from: message.key.remoteJid,
              messageId: message.key.id,
              audioInfo: {
                mimetype: audioMessage.mimetype,
                fileLength: audioMessage.fileLength,
                seconds: audioMessage.seconds,
                ptt: audioMessage.ptt
              }
            });
            
            try {
              // Verificar se a mensagem tem conteúdo de áudio válido
              if (!audioMessage.url && !audioMessage.directPath) {
                throw new Error('Mensagem de áudio não possui URL ou directPath');
              }

              // Baixar o áudio
              logger.info('Tentando baixar áudio...');
              const audioBuffer = await this.downloadAudio(session.socket, message);
              
              if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Buffer de áudio vazio ou inválido');
              }

              logger.info(`Buffer de áudio válido recebido: ${audioBuffer.length} bytes`);
              
              // Processar áudio com IA
              logger.info(`Iniciando processamento com ${useGemini ? 'Gemini' : 'OpenAI'}...`);
              
              let result;
              if (useGemini) {
                result = await processAudioMessageWithGemini(
                  audioBuffer,
                  message.key.remoteJid,
                  config.apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0
                );
              } else if (useOpenAI) {
                result = await processAudioMessageWithAI(
                  audioBuffer,
                  message.key.remoteJid,
                  config.apiKey,
                  config.assistantId
                );
              }
              
              if (result) {
                aiResponse = result.aiResponse;
                transcription = result.transcription;
                logger.info(`Áudio processado com sucesso: "${transcription?.substring(0, 50)}..."`);
              }
            } catch (audioError) {
              logger.error('Erro detalhado ao processar áudio:', {
                error: audioError.message,
                stack: audioError.stack,
                sessionId,
                from: message.key.remoteJid,
                audioMessage: {
                  mimetype: audioMessage.mimetype,
                  fileLength: audioMessage.fileLength,
                  hasUrl: !!audioMessage.url,
                  hasDirectPath: !!audioMessage.directPath
                }
              });
              aiResponse = 'Desculpe, não consegui processar seu áudio. Pode enviar como texto?';
            }
          } else if (imageMessage) {
            // Processar mensagem com imagem
            logger.info(`Mensagem com imagem recebida em ${sessionId}`, {
              from: message.key.remoteJid,
              messageId: message.key.id,
              imageInfo: {
                mimetype: imageMessage.mimetype,
                fileLength: imageMessage.fileLength,
                caption: imageMessage.caption || 'Sem legenda'
              }
            });
            
            try {
              // Verificar se a mensagem tem conteúdo de imagem válido
              if (!imageMessage.url && !imageMessage.directPath) {
                throw new Error('Mensagem de imagem não possui URL ou directPath');
              }

              // Baixar a imagem
              logger.info('Tentando baixar imagem...');
              const imageBuffer = await this.downloadImage(session.socket, message);
              
              if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error('Buffer de imagem vazio ou inválido');
              }

              logger.info(`Buffer de imagem válido recebido: ${imageBuffer.length} bytes`);
              
              // Processar imagem com IA
              logger.info(`Iniciando processamento de imagem com ${useGemini ? 'Gemini Vision' : 'OpenAI Vision'}...`);
              
              let result;
              if (useGemini) {
                result = await processImageMessageWithGemini(
                  imageBuffer,
                  message.key.remoteJid,
                  config.apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0,
                  imageMessage.caption || ''
                );
              } else if (useOpenAI) {
                result = await processImageMessageWithAI(
                  imageBuffer,
                  message.key.remoteJid,
                  config.apiKey,
                  config.assistantId,
                  imageMessage.caption || ''
                );
              }
              
              if (result) {
                aiResponse = result.aiResponse;
                imageAnalysis = result.imageAnalysis;
                logger.info(`Imagem processada com ${useGemini ? 'Gemini' : 'OpenAI'}`);
                logger.info(`Análise enviada (${aiResponse?.length} caracteres)`);
              }
            } catch (imageError) {
              logger.error('Erro detalhado ao processar imagem:', {
                error: imageError.message,
                stack: imageError.stack,
                sessionId,
                from: message.key.remoteJid,
                imageMessage: {
                  mimetype: imageMessage.mimetype,
                  fileLength: imageMessage.fileLength,
                  hasUrl: !!imageMessage.url,
                  hasDirectPath: !!imageMessage.directPath
                }
              });
              aiResponse = 'Desculpe, não consegui processar sua imagem. Pode tentar enviar novamente?';
            }
          } else if (documentMessage) {
            // Processar mensagem com documento
            logger.info(`Mensagem com documento recebida em ${sessionId}`, {
              from: message.key.remoteJid,
              messageId: message.key.id,
              documentInfo: {
                mimetype: documentMessage.mimetype,
                fileLength: documentMessage.fileLength,
                fileName: documentMessage.fileName || 'documento',
                caption: documentMessage.caption || 'Sem legenda'
              }
            });
            
            try {
              // Verificar se a mensagem tem conteúdo de documento válido
              if (!documentMessage.url && !documentMessage.directPath) {
                throw new Error('Mensagem de documento não possui URL ou directPath');
              }

              // Baixar o documento
              logger.info('Tentando baixar documento...');
              const documentBuffer = await this.downloadDocument(session.socket, message);
              
              if (!documentBuffer || documentBuffer.length === 0) {
                throw new Error('Buffer de documento vazio ou inválido');
              }

              logger.info(`Buffer de documento válido recebido: ${documentBuffer.length} bytes`);
              
              // Processar documento com IA
              logger.info(`Iniciando processamento de documento com ${useGemini ? 'Gemini' : 'OpenAI'}...`);
              
              let result;
              if (useGemini) {
                result = await processDocumentMessageWithGemini(
                  documentBuffer,
                  documentMessage.fileName || 'documento',
                  message.key.remoteJid,
                  config.apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0,
                  documentMessage.caption || ''
                );
              } else if (useOpenAI) {
                result = await processDocumentMessageWithAI(
                  documentBuffer,
                  documentMessage.fileName || 'documento',
                  message.key.remoteJid,
                  config.apiKey,
                  config.assistantId,
                  documentMessage.caption || ''
                );
              }
              
              if (result) {
                aiResponse = result.aiResponse;
                documentContent = result.documentContent;
                logger.info(`Documento processado com ${useGemini ? 'Gemini' : 'OpenAI'}`);
                logger.info(`Análise enviada (${aiResponse?.length} caracteres)`);
              }
            } catch (documentError) {
              logger.error('Erro detalhado ao processar documento:', {
                error: documentError.message,
                stack: documentError.stack,
                sessionId,
                from: message.key.remoteJid,
                documentMessage: {
                  mimetype: documentMessage.mimetype,
                  fileLength: documentMessage.fileLength,
                  fileName: documentMessage.fileName,
                  hasUrl: !!documentMessage.url,
                  hasDirectPath: !!documentMessage.directPath
                }
              });
              aiResponse = 'Desculpe, não consegui processar seu documento. Pode tentar converter para PDF ou imagem?';
            }
          } 
          // Mensagens de texto já foram tratadas pelo buffer acima

          if (aiResponse) {
            await session.socket.sendMessage(message.key.remoteJid, {
              text: aiResponse
            });

            logger.info(`Resposta AI enviada para ${message.key.remoteJid}`);
            
            this.io.emit('message-processed', {
              sessionId,
              from: message.key.remoteJid,
              userMessage: transcription || imageAnalysis || documentContent || messageText,
              aiResponse,
              isAudio: !!audioMessage,
              isImage: !!imageMessage,
              isDocument: !!documentMessage,
              transcription,
              imageAnalysis,
              documentContent,
              fileName: documentMessage?.fileName
            });
          }
        }
      } catch (error) {
        logger.error(`Erro ao processar mensagem em ${sessionId}:`, error);
        this.io.emit('message-error', {
          sessionId,
          error: error.message
        });
      }
    }
  }

  extractMessageText(message) {
    const { 
      conversation, 
      extendedTextMessage, 
      imageMessage, 
      videoMessage, 
      audioMessage,
      documentMessage 
    } = message.message;
    
    if (conversation) return conversation;
    if (extendedTextMessage) return extendedTextMessage.text;
    if (imageMessage) return imageMessage.caption || '[Imagem]';
    if (videoMessage) return videoMessage.caption || '[Vídeo]';
    if (audioMessage) return '[Áudio]';
    if (documentMessage) return documentMessage.caption || '[Documento]';
    
    return null;
  }

  async downloadMedia(socket, message, mediaType) {
    try {
      logger.info(`Iniciando download de ${mediaType}...`);
      
      const mediaMessage = message.message[`${mediaType}Message`];
      
      if (!mediaMessage) {
        logger.error(`Mensagem não contém ${mediaType}Message`);
        throw new Error(`Mensagem não contém ${mediaType}`);
      }

      logger.info(`${mediaType}Message encontrado:`, {
        mimetype: mediaMessage.mimetype,
        fileLength: mediaMessage.fileLength,
        fileName: mediaMessage.fileName || 'N/A',
        caption: mediaMessage.caption || 'N/A'
      });

      logger.info('Iniciando download usando função do Baileys...');
      
      // Usar a função downloadMediaMessage importada do Baileys
      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: baileysLogger,
          reuploadRequest: socket.updateMediaMessage
        }
      );
      
      logger.info('Download concluído, verificando buffer...');
      
      if (!buffer) {
        logger.error('Buffer retornado é null/undefined');
        throw new Error(`Não foi possível baixar o ${mediaType} - buffer vazio`);
      }

      if (!Buffer.isBuffer(buffer)) {
        logger.error('Retorno não é um Buffer válido:', typeof buffer);
        throw new Error('Retorno não é um Buffer válido');
      }

      logger.info(`${mediaType} baixado com sucesso: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      logger.error(`Erro detalhado ao baixar ${mediaType}:`, {
        message: error.message,
        stack: error.stack,
        messageKeys: Object.keys(message),
        messageType: message.messageType,
        hasMediaMessage: !!message.message?.[`${mediaType}Message`]
      });
      throw error;
    }
  }

  async downloadAudio(socket, message) {
    return this.downloadMedia(socket, message, 'audio');
  }

  async downloadImage(socket, message) {
    return this.downloadMedia(socket, message, 'image');
  }

  async downloadDocument(socket, message) {
    return this.downloadMedia(socket, message, 'document');
  }

  async generateQR(sessionId) {
    try {
      logger.info(`Gerando QR Code para sessão ${sessionId}`);
      
      // Remover sessão existente se houver
      if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        try {
          if (session?.socket) {
            session.socket.ws?.close();
            session.socket.end?.();
          }
        } catch (e) {
          // Ignorar erros ao fechar socket
        }
        sessions.delete(sessionId);
      }

      // Limpar arquivos de sessão antigos
      const sessionPath = path.join(SESSIONS_PATH, sessionId);
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          logger.info(`Arquivos de sessão ${sessionId} limpos`);
        } catch (error) {
          logger.error(`Erro ao limpar sessão ${sessionId}:`, error);
        }
      }

      // Aguardar um pouco antes de criar nova sessão
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Criar nova sessão
      await this.createSession(sessionId);
      
      return { success: true, message: 'QR Code sendo gerado...' };
    } catch (error) {
      logger.error(`Erro ao gerar QR para ${sessionId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async logout(sessionId) {
    try {
      const session = sessions.get(sessionId);
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      await session.socket.logout();
      sessions.delete(sessionId);
      sessionConfigs.delete(sessionId);

      // Remover arquivos da sessão
      const sessionPath = path.join(SESSIONS_PATH, sessionId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }

      logger.info(`Sessão ${sessionId} desconectada e removida`);
      this.io.emit('logged-out', { sessionId });

      return { success: true, message: 'Desconectado com sucesso' };
    } catch (error) {
      logger.error(`Erro ao fazer logout de ${sessionId}:`, error);
      throw error;
    }
  }

  async getSessionStatus(sessionId) {
    const session = sessions.get(sessionId);
    
    if (!session) {
      return {
        connected: false,
        status: 'disconnected'
      };
    }

    const isConnected = session.socket.user ? true : false;

    return {
      connected: isConnected,
      status: isConnected ? 'connected' : 'connecting',
      user: session.socket.user ? {
        id: session.socket.user.id,
        name: session.socket.user.name,
        phoneNumber: session.socket.user.id.split(':')[0]
      } : null
    };
  }

  async saveConfig(sessionId, config) {
    return this.setSessionConfig(sessionId, config);
  }

  getConfig(sessionId) {
    return sessionConfigs.get(sessionId) || null;
  }

  getAllSessions() {
    const sessionsList = [];
    
    sessions.forEach((session, sessionId) => {
      sessionsList.push({
        sessionId,
        connected: session.socket.user ? true : false,
        user: session.socket.user || null,
        config: sessionConfigs.get(sessionId) || null
      });
    });

    return sessionsList;
  }

  async forceReconnect(sessionId) {
    try {
      if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        session.socket.end();
        sessions.delete(sessionId);
      }

      await this.createSession(sessionId);
      
      return { success: true, message: 'Reconexão iniciada' };
    } catch (error) {
      logger.error(`Erro ao reconectar ${sessionId}:`, error);
      throw error;
    }
  }

  // Configurar assistente (Gemini ou OpenAI) para uma sessão
  setSessionConfig(sessionId, config) {
    try {
      sessionConfigs.set(sessionId, {
        aiProvider: config.aiProvider || 'gemini', // 'gemini' ou 'openai'
        apiKey: config.apiKey,
        assistantId: config.assistantId, // Apenas para OpenAI
        model: config.model || 'gemini-2.0-flash-exp', // Modelo Gemini
        systemPrompt: config.systemPrompt || '', // Prompt do sistema
        temperature: config.temperature || 1.0, // Temperatura (0-2)
        ttsEnabled: config.ttsEnabled || false, // TTS habilitado
        ttsVoice: config.ttsVoice || 'Aoede', // Voz do TTS
        enabled: config.enabled !== false // default true
      });
      
      logger.info(`Configuração do assistente ${config.aiProvider || 'gemini'} atualizada para sessão ${sessionId}`);
      return { success: true, message: 'Assistente configurado com sucesso!' };
    } catch (error) {
      logger.error(`Erro ao configurar assistente para ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Remover configuração de uma sessão
  removeSessionConfig(sessionId) {
    sessionConfigs.delete(sessionId);
    logger.info(`Configuração removida para sessão ${sessionId}`);
    return { success: true, message: 'Configuração removida com sucesso!' };
  }

  // Adicionar mensagem ao buffer e reiniciar timer
  async bufferTextMessage(sessionId, phoneNumber, messageText, config, session) {
    const bufferKey = `${sessionId}_${phoneNumber}`;
    
    // Obter ou criar buffer para este usuário
    let buffer = messageBuffers.get(bufferKey);
    
    if (!buffer) {
      buffer = {
        messages: [],
        timer: null,
        sessionId,
        phoneNumber,
        config,
        session
      };
      messageBuffers.set(bufferKey, buffer);
    }

    // Adicionar mensagem ao buffer
    buffer.messages.push(messageText);
    logger.info(`📨 Mensagem adicionada ao buffer [${phoneNumber}]: "${messageText.substring(0, 50)}..." (Total: ${buffer.messages.length})`);

    // Cancelar timer anterior se existir
    if (buffer.timer) {
      clearTimeout(buffer.timer);
      logger.info(`⏱️  Timer resetado para [${phoneNumber}] - aguardando mais ${BUFFER_TIMEOUT/1000}s`);
    }

    // Criar novo timer de 10 segundos
    buffer.timer = setTimeout(async () => {
      await this.flushMessageBuffer(sessionId, phoneNumber, config, session);
    }, BUFFER_TIMEOUT);
  }

  // Enviar todas as mensagens do buffer para o Gemini
  async flushMessageBuffer(sessionId, phoneNumber, config, session) {
    const bufferKey = `${sessionId}_${phoneNumber}`;
    const buffer = messageBuffers.get(bufferKey);

    if (!buffer || buffer.messages.length === 0) {
      return; // Nada para enviar
    }

    // Cancelar timer se ainda estiver ativo
    if (buffer.timer) {
      clearTimeout(buffer.timer);
      buffer.timer = null;
    }

    // Concatenar todas as mensagens
    const combinedMessage = buffer.messages.join('\n\n');
    const messageCount = buffer.messages.length;
    
    logger.info(`🚀 Enviando ${messageCount} mensagem(ns) agrupada(s) para [${phoneNumber}]`);
    logger.info(`📝 Mensagem combinada (${combinedMessage.length} caracteres): "${combinedMessage.substring(0, 100)}..."`);

    // Limpar buffer
    messageBuffers.delete(bufferKey);

    try {
      // Detectar se está usando Gemini ou OpenAI
      const useGemini = config.aiProvider === 'gemini' || !config.assistantId;
      const useOpenAI = config.aiProvider === 'openai' && config.assistantId;

      let aiResponse;

      if (useGemini) {
        aiResponse = await processMessageWithGemini(
          combinedMessage,
          phoneNumber,
          config.apiKey,
          config.model || 'gemini-2.0-flash-exp',
          config.systemPrompt || '',
          config.temperature || 1.0
        );
      } else if (useOpenAI) {
        aiResponse = await processMessageWithAI(
          combinedMessage,
          phoneNumber,
          config.apiKey,
          config.assistantId
        );
      }

      if (aiResponse) {
        // Verificar se deve enviar como áudio (TTS)
        const sendAsAudio = config.ttsEnabled && 
                           config.ttsVoice && 
                           shouldSendAsAudio(aiResponse, combinedMessage, config.ttsEnabled);

        if (sendAsAudio) {
          try {
            logger.info(`🎤 Gerando resposta em áudio para ${phoneNumber}...`);
            
            // Gerar áudio
            const audioBuffer = await generateSpeech(
              aiResponse,
              config.apiKey,
              config.ttsVoice || 'Aoede',
              'pt-BR'
            );

            // Salvar temporariamente
            const audioPath = saveTempAudio(audioBuffer);

            logger.info(`📤 Enviando áudio TTS para WhatsApp...`, {
              phoneNumber,
              audioSize: audioBuffer.length,
              voice: config.ttsVoice,
              format: 'Gemini TTS PCM -> OGG'
            });

            // Enviar áudio pelo WhatsApp
            // Nota: Gemini TTS retorna PCM wave, mas o WhatsApp aceita e converte automaticamente
            await session.socket.sendMessage(phoneNumber, {
              audio: audioBuffer,
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true // Push-to-talk (áudio de voz)
            });

            // Limpar arquivo temporário
            cleanupTempAudio(audioPath);

            logger.info(`🔊 Áudio Gemini TTS enviado com sucesso para ${phoneNumber}`);
            
            this.io.emit('message-processed', {
              sessionId,
              from: phoneNumber,
              userMessage: combinedMessage,
              aiResponse,
              messageCount,
              isGrouped: messageCount > 1,
              sentAsAudio: true,
              voice: config.ttsVoice
            });
          } catch (ttsError) {
            logger.error(`❌ Erro ao enviar áudio TTS, enviando texto:`, ttsError);
            
            // Fallback: enviar como texto
            await session.socket.sendMessage(phoneNumber, {
              text: aiResponse
            });

            this.io.emit('message-processed', {
              sessionId,
              from: phoneNumber,
              userMessage: combinedMessage,
              aiResponse,
              messageCount,
              isGrouped: messageCount > 1,
              sentAsAudio: false
            });
          }
        } else {
          // Enviar como texto normalmente
          await session.socket.sendMessage(phoneNumber, {
            text: aiResponse
          });

          logger.info(`✅ Resposta AI enviada para ${phoneNumber} (${messageCount} mensagens processadas)`);
          
          this.io.emit('message-processed', {
            sessionId,
            from: phoneNumber,
            userMessage: combinedMessage,
            aiResponse,
            messageCount,
            isGrouped: messageCount > 1,
            sentAsAudio: false
          });
        }
      }
    } catch (error) {
      logger.error(`❌ Erro ao processar mensagens agrupadas para ${phoneNumber}:`, error);
      this.io.emit('message-error', {
        sessionId,
        error: error.message
      });
    }
  }
}

export default WhatsAppService;

