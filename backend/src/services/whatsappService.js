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
const pendingSends = new Map(); // sessionId -> [{ jid, payload, def, created }]
const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';
// Novo: bloqueio para criações de sessão em andamento (evita remoção concorrente de arquivos)
const activeSessionCreations = new Set();
// Flag para indicar que estamos gerando QR Code e não queremos reconexão automática
const generatingQR = new Set();

// Buffer de mensagens por usuário (para agrupar mensagens antes de enviar ao Gemini)
const messageBuffers = new Map(); // { phoneNumber: { messages: [], timer: timeoutId } }
const BUFFER_TIMEOUT = 10000; // 10 segundos
const apiKey = 'AIzaSyBUd78FQH2WuY1kumF_Vqt3EhcWUQg48jI';
// Garantir que o diretório de sessões existe
if (!fs.existsSync(SESSIONS_PATH)) {
  fs.mkdirSync(SESSIONS_PATH, { recursive: true });
}

class WhatsAppService {
  constructor(io) {
    this.io = io;
  }

  async createSession(sessionId, options = {}) {
    logger.info(`createSession: iniciando criação/restauração da sessão ${sessionId}`);
    if (sessions.has(sessionId)) {
      const existing = sessions.get(sessionId);
      // Se o socket existente não estiver aberto, remover e recriar
      try {
        if (this.isSocketOpen(existing.socket)) {
          logger.info(`Sessão ${sessionId} já existe e socket está aberto`);
          return sessions.get(sessionId);
        } else {
          logger.warn(`Sessão ${sessionId} existe mas socket NÃO está aberto — recriando`);
          try { existing.socket.ws?.close(); existing.socket.end?.(); } catch(e){}
          sessions.delete(sessionId);
        }
      } catch (e) {
        logger.warn(`Erro ao verificar estado do socket existente para ${sessionId}: ${e?.message || e}`);
        sessions.delete(sessionId);
      }
    }

    // Marcar que estamos criando/recriando esta sessão (evita que outro handler apague a pasta)
    activeSessionCreations.add(sessionId);

    try {
      const sessionPath = path.join(SESSIONS_PATH, sessionId);

      // If forceNewAuth is requested, ensure the session folder is removed so
      // Baileys will start without existing credentials and will emit a QR.
      if (options.forceNewAuth) {
        try {
          if (fs.existsSync(sessionPath)) {
            logger.info(`createSession: forceNewAuth=true — removendo pasta existente ${sessionPath}`);
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
        } catch (err) {
          logger.error(`createSession: falha ao remover pasta de sessão para forceNewAuth: ${err?.message || err}`);
        }
      }

      // Criar diretório da sessão se não existir
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }
      try {
        const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
        logger.info(`createSession: contents of ${sessionPath}: ${files.length} files -> ${files.join(', ')}`);
      } catch (listErr) {
        logger.warn(`createSession: falha ao listar conteúdo de ${sessionPath}: ${listErr?.message || listErr}`);
      }
      console.log(`createSession: auth state será carregado de ${sessionPath}`);
      let state, saveCreds;
      const MAX_AUTH_RETRIES = 5;
      for (let attempt = 0; attempt < MAX_AUTH_RETRIES; attempt++) {
        try {
          // Garantir que a pasta exista antes de pedir ao Baileys para usá-la
          if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
          }
          const auth = await useMultiFileAuthState(sessionPath);
          state = auth.state;
          saveCreds = auth.saveCreds;

      // Wrap saveCreds to be resilient to concurrent deletions/renames of the session folder.
      // If write fails with ENOENT, recreate the folder and retry a few times.
      const saveCredsSafe = async (data) => {
        const MAX_SAVE_RETRIES = 4;
        for (let attempt = 0; attempt < MAX_SAVE_RETRIES; attempt++) {
          try {
            // Ensure directory exists before delegating to Baileys' saveCreds
            if (!fs.existsSync(sessionPath)) {
              fs.mkdirSync(sessionPath, { recursive: true });
            }
            await saveCreds(data);
            return;
          } catch (err) {
            const isENOENT = err && (err.code === 'ENOENT' || (err.message && err.message.includes('ENOENT')));
            logger.warn(`saveCredsSafe: tentativa ${attempt + 1}/${MAX_SAVE_RETRIES} falhou para ${sessionPath}: ${err?.message || err}`);
            if (isENOENT) {
              try {
                fs.mkdirSync(sessionPath, { recursive: true });
                logger.warn(`saveCredsSafe: diretório recriado ${sessionPath} após ENOENT`);
              } catch (mkErr) {
                logger.error(`saveCredsSafe: falha ao recriar diretório ${sessionPath}:`, mkErr);
              }
              // backoff
              await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
              continue;
            }

            // Non-ENOENT -> log and rethrow
            logger.error('saveCredsSafe: erro não recuperável ao salvar credenciais:', err);
            throw err;
          }
        }

        logger.error(`saveCredsSafe: não foi possível salvar credenciais em ${sessionPath} após múltiplas tentativas`);
      };
          logger.info(`createSession: auth state carregado (creds keys: ${Object.keys(state.creds || {}).length})`);
          try {
            const postFiles = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
            logger.info(`createSession: após load auth, conteúdo de ${sessionPath}: ${postFiles.length} files -> ${postFiles.join(', ')}`);
          } catch (listErr2) {
            logger.warn(`createSession: falha ao listar conteúdo após auth load ${sessionPath}: ${listErr2?.message || listErr2}`);
          }
          break;
        } catch (err) {
          // Se for ENOENT, tentar recriar a pasta e re-tentar após pequeno delay
          const isENOENT = err && (err.code === 'ENOENT' || (err.message && err.message.includes('ENOENT')));
          logger.warn(`createSession: falha ao carregar auth state (attempt ${attempt + 1}/${MAX_AUTH_RETRIES}): ${err?.message || err}`);
          if (isENOENT) {
            try {
              fs.mkdirSync(sessionPath, { recursive: true });
              logger.warn(`createSession: diretório recriado ${sessionPath} após ENOENT`);
            } catch (mkErr) {
              logger.error(`createSession: falha ao recriar diretório ${sessionPath}:`, mkErr);
            }
            // aguardar um pouco antes da próxima tentativa
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            continue;
          }

          // Para outros erros, re-throw após log
          logger.error('createSession: erro fatal ao carregar auth state:', err);
          throw err;
        }
      }
      if (!state || !saveCreds) {
        throw new Error('Não foi possível carregar auth state após múltiplas tentativas');
      }

      const { version } = await fetchLatestBaileysVersion();
      logger.info(`createSession: versão do Baileys obtida: ${JSON.stringify(version)}`);

      logger.info(`createSession: Iniciando criação do socket Baileys para ${sessionId}`, {
        forceNewAuth: options.forceNewAuth,
        hasCredentials: !!state.creds,
        credentialsKeys: Object.keys(state.creds || {}),
        version: version
      });

      // Validação das credenciais antes da criação do socket
      if (!state.creds) {
        logger.error(`createSession: Credenciais não encontradas para ${sessionId}`);
        throw new Error('Credenciais não encontradas');
      }

      if (!state.keys) {
        logger.error(`createSession: Keys não encontradas para ${sessionId}`);
        throw new Error('Keys não encontradas');
      }

      // Validação básica da estrutura das credenciais
      const requiredCredFields = ['noiseKey', 'pairingEphemeralKeyPair', 'signedIdentityKey', 'signedPreKey', 'registrationId'];
      const missingFields = requiredCredFields.filter(field => !state.creds[field]);
      
      if (missingFields.length > 0) {
        logger.warn(`createSession: Campos de credenciais ausentes para ${sessionId}: ${missingFields.join(', ')}`);
        // Não vamos bloquear por campos ausentes, apenas logar
      }

      logger.info(`createSession: Validação de credenciais passou para ${sessionId}`, {
        credsValid: !!state.creds,
        keysValid: !!state.keys,
        missingFields: missingFields
      });

      let socket;
      try {
        // Configuração mínima do socket para teste
        logger.info(`createSession: Tentando configuração mínima do socket para ${sessionId}`);
        
        socket = makeWASocket({
          version,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
          },
          printQRInTerminal: false,
          logger: baileysLogger
        });

      logger.info(`createSession: Socket Baileys criado com sucesso para ${sessionId}`, {
        socketExists: !!socket,
        wsReadyState: socket?.ws?.readyState,
        socketType: typeof socket
      });

      } catch (socketError) {
        logger.error(`createSession: ERRO ao criar socket Baileys para ${sessionId}:`);
        logger.error(`Erro completo: ${socketError}`);
        logger.error(`Mensagem: ${socketError?.message}`);
        logger.error(`Nome: ${socketError?.name}`);
        logger.error(`Código: ${socketError?.code}`);
        logger.error(`Stack trace: ${socketError?.stack}`);
        logger.error(`Tipo do erro: ${typeof socketError}`);
        logger.error(`Constructor: ${socketError?.constructor?.name}`);
        logger.error(`Propriedades do erro: ${JSON.stringify(Object.getOwnPropertyNames(socketError))}`);
        
        // Tentar capturar propriedades específicas do Baileys
        if (socketError?.output) {
          logger.error(`Boom output: ${JSON.stringify(socketError.output)}`);
        }
        if (socketError?.data) {
          logger.error(`Dados do erro: ${JSON.stringify(socketError.data)}`);
        }
        
        throw socketError;
      }

