import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import logger from '../config/logger.js';

// Usar createRequire para carregar pdf-parse (CommonJS) em ES module
const require = createRequire(import.meta.url);
let pdfParse;

// Cache de threads por número de telefone
const userThreads = new Map();

/**
 * Transcreve áudio usando OpenAI Whisper API
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

    const openai = new OpenAI({ apiKey });

    // Criar arquivo temporário
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      logger.info('Criando diretório temp...');
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Usar extensão .ogg para áudios do WhatsApp
    const tempFilePath = path.join(tempDir, `audio_${Date.now()}.ogg`);
    
    logger.info(`Salvando áudio temporário em: ${tempFilePath}`);
    
    // Salvar buffer como arquivo temporário
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Verificar se o arquivo foi criado corretamente
    const fileStats = fs.statSync(tempFilePath);
    logger.info(`Arquivo temporário criado: ${fileStats.size} bytes`);

    try {
      logger.info('Enviando para OpenAI Whisper...');
      
      // Transcrever usando Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        response_format: 'text',
        language: 'pt', // Português
        prompt: prompt || 'Transcrição de mensagem de áudio do WhatsApp em português.'
      });

      logger.info('Áudio transcrito com sucesso:', {
        transcriptionLength: transcription.length,
        preview: transcription.substring(0, 100)
      });
      
      return transcription;
    } finally {
      // Limpar arquivo temporário
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        logger.info('Arquivo temporário removido');
      }
    }
  } catch (error) {
    logger.error('Erro detalhado ao transcrever áudio:', {
      message: error.message,
      stack: error.stack,
      bufferInfo: {
        size: audioBuffer?.length || 0,
        type: typeof audioBuffer,
        isBuffer: Buffer.isBuffer(audioBuffer)
      }
    });
    throw error;
  }
}

/**
 * Analisa imagem usando OpenAI Vision API
 */
