import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import logger from '../config/logger.js';

// Usar createRequire para carregar pdf-parse (CommonJS) em ES module
const require = createRequire(import.meta.url);
let pdfParse;

// Cache de histórico por número de telefone
const userConversations = new Map();

/**
 * Processa uma mensagem usando Google Gemini
 */
export async function processMessageWithGemini(messageText, phoneNumber, apiKey, modelName = 'gemini-2.0-flash-exp', systemPrompt = '', temperature = 1.0) {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log("enviando para gemini", messageText);
    // Configuração do modelo
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: temperature,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
      systemInstruction: systemPrompt || 'Você é um assistente virtual prestativo e profissional.'
    });

    // Obter ou criar histórico de conversa para este usuário
    let chat = userConversations.get(phoneNumber);
    
    if (!chat) {
      chat = model.startChat({
        history: [],
      });
      userConversations.set(phoneNumber, chat);
      logger.info(`Nova conversa iniciada para ${phoneNumber}`);
    }

    logger.info('===== ENVIANDO MENSAGEM PARA GEMINI =====');
    logger.info(`Telefone: ${phoneNumber}`);
    logger.info(`Modelo: ${modelName}`);
    logger.info(`Temperatura: ${temperature}`);
    logger.info(`Prompt do Sistema: ${systemPrompt || 'Padrão'}`);
    logger.info(`Mensagem (${messageText.length} caracteres):`, messageText);
    logger.info('==========================================');
    
    try {
      const result = await chat.sendMessage(messageText);
      const response = result.response;
  
      // VERIFICAÇÃO DE SEGURANÇA: Checa se a resposta tem conteúdo válido
      if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
        const responseText = response.text(); // Agora é seguro chamar .text()
        
        logger.info('===== RESPOSTA VÁLIDA RECEBIDA DO GEMINI =====');
        logger.info(`Telefone: ${phoneNumber}`);
        logger.info(`Resposta (${responseText.length} caracteres): ${responseText}`);
        logger.info('========================================');
        
        return responseText;
  
      } else {
        // A API respondeu, mas bloqueou a resposta ou não gerou conteúdo.
        const finishReason = response.candidates?.[0]?.finishReason || 'Desconhecido';
        logger.warn('===== RESPOSTA DO GEMINI SEM CONTEÚDO =====');
        logger.warn(`Telefone: ${phoneNumber}`);
        logger.warn(`Motivo do término: ${finishReason}`);
        logger.warn('Resposta completa para depuração:', JSON.stringify(response, null, 2));
        logger.warn('=========================================');
  
        // Retorne uma mensagem padrão para o usuário final
        return "Desculpe, não consegui processar sua mensagem. Por favor, tente reformulá-la.";
      }
    } catch (error) {
      // Registrar como WARN: a chamada ao Gemini falhou, mas retornamos uma mensagem de fallback
      // para que a conversa do usuário continue (evita crash no pipeline).
      logger.warn('Erro ao processar mensagem com Gemini (retornando fallback):', error);
      return 'Desculpe, estou com dificuldades para processar sua mensagem no momento. Tente novamente em instantes.';
    }
  } catch (error) {
    logger.error('❌ ERRO COMPLETO AO PROCESSAR COM GEMINI:');
    logger.error('==============================================');
    
    // Log do erro bruto primeiro
    logger.error('ERRO BRUTO:', error);
    logger.error('Tipo do erro:', typeof error);
    logger.error('Construtor:', error?.constructor?.name);
    
    // Propriedades básicas
    if (error?.message) logger.error('Mensagem:', error.message);
    if (error?.name) logger.error('Nome:', error.name);
    if (error?.stack) logger.error('Stack:', error.stack);
    if (error?.code) logger.error('Code:', error.code);
    if (error?.status) logger.error('Status:', error.status);
    if (error?.statusText) logger.error('Status Text:', error.statusText);
    
    // Propriedades do Gemini SDK
    if (error?.response) {
      logger.error('Response existe:', true);
      logger.error('Response:', JSON.stringify(error.response, null, 2));
    }
    
    if (error?.data) {
      logger.error('Data existe:', true);
      logger.error('Data:', JSON.stringify(error.data, null, 2));
    }
    
    if (error?.error) {
      logger.error('Error object existe:', true);
      logger.error('Error object:', JSON.stringify(error.error, null, 2));
    }
    
    // Todas as chaves do objeto de erro
    logger.error('Chaves do erro:', Object.keys(error || {}));
    logger.error('Propriedades próprias:', Object.getOwnPropertyNames(error || {}));
    
    // Tentar serializar o erro completo
    try {
      logger.error('JSON completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      logger.error('Não foi possível serializar o erro:', e.message);
    }
    
    // Inspeção completa
    try {
      logger.error('Inspeção do erro:', require('util').inspect(error, { depth: 5, colors: false }));
    } catch (e) {
      logger.error('Não foi possível inspecionar o erro');
    }
    
    logger.error('==============================================');
    
    // Tratamento específico de erros
    const errorMsg = error?.message || error?.toString() || 'Erro desconhecido';
    
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key') || errorMsg.includes('API_KEY') || errorMsg.includes('invalid')) {
      logger.error('❌ API Key inválida ou sem permissão');
      return 'Desculpe, a API Key do Gemini está inválida. Verifique sua configuração.';
    }
    
    if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      logger.error('❌ Limite de uso excedido');
      return 'Desculpe, o limite de uso da API foi excedido. Aguarde alguns minutos.';
    }

    return 'Desculpe, estou com dificuldades para processar sua mensagem no momento. Tente novamente em instantes.';
  }
}