      sessions.set(sessionId, { socket });
      logger.info(`createSession: socket instanciado e entry adicionada em memória para ${sessionId}. ws.readyState=${socket?.ws?.readyState}`);

      // Event handlers
      // Use safe wrapper to persist creds to disk (handles concurrent file/dir ops)
      try {
        if (typeof saveCredsSafe === 'function') {
          socket.ev.on('creds.update', saveCredsSafe);
          logger.info(`createSession: registrado saveCredsSafe para creds.update em ${sessionId}`);
        } else if (typeof saveCreds === 'function') {
          socket.ev.on('creds.update', saveCreds);
          logger.info(`createSession: registrado saveCreds (fallback) para creds.update em ${sessionId}`);
        } else {
          logger.warn(`createSession: nenhum handler de saveCreds disponível para ${sessionId}`);
        }
      } catch (evErr) {
        logger.error(`createSession: falha ao registrar handler de creds.update para ${sessionId}: ${evErr?.message || evErr}`);
      }

      try {
        socket.ev.on('connection.update', async (update) => {
          await this.handleConnectionUpdate(sessionId, update);
        });
        socket.ev.on('messages.upsert', async ({ messages }) => {
          await this.handleIncomingMessages(sessionId, messages);
        });
        logger.info(`createSession: handlers connection.update e messages.upsert registrados para ${sessionId}`);
      } catch (evErr2) {
        logger.error(`createSession: falha ao registrar connection/messages handlers para ${sessionId}: ${evErr2?.message || evErr2}`);
      }

