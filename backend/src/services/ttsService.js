import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import logger from '../config/logger.js';

/**
 * Serviço de Text-to-Speech usando Gemini TTS Nativo
 * API Gemini com TTS embutido - 30 vozes premium em português
 * Documentação: https://ai.google.dev/gemini-api/docs/speech-generation
 */

// Configurar caminho do ffmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const TTS_TEMP_DIR = './temp/tts';

// Garantir que o diretório temp existe
if (!fs.existsSync(TTS_TEMP_DIR)) {
  fs.mkdirSync(TTS_TEMP_DIR, { recursive: true });
}

/**
 * Converte áudio PCM Wave para OGG Opus
 * @param {Buffer} pcmBuffer - Buffer de áudio PCM
 * @returns {Promise<Buffer>} - Buffer de áudio em formato OGG Opus
 */
async function convertPCMtoOGG(pcmBuffer) {
  return new Promise((resolve, reject) => {
    const tempPcmPath = path.join(TTS_TEMP_DIR, `temp_${Date.now()}.pcm`);
    const tempOggPath = path.join(TTS_TEMP_DIR, `temp_${Date.now()}.ogg`);

    try {
      // Salvar PCM temporariamente
      fs.writeFileSync(tempPcmPath, pcmBuffer);

      // Converter PCM para OGG Opus usando ffmpeg
      ffmpeg(tempPcmPath)
        .inputFormat('s16le')  // PCM 16-bit little-endian
        .inputOptions([
          '-ar 24000',  // Sample rate 24kHz (mesmo do Gemini)
          '-ac 1'       // 1 canal (mono)
        ])
        .audioCodec('libopus')  // Codec Opus
        .audioBitrate('64k')    // Bitrate otimizado para voz
        .format('ogg')
        .on('end', () => {
          try {
            // Ler arquivo OGG gerado
            const oggBuffer = fs.readFileSync(tempOggPath);
            
            // Limpar arquivos temporários
            fs.unlinkSync(tempPcmPath);
            fs.unlinkSync(tempOggPath);
            
            resolve(oggBuffer);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          // Limpar arquivos em caso de erro
          if (fs.existsSync(tempPcmPath)) fs.unlinkSync(tempPcmPath);
          if (fs.existsSync(tempOggPath)) fs.unlinkSync(tempOggPath);
          reject(error);
        })
        .save(tempOggPath);
    } catch (error) {
      // Limpar arquivos em caso de erro
      if (fs.existsSync(tempPcmPath)) fs.unlinkSync(tempPcmPath);
      if (fs.existsSync(tempOggPath)) fs.unlinkSync(tempOggPath);
      reject(error);
    }
  });
}

/**
 * Gera áudio a partir de texto usando Gemini TTS Nativo
 * @param {string} text - Texto para converter em áudio
 * @param {string} apiKey - API Key do Gemini
 * @param {string} voiceName - Nome da voz (ex: 'Kore', 'Aoede', 'Puck')
 * @param {string} languageCode - Detectado automaticamente (pt-BR)
 * @returns {Promise<Buffer>} - Buffer do áudio em formato PCM (wave)
 */
export async function generateSpeech(text, apiKey, voiceName = 'Kore', languageCode = 'pt-BR') {
  try {
    logger.info('🎤 Gerando áudio TTS via Gemini TTS Nativo...', {
      textLength: text.length,
      voice: voiceName,
      model: 'gemini-2.5-flash-preview-tts'
    });

    // Mapear nomes de vozes (mantendo compatibilidade)
    // Documentação: https://ai.google.dev/gemini-api/docs/speech-generation
    const voiceMapping = {
      'Aoede': 'Aoede',     // Breezy
      'Kore': 'Kore',       // Firme (PADRÃO) ⭐
      'Charon': 'Charon',   // Informativa
      'Fenrir': 'Fenrir',   // Excitável
      'Puck': 'Puck',       // Upbeat
      'Orus': 'Orus'        // Firm
    };

    const selectedVoice = voiceMapping[voiceName] || 'Kore';

    // Inicializar o cliente Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-preview-tts'
    });

    logger.info('📡 Fazendo requisição para Gemini TTS:', {
      voice: selectedVoice,
      characters: text.length,
      maxTokens: 32000
    });

    // Gerar conteúdo com TTS
    const result = await model.generateContent({
      contents: [{ 
        parts: [{ 
          text: `Say in a natural and engaging way: ${text}` 
        }] 
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: selectedVoice
            }
          }
        }
      }
    });

    // Extrair dados de áudio
    const audioData = result.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      logger.error('Resposta do Gemini TTS:', JSON.stringify(result.response, null, 2));
      throw new Error('Nenhum áudio foi gerado pela API Gemini TTS');
    }

    // Converter base64 para buffer PCM
    const pcmBuffer = Buffer.from(audioData, 'base64');

    logger.info('✅ Áudio PCM gerado pelo Gemini', {
      pcmSize: pcmBuffer.length,
      pcmSizeKB: (pcmBuffer.length / 1024).toFixed(2) + ' KB',
      voice: selectedVoice
    });

    // Converter PCM Wave para OGG Opus (formato que o WhatsApp aceita)
    logger.info('🔄 Convertendo PCM para OGG Opus...');
    const oggBuffer = await convertPCMtoOGG(pcmBuffer);

    logger.info('✅ Áudio convertido com sucesso', {
      originalSize: pcmBuffer.length,
      convertedSize: oggBuffer.length,
      format: 'OGG Opus',
      voice: selectedVoice,
      characters: text.length
    });

    return oggBuffer;
    
  } catch (error) {
    logger.error('❌ ERRO COMPLETO ao gerar áudio Gemini TTS:');
    logger.error('Tipo do erro:', typeof error);
    logger.error('Mensagem:', error?.message || 'Sem mensagem');
    logger.error('Nome:', error?.name || 'Sem nome');
    logger.error('Stack:', error?.stack || 'Sem stack');
    
    // Tentar extrair mais informações do erro
    if (error?.response) {
      logger.error('Response:', JSON.stringify(error.response, null, 2));
    }
    if (error?.data) {
      logger.error('Data:', JSON.stringify(error.data, null, 2));
    }
    
    // Erros específicos
    if (error?.message?.includes('API_KEY_INVALID') || error?.message?.includes('API key') || error?.message?.includes('API_KEY')) {
      const errorMsg = 'API Key do Gemini inválida. Verifique sua chave em https://aistudio.google.com/app/apikey';
      logger.error('🔑 ' + errorMsg);
      throw new Error(errorMsg);
    }

    if (error?.message?.includes('quota') || error?.message?.includes('limit') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      const errorMsg = 'Limite de uso do Gemini TTS excedido. Aguarde ou faça upgrade da conta.';
      logger.error('⏱️ ' + errorMsg);
      throw new Error(errorMsg);
    }

    if (error?.message?.includes('not found') || error?.message?.includes('NOT_FOUND')) {
      const errorMsg = 'Modelo gemini-2.5-flash-preview-tts não encontrado. Verifique se está disponível na sua região.';
      logger.error('🔍 ' + errorMsg);
      throw new Error(errorMsg);
    }
    
    throw new Error(`Erro ao gerar áudio Gemini TTS: ${error?.message || 'Erro desconhecido'}`);
  }
}