/**
 * Transcreve áudio usando Google Gemini (ainda não suportado - usar Whisper API)
 */
export async function transcribeAudio(audioBuffer, apiKey, prompt = '') {
  try {
    logger.info('Iniciando transcrição de áudio...', {
      bufferSize: audioBuffer.length,
      bufferType: typeof audioBuffer,
      isBuffer: Buffer.isBuffer(audioBuffer)
    });

    if (!Buffer.isBuffer(audioBuffer)) {
      throw new Error('audioBuffer deve ser um Buffer válido');
    }

    if (audioBuffer.length === 0) {
      throw new Error('Buffer de áudio está vazio');
    }

    // Nota: Gemini ainda não suporta transcrição de áudio nativamente
    // Alternativa: usar Google Speech-to-Text ou Whisper API
    logger.warn('Transcrição de áudio com Gemini ainda não implementada');
    return 'Desculpe, ainda não consigo processar áudios. Por favor, envie sua mensagem como texto.';
  } catch (error) {
    logger.error('❌ ERRO ao transcrever áudio:');
    logger.error('Mensagem:', error.message);
    logger.error('Stack:', error.stack);
    throw error;
  }
}

/**
 * Analisa imagem usando Google Gemini Vision
 */
export async function analyzeImage(imageBuffer, apiKey, modelName = 'gemini-2.0-flash-exp', prompt = '', systemPrompt = '') {
  try {
    logger.info('Iniciando análise de imagem com Gemini...', {
      bufferSize: imageBuffer.length,
      bufferType: typeof imageBuffer,
      isBuffer: Buffer.isBuffer(imageBuffer)
    });

    if (!Buffer.isBuffer(imageBuffer)) {
      throw new Error('imageBuffer deve ser um Buffer válido');
    }

    if (imageBuffer.length === 0) {
      throw new Error('Buffer de imagem está vazio');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemPrompt || 'Você é um assistente especializado em análise de imagens.'
    });

    // Converter buffer para base64
    const base64Image = imageBuffer.toString('base64');
    
    logger.info('Enviando imagem para Gemini Vision...');

    // Criar partes da mensagem: texto + imagem
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg'
      }
    };

    const textPart = prompt || "Analise esta imagem em detalhes. Descreva exatamente o que você vê, incluindo:\n- Se for uma imagem médica (raio-X, ressonância, etc.), descreva as estruturas anatômicas visíveis\n- Qualquer texto presente na imagem\n- Objetos, pessoas, cores e elementos visuais\n- Qualquer informação relevante ou anormalidade observada\n- Se houver texto na imagem, transcreva-o completamente\n\nSeja específico e detalhado na sua análise.";

    const result = await model.generateContent([textPart, imagePart]);
    const analysis = result.response.text();
    
    logger.info('Imagem analisada com sucesso:', {
      analysisLength: analysis.length,
      preview: analysis.substring(0, 100)
    });

    return analysis;
  } catch (error) {
    logger.error('Erro detalhado ao analisar imagem:', error);
    throw error;
  }
}