export async function analyzeImage(imageBuffer, apiKey, prompt = '') {
  try {
    logger.info('Iniciando análise de imagem...', {
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

    const openai = new OpenAI({ apiKey });

    // Converter buffer para base64
    const base64Image = imageBuffer.toString('base64');
    
    logger.info('Enviando imagem para OpenAI Vision...');

    // Usar GPT-4 Vision para analisar a imagem
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || "Analise esta imagem em detalhes. Descreva exatamente o que você vê, incluindo:\n- Se for uma imagem médica (raio-X, ressonância, etc.), descreva as estruturas anatômicas visíveis\n- Qualquer texto presente na imagem\n- Objetos, pessoas, cores e elementos visuais\n- Qualquer informação relevante ou anormalidade observada\n- Se houver texto na imagem, transcreva-o completamente\n\nSeja específico e detalhado na sua análise."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    const analysis = response.choices[0].message.content;
    
    logger.info('Imagem analisada com sucesso:', {
      analysisLength: analysis.length,
      preview: analysis.substring(0, 100)
    });

    return analysis;
  } catch (error) {
    logger.error('Erro detalhado ao analisar imagem:', {
      message: error.message,
      stack: error.stack,
      bufferInfo: {
        size: imageBuffer?.length || 0,
        type: typeof imageBuffer,
        isBuffer: Buffer.isBuffer(imageBuffer)
      }
    });
    throw error;
  }
}

/**
 * Processa documento (PDF, DOC, etc.) convertendo para texto
 */
export async function processDocument(documentBuffer, filename, apiKey) {
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
    
    // Para outros documentos, tentar converter para imagem e usar Vision
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
    logger.error('Erro ao processar documento:', {
      message: error.message,
      filename,
      fileExtension: path.extname(filename)
    });
    throw error;
  }
}

/**
 * Extrai texto de PDF usando pdf-parse
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    logger.info('Iniciando extração de texto do PDF...', {
      bufferSize: pdfBuffer.length
    });

    if (!Buffer.isBuffer(pdfBuffer)) {
      throw new Error('pdfBuffer deve ser um Buffer válido');
    }

    if (pdfBuffer.length === 0) {
      throw new Error('Buffer de PDF está vazio');
    }

    // Carregar pdf-parse usando require (evita problema de ES modules)
    if (!pdfParse) {
      try {
        pdfParse = require('pdf-parse/lib/pdf-parse.js');
        logger.info('pdf-parse carregado com sucesso via require');
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
      author: info?.Author || 'Não especificado',
      preview: extractedText.substring(0, 200)
    });

    if (!extractedText || extractedText.length === 0) {
      logger.warn('PDF não contém texto extraível, pode ser escaneado ou conter apenas imagens');
      return `Este PDF contém ${numPages} página(s), mas não foi possível extrair texto diretamente. O documento pode conter apenas imagens ou ser um PDF escaneado. Tente enviar como imagem para análise.`;
    }

    // Formatar informações do PDF
    let result = '';
    
    if (info?.Title && info.Title !== 'Untitled') {
      result += `TÍTULO: ${info.Title}\n`;
    }
    
    if (info?.Author) {
      result += `AUTOR: ${info.Author}\n`;
    }
    
    if (numPages) {
      result += `PÁGINAS: ${numPages}\n`;
    }
    
    result += `\n${'='.repeat(60)}\n`;
    result += `CONTEÚDO DO DOCUMENTO:\n`;
    result += `${'='.repeat(60)}\n\n`;
    result += extractedText;

    logger.info(`Texto extraído com sucesso: ${result.length} caracteres`);
    
    return result;
  } catch (error) {
    logger.error('Erro ao extrair texto do PDF:', {
      message: error.message,
      stack: error.stack,
      bufferSize: pdfBuffer?.length || 0
    });
    
    // Se falhar a extração, tentar converter para análise de imagem
    logger.warn('Falha na extração de texto, sugerindo análise alternativa');
    return `Não foi possível extrair o texto deste PDF. O documento pode estar protegido, corrompido, ou conter apenas imagens. Por favor, tente:\n1. Converter o PDF para imagem (JPG/PNG) e enviar\n2. Tirar screenshots das páginas importantes\n3. Se for um documento de texto, copiar e colar o conteúdo`;
  }
}

/**
 * Processa mensagem com imagem: analisa e depois processa com IA
 */
export async function processImageMessageWithAI(imageBuffer, phoneNumber, apiKey, assistantId, caption = '') {
  try {
    logger.info(`Processando mensagem com imagem para ${phoneNumber}`);
    
    // 1. Analisar a imagem
    const imageAnalysis = await analyzeImage(imageBuffer, apiKey);
    logger.info(`Imagem analisada: "${imageAnalysis.substring(0, 100)}..."`);
    
    // 2. Criar prompt para análise médica profissional
    let fullMessage = `CONTEXTO: Um paciente enviou uma imagem de exame médico.

DESCRIÇÃO TÉCNICA DA IMAGEM (fornecida por sistema de visão computacional):
${imageAnalysis}`;
    
    if (caption && caption.trim()) {
      fullMessage += `\n\nCOMENTÁRIO/PERGUNTA DO PACIENTE:
"${caption}"`;
    }
    
    fullMessage += `

TAREFA:
Como assistente médico especializado, analise as informações da imagem acima e forneça:

1. Uma análise médica profissional dos achados descritos
2. Interpretação clínica relevante
3. Possíveis implicações ou observações importantes
4. Se houver comentário do paciente, responda também à pergunta dele

IMPORTANTE: 
- Baseie-se EXCLUSIVAMENTE na descrição técnica fornecida acima
- Forneça uma resposta médica clara, profissional e objetiva
- Não peça mais informações se não forem essenciais
- Se a imagem não mostrar anormalidades, confirme isso de forma tranquilizadora

Forneça sua análise médica:`;

    
    logger.info('===== MENSAGEM COMPLETA PARA O ASSISTENTE =====');
    logger.info(fullMessage);
    logger.info('===============================================');
    
    // 3. Processar com o assistente
    const aiResponse = await processMessageWithAI(fullMessage, phoneNumber, apiKey, assistantId);
    
    logger.info('===== RESPOSTA DO ASSISTENTE =====');
    logger.info(aiResponse);
    logger.info('===================================');
    
    return {
      imageAnalysis,
      aiResponse,
      caption
    };
  } catch (error) {
    logger.error('Erro ao processar mensagem com imagem:', error);
    throw error;
  }
}

/**
 * Processa mensagem com documento: extrai conteúdo e processa com IA
 */
export async function processDocumentMessageWithAI(documentBuffer, filename, phoneNumber, apiKey, assistantId, caption = '') {
  try {
    logger.info(`Processando documento para ${phoneNumber}: ${filename}`);
    
    // 1. Processar o documento
    const documentContent = await processDocument(documentBuffer, filename, apiKey);
    logger.info(`Documento processado: "${documentContent.substring(0, 100)}..."`);
    
    // 2. Criar prompt para análise médica do documento
    let fullMessage = `CONTEXTO: Um paciente enviou um documento médico (${filename}).

CONTEÚDO EXTRAÍDO DO DOCUMENTO:
${documentContent}`;
    
    if (caption && caption.trim()) {
      fullMessage += `\n\nCOMENTÁRIO/PERGUNTA DO PACIENTE:
"${caption}"`;
    }
    
    fullMessage += `

TAREFA:
Como assistente médico especializado, analise o conteúdo do documento acima e forneça:

1. Uma interpretação clara dos dados apresentados
2. Explicação dos termos técnicos ou resultados, se houver
3. Observações clínicas relevantes
4. Se houver comentário do paciente, responda à pergunta dele

IMPORTANTE:
- Baseie-se EXCLUSIVAMENTE no conteúdo extraído acima
- Forneça uma resposta médica profissional e compreensível
- Seja objetivo e direto

Forneça sua análise:`;
    
    // 3. Processar com o assistente
    const aiResponse = await processMessageWithAI(fullMessage, phoneNumber, apiKey, assistantId);
    
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
 * Processa mensagem de áudio: transcreve e depois processa com IA
 */
export async function processAudioMessageWithAI(audioBuffer, phoneNumber, apiKey, assistantId) {
  try {
    logger.info(`Processando mensagem de áudio para ${phoneNumber}`);
    
    // 1. Transcrever o áudio
    const transcription = await transcribeAudio(audioBuffer, apiKey);
    logger.info(`Áudio transcrito: "${transcription.substring(0, 100)}..."`);
    
    // 2. Processar a transcrição com o assistente
    const aiResponse = await processMessageWithAI(transcription, phoneNumber, apiKey, assistantId);
    
    return {
      transcription,
      aiResponse
    };
  } catch (error) {
    logger.error('Erro ao processar mensagem de áudio:', error);
    throw error;
  }
}

/**
 * Processa uma mensagem usando OpenAI Assistants API
 */
export async function processMessageWithAI(messageText, phoneNumber, apiKey, assistantId) {
  try {
    const openai = new OpenAI({ apiKey });

    // Obter ou criar thread para este usuário
    let threadId = userThreads.get(phoneNumber);
    
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      userThreads.set(phoneNumber, threadId);
      logger.info(`Nova thread criada para ${phoneNumber}: ${threadId}`);
    }

    // Log da mensagem sendo enviada
    logger.info('===== ENVIANDO MENSAGEM PARA THREAD =====');
    logger.info(`Thread ID: ${threadId}`);
    logger.info(`Assistant ID: ${assistantId}`);
    logger.info(`Mensagem (${messageText.length} caracteres):`, messageText);
    logger.info('==========================================');
    
    // Adicionar mensagem do usuário à thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: messageText
    });

    // Executar o assistente
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId
    });

    // Aguardar conclusão do run
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Poll até completar (máximo 30 segundos)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (runStatus.status !== 'completed' && attempts < maxAttempts) {
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
        throw new Error(`Run falhou com status: ${runStatus.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      throw new Error('Timeout aguardando resposta do assistente');
    }

    // Obter mensagens da thread
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Pegar a última mensagem do assistente
    const assistantMessage = messages.data.find(
      msg => msg.role === 'assistant' && msg.run_id === run.id
    );

    if (!assistantMessage || !assistantMessage.content[0]?.text) {
      throw new Error('Nenhuma resposta do assistente');
    }

    const response = assistantMessage.content[0].text.value;
    
    logger.info('===== RESPOSTA RECEBIDA DO ASSISTENTE =====');
    logger.info(`Phone: ${phoneNumber}`);
    logger.info(`Run ID: ${run.id}`);
    logger.info(`Resposta (${response.length} caracteres):`, response);
    logger.info('============================================');
    
    return response;

  } catch (error) {
    logger.error('Erro ao processar com OpenAI:', error);
    
    // Em caso de erro, retornar mensagem padrão
    if (error.status === 401) {
      logger.error('API Key inválida');
      return null;
    }
    
    if (error.status === 404) {
      logger.error('Assistant ID não encontrado');
      return null;
    }

    return 'Desculpe, estou com dificuldades para processar sua mensagem no momento. Tente novamente em instantes.';
  }
}

/**
 * Limpa a thread de um usuário
 */
export function clearUserThread(phoneNumber) {
  userThreads.delete(phoneNumber);
  logger.info(`Thread removida para ${phoneNumber}`);
}

/**
 * Limpa todas as threads
 */
export function clearAllThreads() {
  userThreads.clear();
  logger.info('Todas as threads foram limpas');
}

/**
 * Obtém estatísticas das threads ativas
 */
export function getThreadsStats() {
  return {
    activeThreads: userThreads.size,
    threads: Array.from(userThreads.entries()).map(([phone, threadId]) => ({
      phoneNumber: phone,
      threadId
    }))
  };
}