      // Aguarda até que o socket emita conexão 'open' e até que o usuário (credenciais) esteja disponível, com timeout
      try {
        logger.info(`createSession: aguardando evento connection.open para sessão ${sessionId} (timeout 20s)`);
        const waitForOpen = (ms = 20000) => new Promise((resolve) => {
          let settled = false;
          const onUpdate = (update) => {
            try {
              if (update?.connection === 'open') {
                if (!settled) {
                  settled = true;
                  resolve(true);
                }
              }
              // If connection closed with loggedOut, resolve false
              if (update?.connection === 'close') {
                const shouldReconnect = update?.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (!shouldReconnect && !settled) {
                  settled = true;
                  resolve(false);
                }
              }
            } catch (e) {
              // ignore
            }
          };

          socket.ev.on('connection.update', onUpdate);

          // timeout
          setTimeout(() => {
            if (!settled) {
              settled = true;
              socket.ev.removeListener?.('connection.update', onUpdate);
              resolve(false);
            }
          }, ms);
        });

        const opened = await waitForOpen(20000);
        if (opened) {
          // aguardar até que socket.user esteja disponível (credenciais carregadas)
          const maxUserWait = 10000;
          const pollInterval = 200;
          let waited = 0;
          while (!socket.user && waited < maxUserWait) {
            await new Promise(r => setTimeout(r, pollInterval));
            waited += pollInterval;
          }

          if (socket.user) {
            logger.info(`createSession: socket.open e socket.user disponível para ${sessionId}`);
          } else {
            logger.warn(`createSession: socket.open mas socket.user NÃO disponível para ${sessionId} após ${maxUserWait}ms`);
          }
        } else {
          logger.warn(`createSession: Timeout aguardando abertura do socket para sessão ${sessionId} — retornando, socket pode não estar pronto`);
        }
      } catch (e) {
        logger.warn(`createSession: Erro ao aguardar conexão open para ${sessionId}: ${e?.message || e}`);
      }