/**
 * Processa documento (PDF, DOC, etc.) convertendo para texto
 */
export async function processDocument(documentBuffer, filename) {
  try {
    logger.info('Iniciando processamento de documento...', {
      filename,
      bufferSize: documentBuffer.length,
      fileExtension: path.extname(filename).toLowerCase()
    });

    const fileExtension = path.extname(filename).toLowerCase();
    
    // Para PDFs, usar uma biblioteca de extração de texto
    if (fileExtension === '.pdf') {
      return await extractTextFromPDF(documentBuffer);
    }
    
    // Para outros documentos, tentar converter para texto
    if (['.doc', '.docx', '.txt', '.rtf'].includes(fileExtension)) {
      // Se for texto simples, tentar ler diretamente
      if (fileExtension === '.txt') {
        const text = documentBuffer.toString('utf-8');
        logger.info('Texto extraído do arquivo .txt');
        return text;
      }
      
      // Para outros formatos, retornar informação básica
      return `Documento ${filename} recebido. Formato: ${fileExtension}. Tamanho: ${documentBuffer.length} bytes. Para melhor análise, converta para PDF ou imagem.`;
    }

    throw new Error(`Formato de arquivo não suportado: ${fileExtension}`);
  } catch (error) {
    logger.error('Erro ao processar documento:', error);
    throw error;
  }
}

/**
 * Extrai texto de PDF usando pdf-parse
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    logger.info('Iniciando extração de texto do PDF...');

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('pdfBuffer deve ser um Buffer válido');
    }

    if (pdfBuffer.length === 0) {
      throw new Error('Buffer de PDF está vazio');
    }

    // Carregar pdf-parse
    if (!pdfParse) {
      try {
        pdfParse = require('pdf-parse/lib/pdf-parse.js');
        logger.info('pdf-parse carregado com sucesso');
      } catch (error) {
        logger.error('Erro ao carregar pdf-parse:', error.message);
        throw new Error('Biblioteca de processamento de PDF não disponível');
      }
    }

    // Extrair texto do PDF
    const data = await pdfParse(pdfBuffer);
    
    const extractedText = data.text.trim();
    const numPages = data.numpages;
    const info = data.info;

    logger.info('PDF processado com sucesso:', {
      numPages,
      textLength: extractedText.length,
      title: info?.Title || 'Sem título',
    });

    if (!extractedText || extractedText.length === 0) {
      return `Este PDF contém ${numPages} página(s), mas não foi possível extrair texto diretamente. O documento pode conter apenas imagens ou ser um PDF escaneado.`;
    }

    // Formatar informações do PDF
    let result = '';
    
    if (info?.Title && info.Title !== 'Untitled') {
      result += `TÍTULO: ${info.Title}\n`;
    }
    
    if (numPages) {
      result += `PÁGINAS: ${numPages}\n`;
    }
    
    result += `\n${'='.repeat(60)}\n`;
    result += `CONTEÚDO DO DOCUMENTO:\n`;
    result += `${'='.repeat(60)}\n\n`;
    result += extractedText;

    return result;
  } catch (error) {
    logger.error('Erro ao extrair texto do PDF:', error);
    return `Não foi possível extrair o texto deste PDF. O documento pode estar protegido, corrompido, ou conter apenas imagens.`;
  }
}

/**
 * Processa mensagem com imagem usando Gemini Vision
 */