/**
 * Detecta se a resposta contém links (URLs)
 * @param {string} text - Texto da resposta
 * @returns {boolean} - true se contém links
 */
function hasLinks(text) {
  // Regex para detectar URLs (http://, https://, www., etc)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|net|org|br|io|dev|app|co)[^\s]*)/gi;
  return urlRegex.test(text);
}

/**
 * Separa texto de links em uma resposta
 * @param {string} text - Texto completo
 * @returns {object} - { textWithoutLinks, links, hasLinks }
 */
export function separateTextAndLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|net|org|br|io|dev|app|co)[^\s]*)/gi;
  
  const links = [];
  let match;
  
  // Extrair todos os links
  while ((match = urlRegex.exec(text)) !== null) {
    links.push(match[0]);
  }
  
  // Remover links do texto
  let textWithoutLinks = text.replace(urlRegex, '').trim();
  
  // Limpar múltiplos espaços e quebras de linha
  textWithoutLinks = textWithoutLinks.replace(/\s+/g, ' ').trim();
  
  return {
    textWithoutLinks,
    links,
    hasLinks: links.length > 0
  };
}

/**
 * Detecta se o texto deve ser convertido em áudio
 * @param {string} text - Resposta do Gemini
 * @param {string} userMessage - Mensagem original do usuário (opcional)
 * @param {boolean} ttsEnabled - Se TTS está habilitado
 * @param {boolean} receivedAudio - Se a mensagem recebida foi um áudio
 * @returns {boolean} - true se deve enviar áudio
 */
export function shouldSendAsAudio(text, userMessage = '', ttsEnabled, receivedAudio = false) {
  if (!ttsEnabled) {
    return false;
  }

  // REGRA: Se recebeu áudio, responde com áudio (mesmo que tenha links - os links serão separados)
  if (receivedAudio) {
    logger.info('🎤 Mensagem recebida foi áudio - respondendo com áudio');
    return true;
  }

  // Se não recebeu áudio, não envia áudio
  logger.info('📝 Mensagem não foi áudio - respondendo com texto');
  return false;
}

/**
 * Salva áudio temporário e retorna o caminho
 * @param {Buffer} audioBuffer - Buffer do áudio
 * @returns {string} - Caminho do arquivo temporário
 */
export function saveTempAudio(audioBuffer) {
  const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
  const filepath = path.join(TTS_TEMP_DIR, filename);
  
  fs.writeFileSync(filepath, audioBuffer);
  logger.info(`💾 Áudio salvo temporariamente: ${filepath}`);
  
  return filepath;
}

/**
 * Remove arquivo de áudio temporário
 * @param {string} filepath - Caminho do arquivo
 */
export function cleanupTempAudio(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      logger.info(`🗑️ Áudio temporário removido: ${filepath}`);
    }
  } catch (error) {
    logger.error('Erro ao remover áudio temporário:', error);
  }
}

/**
 * Limpa todos os áudios temporários antigos (mais de 1 hora)
 */
export function cleanupOldAudios() {
  try {
    if (!fs.existsSync(TTS_TEMP_DIR)) {
      return;
    }

    const files = fs.readdirSync(TTS_TEMP_DIR);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    files.forEach(file => {
      const filepath = path.join(TTS_TEMP_DIR, file);
      const stats = fs.statSync(filepath);
      
      if (stats.mtimeMs < oneHourAgo) {
        fs.unlinkSync(filepath);
        logger.info(`🗑️ Áudio antigo removido: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Erro ao limpar áudios antigos:', error);
  }
}

// Limpar áudios antigos a cada hora
setInterval(() => {
  cleanupOldAudios();
}, 60 * 60 * 1000);

export default {
  generateSpeech,
  shouldSendAsAudio,
  separateTextAndLinks,
  saveTempAudio,
  cleanupTempAudio,
  cleanupOldAudios
};