      logger.info(`Sessao ${sessionId} criada com sucesso`);
      return { socket };
    } finally {
      // Garantir que o lock seja removido mesmo em erro (evita bloquear deleções futuras)
      activeSessionCreations.delete(sessionId);
    }
  }

  async handleConnectionUpdate(sessionId, update) {
    // Log detalhado de todos os updates de conexão
    logger.info(`handleConnectionUpdate: evento recebido para ${sessionId}`, {
      connection: update.connection,
      hasQr: !!update.qr,
      hasLastDisconnect: !!update.lastDisconnect,
      updateKeys: Object.keys(update)
    });

    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Log detalhado do payload QR recebido
      logger.info(`handleConnectionUpdate: QR recebido para ${sessionId}`, {
        qrType: typeof qr,
        qrLength: qr?.length || 'N/A',
        qrIsBuffer: Buffer.isBuffer(qr),
        qrIsString: typeof qr === 'string',
        qrIsObject: typeof qr === 'object' && qr !== null,
        qrConstructor: qr?.constructor?.name || 'N/A',
        qrSample: typeof qr === 'string' ? qr.substring(0, 50) + '...' : 'N/A'
      });

      // Emit raw QR payload for debugging (frontend/admin can inspect)
      try {
        this.io.emit('qr-raw', { sessionId, qrPayload: qr });
      } catch (e) {
        logger.warn(`Falha ao emitir qr-raw para ${sessionId}: ${e?.message || e}`);
      }

      try {
        // Normalize QR payload to a string when possible
        let qrString;
        if (typeof qr === 'string') {
          qrString = qr;
        } else if (Buffer.isBuffer(qr)) {
          qrString = qr.toString('utf8');
        } else if (qr && typeof qr === 'object' && typeof qr.code === 'string') {
          // Em alguns casos o payload pode ser um objeto com campo 'code' ou similar
          qrString = qr.code;
        } else if (qr && typeof qr === 'object' && typeof qr.qr === 'string') {
          qrString = qr.qr;
        } else {
          try { 
            qrString = JSON.stringify(qr); 
          } catch(e) { 
            qrString = String(qr); 
          }
        }

        // Validar se qrString é válido antes de tentar gerar QR
        if (!qrString || qrString.trim() === '' || qrString === 'null' || qrString === 'undefined') {
          logger.error(`handleConnectionUpdate: QR string inválido para ${sessionId}:`, {
            qrString,
            originalQr: qr,
            qrType: typeof qr
          });
          this.io.emit('qr-error', { sessionId, error: 'QR payload inválido ou vazio' });
          return;
        }

        logger.info(`handleConnectionUpdate: QR normalizado para ${sessionId} (length=${qrString.length}, sample=${qrString.substring(0, 50)}...)`);

        // Tentar gerar DataURL a partir da string normalizada
        let qrDataURL;
        try {
          qrDataURL = await QRCode.toDataURL(qrString);
        } catch (innerErr) {
          logger.warn(`QRCode.toDataURL falhou com normalized string — tentando fallback (session ${sessionId}):`, {
            error: innerErr?.message || innerErr,
            qrStringLength: qrString.length,
            qrStringSample: qrString.substring(0, 100)
          });
          // Fallback: tentar usar a string bruta (não JSONified)
          try {
            qrDataURL = await QRCode.toDataURL(String(qr));
          } catch (fallbackErr) {
            // Se tudo falhar, log completo e emitir erro
            logger.error(`Erro ao gerar QR Code (fallback falhou) para ${sessionId}:`, { 
              message: fallbackErr?.message || String(fallbackErr), 
              stack: fallbackErr?.stack, 
              qrPayload: qr,
              qrString: qrString,
              qrType: typeof qr
            });
            this.io.emit('qr-error', { sessionId, error: fallbackErr?.message || String(fallbackErr) });
            return;
          }
        }

        // Se obtivemos um DataURL válido, emitir para frontend
        if (qrDataURL) {
          this.io.emit('qr', { sessionId, qr: qrDataURL });
          logger.info(`QR Code gerado para sessão ${sessionId}`);
        } else {
          logger.warn(`QRCode.toDataURL retornou vazio para ${sessionId}; emitindo qr-raw para diagnóstico`);
          this.io.emit('qr-error', { sessionId, error: 'QRCode.toDataURL retornou vazio', qrPayload: qr });
        }
      } catch (error) {
        // Log mais completo para depuração (inclui stack e payload do qr)
        logger.error(`Erro ao processar payload de QR para ${sessionId}:`, { message: error?.message || String(error), stack: error?.stack, qrPayload: qr });
        this.io.emit('qr-error', { sessionId, error: error?.message || String(error) });
      }
    }

    if (connection === 'close') {
      // Log completo do lastDisconnect para diagnóstico
      logger.warn(`connection.update close para ${sessionId} — lastDisconnect: ${JSON.stringify(lastDisconnect)}`);

      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const payloadMessage = lastDisconnect?.error?.output?.payload?.message;

      // Tratar alguns códigos/erros como irreparáveis para evitar loop de reconexão
      const unrecoverableStatusCodes = [440, 428, 401];
      const isUnrecoverableCode = unrecoverableStatusCodes.includes(Number(statusCode));
      const isLoggedOutFlag = statusCode === DisconnectReason.loggedOut || payloadMessage === 'loggedOut' || payloadMessage === 'Invalid session';

      const shouldReconnect = !(isUnrecoverableCode || isLoggedOutFlag);

      logger.info(`Conexão fechada para ${sessionId}. statusCode=${statusCode} payloadMessage=${payloadMessage} shouldReconnect=${shouldReconnect}`);

      // Limpar sessão atual em memória
      sessions.delete(sessionId);

      if (shouldReconnect) {
        // Verificar se estamos gerando QR Code - se sim, NÃO reconectar automaticamente
        if (generatingQR.has(sessionId)) {
          logger.info(`Conexão fechada para ${sessionId} durante geração de QR Code - NÃO reconectando automaticamente`);
          return;
        }

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
            this.io.emit('connection-error', { sessionId, error: error?.message || String(error) });
          }
        }, 2000);
      } else {
        // Marca como logged-out, mas PRESERVA os arquivos de sessão para permitir
        // restauração manual ou análise. Apenas um logout explícito pelo usuário
        // (via endpoint ou socket) removerá os arquivos.
        sessionConfigs.delete(sessionId);
        this.io.emit('logged-out', { sessionId });
        logger.warn(`Sessão ${sessionId} considerada logged-out; arquivos preservados. Use o endpoint/logout para remover se desejar.`);
      }
    } else if (connection === 'open') {
      logger.info(`Conexão estabelecida para ${sessionId}`);
      
      const session = sessions.get(sessionId);
      if (session?.socket) {
        const user = session.socket.user;
        logger.info(`connection.update open: session=${sessionId} user=${user ? user.id : 'null'} readyState=${session.socket?.ws?.readyState}`);
        if (user) {
          this.io.emit('connected', { 
            sessionId,
            user: {
              id: user.id,
              name: user.name,
              phoneNumber: user.id.split(':')[0]
            }
          });
          // Flush any pending sends queued while socket was opening
          try {
            await this.flushPendingSends(sessionId);
          } catch (err) {
            logger.warn(`Erro ao enviar mensagens pendentes para ${sessionId}: ${err?.message || err}`);
          }
        }
      }
    } else if (connection === 'connecting') {
      this.io.emit('connecting', { sessionId });
    }
  }

  async handleIncomingMessages(sessionId, messages) {
    const config = sessionConfigs.get(sessionId);    
    console.log(apiKey);
    
    
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
        console.log(messageText);
        if (!audioMessage && !imageMessage && !documentMessage && !messageText) continue;

        // Se tem configuração de IA, processar com buffer para agrupar mensagens
        if (apiKey) {
          const phoneNumber = message.key.remoteJid;
          
          // Se for mensagem de texto, usar buffer de 10 segundos
          if (messageText && !audioMessage && !imageMessage && !documentMessage) {
            await this.bufferTextMessage(sessionId, phoneNumber, messageText, config, session);
            continue; // Não processar imediatamente
          }
          
          // Para áudio, imagem e documentos, processar imediatamente (sem buffer)
          // Mas antes, enviar qualquer mensagem em buffer
          await this.flushMessageBuffer(sessionId, phoneNumber, config, session);
          console.log("flushMessageBuffer acabou");
          // Agora processar mídia
          let aiResponse;
          let transcription = null;
          let imageAnalysis = null;
          let documentContent = null;
          
          const useGemini = true;
         

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
              
              logger.info(`Iniciando processamento com ${useGemini ? 'Gemini' : 'OpenAI'}...`);
              
              let result;
              if (useGemini) {
                result = await processAudioMessageWithGemini(
                  audioBuffer,
                  message.key.remoteJid,
                  apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0
                );
              } 
              
              if (result) {
                console.log(result);
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
                  apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0,
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
                  apiKey,
                  config.model || 'gemini-2.0-flash-exp',
                  config.systemPrompt || '',
                  config.temperature || 1.0,
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
         
          if (aiResponse) {
            await this.sendMessageSafe(sessionId, message.key.remoteJid, { text: aiResponse });

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

  // Verifica se o socket do Baileys está aberto
  isSocketOpen(socket) {
    try {
      // WebSocket readyState === 1 significa OPEN
      const wsState = socket?.ws?.readyState;
      // Considere socket pronto se o websocket estiver OPEN ou se socket.user já estiver preenchido
      return (wsState === 1) || !!socket?.user;
    } catch (e) {
      return false;
    }
  }

  // Envia mensagem com tentativas e reconexão automática se necessário
  async sendMessageSafe(sessionId, jid, messagePayload, opts = {}) {
    const attempts = opts.attempts || 3;
    const delayMs = opts.delayMs || 1000;
    const tryReconnect = opts.tryReconnect !== false; // default true

    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada ao enviar mensagem`);

    logger.info(`sendMessageSafe: iniciado para ${jid} na sessão ${sessionId} (attempts=${attempts}, delayMs=${delayMs})`);

    // If socket is not open right now, queue the send and wait for flush (prevents race)
    const socketNow = session.socket;
    if (!this.isSocketOpen(socketNow)) {
      logger.info(`sendMessageSafe: socket não aberto agora para ${sessionId}, enfileirando mensagem para envio quando abrir`);
      const def = {};
      def.promise = new Promise((resolve, reject) => { def.resolve = resolve; def.reject = reject; });
      // Attach a noop catch handler immediately to avoid unhandledRejection if timeout occurs
      def.promise.catch(() => {});
      const entry = { jid, messagePayload, def, created: Date.now() };
      const queue = pendingSends.get(sessionId) || [];
      queue.push(entry);
      pendingSends.set(sessionId, queue);

      // Timeout for queued message
      const queueTimeout = (opts.queueTimeoutMs) || 60000;
      const timer = setTimeout(() => {
        // Remove from queue if still there and reject
        const q = pendingSends.get(sessionId) || [];
        const idx = q.indexOf(entry);
        if (idx !== -1) {
          q.splice(idx, 1);
          pendingSends.set(sessionId, q);
          try {
            def.reject(new Error('Timeout aguardando socket abrir para envio'));
          } catch (e) {
            logger.warn('flushPendingSends: falha ao rejeitar promise de fila:', e?.message || e);
          }
        }
      }, queueTimeout);

      // When resolved or rejected, clear timer
      def.promise.finally(() => clearTimeout(timer));

      return def.promise;
    }

    for (let i = 0; i < attempts; i++) {
      const socket = session.socket;
      logger.debug(`sendMessageSafe: tentativa ${i + 1}/${attempts} — socket.readyState=${socket?.ws?.readyState} ; socket.user=${!!socket?.user}`);
      if (this.isSocketOpen(socket)) {
        try {
          return await socket.sendMessage(jid, messagePayload);
        } catch (err) {
          // Se falha por conexão, tentar outra vez
          logger.warn(`Falha ao enviar mensagem (tentativa ${i + 1}/${attempts}) para ${jid}: ${err?.message || err}`);
          logger.debug('sendMessageSafe: erro detalhado ao enviar:', { error: err, output: err?.output });
          // Se for erro crítico de conexão, tentar reconectar
          const isConnectionClosed = err && err.output && err.output.payload && err.output.payload.message === 'Connection Closed';
          if (isConnectionClosed && tryReconnect) {
            try {
              logger.info(`sendMessageSafe: erro de conexão detectado ao enviar para ${sessionId}, tentando forceReconnect...`);
              const fr = await this.forceReconnect(sessionId);
              logger.info(`sendMessageSafe: forceReconnect resultado: ${JSON.stringify(fr)}`);
              // aguardar um pouco para o socket abrir
              await new Promise(r => setTimeout(r, delayMs));
            } catch (reErr) {
              logger.error(`Erro ao forçar reconexão para ${sessionId}:`, reErr?.message || reErr);
            }
          }
        }
      }

      // Se socket não aberto, aguardar e tentar novamente
      logger.debug(`sendMessageSafe: socket não aberto ou envio falhou, aguardando ${delayMs}ms antes da próxima tentativa`);
      await new Promise(r => setTimeout(r, delayMs));
    }

    // Após tentativas, se ainda não enviou, tentar recriar sessão e enviar uma última vez
    if (tryReconnect) {
      try {
        logger.info(`Tentativa final: recriar sessão ${sessionId} antes de enviar mensagem para ${jid}`);
        await this.createSession(sessionId);
        const session2 = sessions.get(sessionId);
        logger.info(`sendMessageSafe: createSession retornou, socket.readyState=${session2?.socket?.ws?.readyState}, socket.user=${!!session2?.socket?.user}`);
        // Aguarda até o socket estar aberto (timeout 20s)
  const maxWait = 20000;
        const interval = 200;
        let waited = 0;
        while (!this.isSocketOpen(session2?.socket) && waited < maxWait) {
          await new Promise(r => setTimeout(r, interval));
          waited += interval;
        }
        logger.info(`sendMessageSafe: após espera final, socket.readyState=${session2?.socket?.readyState}, socket.user=${!!session2?.socket?.user}, waited=${waited}ms`);
        if (this.isSocketOpen(session2?.socket)) {
          return await session2.socket.sendMessage(jid, messagePayload);
        } else {
          logger.warn(`Socket ainda não aberto para ${sessionId} após recriar sessão (esperou ${waited}ms)`);
        }
      } catch (finalErr) {
        logger.error(`Falha final ao enviar mensagem para ${jid}:`, finalErr?.message || finalErr);
      }
    }

    throw new Error(`Não foi possível enviar mensagem para ${jid} na sessão ${sessionId}`);
  }

  async generateQR(sessionId) {
    try {
      logger.info(`generateQR: Iniciando geração de QR Code para sessão ${sessionId}`);
      
      // Marcar que estamos gerando QR Code (evitar reconexão automática)
      generatingQR.add(sessionId);
      
      // Remover sessão existente se houver
      if (sessions.has(sessionId)) {
        logger.info(`generateQR: Removendo sessão existente ${sessionId}`);
        const session = sessions.get(sessionId);
        try {
          if (session?.socket) {
            session.socket.ws?.close();
            session.socket.end?.();
          }
        } catch (e) {
          logger.warn(`generateQR: Erro ao fechar socket da sessão ${sessionId}:`, e?.message || e);
        }
        sessions.delete(sessionId);
        logger.info(`generateQR: Sessão ${sessionId} removida do Map`);
      }

      // Limpar arquivos da sessão antigos
      const sessionPath = path.join(SESSIONS_PATH, sessionId);
      logger.info(`generateQR: Verificando path da sessão: ${sessionPath}`);
      if (fs.existsSync(sessionPath)) {
        try {
          fs.rmSync(sessionPath, { recursive: true, force: true });
          logger.info(`generateQR: Arquivos de sessão ${sessionId} limpos com sucesso`);
        } catch (error) {
          logger.error(`generateQR: Erro ao limpar sessão ${sessionId}:`, { message: error?.message, stack: error?.stack });
          throw error; // Re-throw para capturar no catch principal
        }
      } else {
        logger.info(`generateQR: Path da sessão ${sessionPath} não existe, continuando...`);
      }

      // Aguardar um pouco antes de criar nova sessão
      logger.info(`generateQR: Aguardando 1 segundo antes de criar nova sessão ${sessionId}`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Criar nova sessão forçando um auth limpo para obrigar geração de QR
      logger.info(`generateQR: Chamando createSession para ${sessionId} com forceNewAuth: true`);
      await this.createSession(sessionId, { forceNewAuth: true });
      
      // Remover flag após 30 segundos (tempo suficiente para escanear QR)
      setTimeout(() => {
        generatingQR.delete(sessionId);
        logger.info(`generateQR: Flag de geração de QR removida para ${sessionId}`);
      }, 30000);
      
      logger.info(`generateQR: createSession completado com sucesso para ${sessionId}`);
      return { success: true, message: 'QR Code sendo gerado...' };
    } catch (error) {
      // Log completo para facilitar diagnóstico
      logger.error(`generateQR: ERRO CAPTURADO ao gerar QR para ${sessionId}:`);
      logger.error(`Erro completo: ${error}`);
      logger.error(`Mensagem: ${error?.message}`);
      logger.error(`Nome: ${error?.name}`);
      logger.error(`Código: ${error?.code}`);
      logger.error(`Stack trace: ${error?.stack}`);
      logger.error(`Tipo do erro: ${typeof error}`);
      logger.error(`Constructor: ${error?.constructor?.name}`);
      logger.error(`Propriedades do erro: ${JSON.stringify(Object.getOwnPropertyNames(error))}`);
      
      // Tentar capturar propriedades específicas do Baileys
      if (error?.output) {
        logger.error(`Boom output: ${JSON.stringify(error.output)}`);
      }
      if (error?.data) {
        logger.error(`Dados do erro: ${JSON.stringify(error.data)}`);
      }
      
      return { success: false, error: error?.message || String(error) };
    }
  }

  // Flush pending sends queued while socket was opening
  async flushPendingSends(sessionId) {
    const queue = pendingSends.get(sessionId) || [];
    if (!queue || queue.length === 0) return;

    logger.info(`flushPendingSends: enviando ${queue.length} mensagens pendentes para ${sessionId}`);

    const session = sessions.get(sessionId);
    if (!session?.socket || !this.isSocketOpen(session.socket)) {
      logger.warn(`flushPendingSends: socket não está pronto para ${sessionId}, adiando flush`);
      return;
    }

    // Send all queued messages sequentially
    while (queue.length > 0) {
      const item = queue.shift();
      try {
        logger.info(`flushPendingSends: enviando para ${item.jid} (session ${sessionId})`);
        const res = await session.socket.sendMessage(item.jid, item.messagePayload);
        item.def.resolve(res);
      } catch (err) {
        logger.error(`flushPendingSends: erro ao enviar para ${item.jid}: ${err?.message || err}`);
        item.def.reject(err);
      }
    }

    pendingSends.delete(sessionId);
  }

  async logout(sessionId, options = { removeFiles: true }) {
    try {
      const session = sessions.get(sessionId);
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      // Se for uma remoção completa (usuário) -> chamar logout do Baileys e remover arquivos
      if (options.removeFiles !== false) {
        // Tenta efetuar logout remoto (invalidate credentials)
        try {
          await session.socket.logout();
        } catch (err) {
          // Se logout falhar, tentamos apenas fechar a conexão
          logger.warn(`Falha ao executar socket.logout() para ${sessionId}, fechando socket: ${err.message || err}`);
          try { session.socket.ws?.close(); session.socket.end?.(); } catch(e){}
        }

        // Remover arquivos da sessão do disco
        const sessionPath = path.join(SESSIONS_PATH, sessionId);
        if (fs.existsSync(sessionPath)) {
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } catch (err) {
            logger.error(`Erro ao remover arquivos da sessão ${sessionId}:`, err);
          }
        }
        sessions.delete(sessionId);
        sessionConfigs.delete(sessionId);

        logger.info(`Sessão ${sessionId} desconectada e removida`);
        this.io.emit('logged-out', { sessionId });

        return { success: true, message: 'Desconectado com sucesso' };
      }

      // Se removeFiles === false -> apenas fechar socket/localmente sem apagar credenciais
      try {
        session.socket.ws?.close();
        session.socket.end?.();
      } catch (err) {
        logger.warn(`Erro ao fechar socket para ${sessionId}: ${err.message || err}`);
      }

      sessions.delete(sessionId);

      logger.info(`Sessão ${sessionId} desconectada (arquivos preservados)`);
      this.io.emit('disconnected', { sessionId, reason: 'shutdown' });

      return { success: true, message: 'Sessão fechada (arquivos preservadas)' };
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
        apiKey: apiKey,
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
    console.log("messageCount", messageCount);
    console.log("combinedMessage", combinedMessage);
    console.log("ai entrar no try agr")
    logger.info(`🚀 Enviando ${messageCount} mensagem(ns) agrupada(s) para [${phoneNumber}]`);
    logger.info(`📝 Mensagem combinada (${combinedMessage.length} caracteres): "${combinedMessage.substring(0, 100)}..."`);


    try {
      console.log("try");
      // Detectar se está usando Gemini 
      const useGemini = true;

      let aiResponse;
     

      if (useGemini) {
        console.log("useGemini true, enviando para gemini");
        console.log("combinedMessage", combinedMessage);
        console.log("phoneNumber", phoneNumber);
        console.log("apiKey", apiKey);
        
        aiResponse = await processMessageWithGemini(
          combinedMessage,
          phoneNumber,
          apiKey,
          'gemini-2.0-flash',
          '',
          1.0
        );
      } 
      console.log("aiResponse", aiResponse);
      console.log("retornou do gemini");

      if (aiResponse) {
        // Se a resposta for um fallback indicando falha no Gemini, logar de forma clara
        const isFallback = typeof aiResponse === 'string' && aiResponse.startsWith('Desculpe');
        if (isFallback) {
          logger.warn(`Resposta do Gemini parece ser um fallback para ${phoneNumber}; enviando fallback ao usuário. Snippet: ${aiResponse.substring(0, 120)}`);
        }

        // Verificar se deve enviar como áudio (TTS)
       /* const sendAsAudio = config.ttsEnabled && 
                           config.ttsVoice && 
                           shouldSendAsAudio(aiResponse, combinedMessage, config.ttsEnabled);*/
        const sendAsAudio = false;

        if (sendAsAudio) {
          try {
            logger.info(`🎤 Gerando resposta em áudio para ${phoneNumber}...`);
            
            // Gerar áudio
            const audioBuffer = await generateSpeech(
              aiResponse,
              apiKey,
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
            await this.sendMessageSafe(sessionId, phoneNumber, { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true });

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
            await this.sendMessageSafe(sessionId, phoneNumber, { text: aiResponse });

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
          await this.sendMessageSafe(sessionId, phoneNumber, { text: aiResponse });

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
      await this.sendMessageSafe(sessionId, phoneNumber, { text: 'Tivemos um problema ao processar sua mensagem. Por favor, tente novamente.' }).catch(() => {});
      this.io.emit('message-error', {
        sessionId,
        error: error.message
      });
    }
  }
  
  // Restaurar sessões existentes no disco (reconectar após restart)
  async restoreSessions() {
    try {
      logger.info('Iniciando restauração de sessões a partir do disco...');

      if (!fs.existsSync(SESSIONS_PATH)) {
        logger.info('Pasta de sessões não existe, nada para restaurar.');
        return { success: true, restored: 0 };
      }

      const entries = fs.readdirSync(SESSIONS_PATH, { withFileTypes: true });
      // Filtrar apenas diretórios válidos de sessão, ignorando backups/desabled gerados pelo sistema
      const sessionDirs = entries
        .filter(e => e.isDirectory())
        .map(d => d.name)
        .filter(name => {
          // Ignorar pastas marcadas como disabled/backup (ex: session.disabled.123456 / session.backup.123)
          const lower = name.toLowerCase();
          if (lower.includes('.disabled') || lower.includes('.backup')) {
            logger.info(`restoreSessions: pulando pasta de sessão marcada como disabled/backup: ${name}`);
            return false;
          }
          // Ignorar nomes que comecem com '.' ou arquivos temporários
          if (name.startsWith('.')) return false;
          return true;
        });

      let restored = 0;

      for (const sessionId of sessionDirs) {
        // Verificar se existem arquivos de credenciais básicos antes de tentar reconectar
        const sessionPath = path.join(SESSIONS_PATH, sessionId);
        const hasFiles = fs.readdirSync(sessionPath).length > 0;
        if (!hasFiles) {
          logger.info(`Sessão ${sessionId} ignorada (sem arquivos de credenciais)`);
          continue;
        }

        try {
          logger.info(`Tentando restaurar sessão ${sessionId}...`);
          await this.createSession(sessionId);
          restored += 1;
          // Pequena espera para evitar spikes de conexão
          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          logger.error(`Falha ao restaurar sessão ${sessionId}:`, error.message || error);
          this.io.emit('connection-error', { sessionId, error: error.message || String(error) });
        }
      }

      logger.info(`Restauração completa. Sessões restauradas: ${restored}`);
      this.io.emit('sessions-restored', { count: restored });
      return { success: true, restored };
    } catch (error) {
      logger.error('Erro ao tentar restaurar sessões:', error);
      return { success: false, error: error.message };
    }
  }

}

export default WhatsAppService;