export async function processImageMessageWithGemini(imageBuffer, phoneNumber, apiKey, modelName, systemPrompt, temperature, caption = '') {
  try {
    logger.info(`Processando mensagem com imagem para ${phoneNumber}`);
    
    // Criar prompt combinado
    let fullPrompt = '';
    
    if (caption && caption.trim()) {
      fullPrompt = `O usuário enviou uma imagem com o seguinte comentário/pergunta:\n"${caption}"\n\nPor favor, analise a imagem e responda considerando o comentário do usuário.`;
    } else {
      fullPrompt = 'Analise esta imagem e forneça uma resposta detalhada e útil.';
    }
    
    // Analisar a imagem diretamente com o Gemini
    const analysis = await analyzeImage(imageBuffer, apiKey, modelName, fullPrompt, systemPrompt);
    
    logger.info('Imagem processada com Gemini Vision');
    
    return {
      imageAnalysis: analysis,
      aiResponse: analysis,
      caption
    };
  } catch (error) {
    logger.error('Erro ao processar mensagem com imagem:', error);
    throw error;
  }
}

/**
 * Processa mensagem com documento usando Gemini
 */
export async function processDocumentMessageWithGemini(documentBuffer, filename, phoneNumber, apiKey, modelName, systemPrompt, temperature, caption = '') {
  try {
    logger.info(`Processando documento para ${phoneNumber}: ${filename}`);
    
    // 1. Processar o documento
    const documentContent = await processDocument(documentBuffer, filename);
    logger.info(`Documento processado: "${documentContent.substring(0, 100)}..."`);
    
    // 2. Criar prompt para análise do documento
    let fullMessage = `CONTEXTO: Um usuário enviou um documento (${filename}).\n\nCONTEÚDO EXTRAÍDO DO DOCUMENTO:\n${documentContent}`;
    
    if (caption && caption.trim()) {
      fullMessage += `\n\nCOMENTÁRIO/PERGUNTA DO USUÁRIO:\n"${caption}"`;
    }
    
    fullMessage += `\n\nPor favor, analise o conteúdo do documento e forneça uma resposta útil e clara.`;
    
    // 3. Processar com o Gemini
    const aiResponse = await processMessageWithGemini(fullMessage, phoneNumber, apiKey, modelName, systemPrompt, temperature);
    
    return {
      documentContent,
      aiResponse,
      caption,
      filename
    };
  } catch (error) {
    logger.error('Erro ao processar mensagem com documento:', error);
    throw error;
  }
}

/**
 * Processa mensagem de áudio (não suportado ainda)
 */
export async function processAudioMessageWithGemini(audioBuffer, phoneNumber, apiKey, modelName, systemPrompt, temperature) {
  try {
    logger.info(`Processamento de áudio ainda não suportado para ${phoneNumber}`);
    
    return {
      transcription: 'Áudio recebido',
      aiResponse: 'Desculpe, ainda não consigo processar mensagens de áudio. Por favor, envie sua mensagem como texto.'
    };
  } catch (error) {
    logger.error('Erro ao processar mensagem de áudio:', error);
    throw error;
  }
}

/**
 * Limpa o histórico de conversa de um usuário
 */
export function clearUserConversation(phoneNumber) {
  userConversations.delete(phoneNumber);
  logger.info(`Conversa removida para ${phoneNumber}`);
}

/**
 * Limpa todas as conversas
 */
export function clearAllConversations() {
  userConversations.clear();
  logger.info('Todas as conversas foram limpas');
}

/**
 * Obtém estatísticas das conversas ativas
 */
export function getConversationsStats() {
  return {
    activeConversations: userConversations.size,
    conversations: Array.from(userConversations.keys()).map(phone => ({
      phoneNumber: phone
    }))
  };
}

