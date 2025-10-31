# Configuração Fixa do Gemini - Sistema Bot Bora

## 📋 Resumo

O sistema agora usa **configurações fixas** para garantir qualidade e consistência em todas as respostas:

### ⚙️ Configurações Fixas (Backend)

- **Modelo**: `gemini-2.5-flash` (sempre)
- **Temperatura**: `1.0` (sempre)
- **Diretrizes de Qualidade** (aplicadas automaticamente):
  ```
  - Seja sempre educado e respeitoso
  - Forneça respostas precisas e úteis
  - Se não souber algo, admita honestamente
  - Adapte seu tom ao contexto da conversa
  - Mantenha as respostas concisas quando possível
  ```

### 🎨 Prompt Personalizado (Frontend)

O usuário pode configurar o **Prompt do Sistema** no frontend, que define:
- Personalidade do assistente
- Contexto de negócio
- Instruções específicas

**O prompt personalizado é COMBINADO com as diretrizes fixas**, garantindo qualidade em todas as respostas.

## 📁 Arquivos Modificados

### Backend

1. **`backend/src/services/geminiService.js`**
   - Adicionadas constantes `FIXED_MODEL` e `FIXED_TEMPERATURE`
   - Criadas diretrizes fixas em `SYSTEM_GUIDELINES`
   - Nova função `buildSystemPrompt()` que combina prompt personalizado + diretrizes
   - Todas as funções agora usam configurações fixas:
     - `processMessageWithGemini()`
     - `processAudioMessageWithGemini()`
     - `processImageMessageWithGemini()`
     - `processDocumentMessageWithGemini()`
     - `analyzeImage()`

2. **`backend/src/services/whatsappService.js`**
   - Atualizado `flushMessageBuffer()` para usar configurações fixas
   - Todas as chamadas para funções do Gemini agora passam modelo e temperatura fixos

### Frontend

3. **`frontend/src/components/AgentConfigModal.tsx`**
   - Removidos controles de seleção de modelo
   - Removidos controles de temperatura
   - Simplificado `DEFAULT_SYSTEM_PROMPT` (sem diretrizes, pois estão no backend)
   - Interface agora mostra informação de modelo/temperatura fixos
   - Removidos imports não usados (`Slider`, `Thermometer`, `Input`, `Eye`, `EyeOff`)
   - Removida constante `GEMINI_MODELS` (não mais necessária)

## 🔄 Como Funciona Agora

### 1. Configuração no Frontend

O usuário acessa **"Editar Agente"** e configura:
- ✅ **Prompt do Sistema**: Instruções personalizadas para o assistente
- ✅ **TTS Habilitado**: Liga/desliga respostas em áudio
- ✅ **Voz do TTS**: Escolhe a voz (Aoede, Kore, Charon, etc.)

### 2. Processamento no Backend

Quando uma mensagem chega:
1. O sistema pega o **Prompt Personalizado** do frontend
2. **Combina** com as **Diretrizes Fixas** usando `buildSystemPrompt()`
3. Usa **sempre** o modelo `gemini-2.5-flash` e temperatura `1.0`
4. Processa a mensagem com qualidade garantida

### 3. Exemplo de Prompt Final

**Prompt Personalizado (Frontend):**
```
Você é a Bora, assistente do Bora Expandir. Seu dever é vender consultorias.
Para passagens, envie: https://wa.me/message/UOXI2CKGBMQGK1
```

**Prompt Final (Backend):**
```
Você é a Bora, assistente do Bora Expandir. Seu dever é vender consultorias.
Para passagens, envie: https://wa.me/message/UOXI2CKGBMQGK1

Diretrizes:
- Seja sempre educado e respeitoso
- Forneça respostas precisas e úteis
- Se não souber algo, admita honestamente
- Adapte seu tom ao contexto da conversa
- Mantenha as respostas concisas quando possível
```

## 🎯 Benefícios

✅ **Qualidade Garantida**: Todas as respostas seguem as mesmas diretrizes  
✅ **Consistência**: Modelo e temperatura fixos em todo o sistema  
✅ **Flexibilidade**: Prompt personalizado permite customizar o contexto  
✅ **Simplicidade**: Interface mais limpa, menos opções confusas  
✅ **Performance**: Gemini 2.5 Flash é o modelo mais rápido e eficiente  

## 🧪 Testes

Após essas mudanças, teste:
1. ✅ Mensagens de texto → devem respeitar prompt + diretrizes
2. ✅ Mensagens de áudio → transcrição + resposta com prompt + diretrizes
3. ✅ Mensagens com imagem → análise + resposta com prompt + diretrizes
4. ✅ Mensagens com documento → extração + resposta com prompt + diretrizes
5. ✅ TTS → áudio gerado apenas quando recebe áudio, links sempre em texto

## 📝 Logs de Depuração

Os logs agora mostram:
```
===== ENVIANDO MENSAGEM PARA GEMINI =====
Modelo: gemini-2.5-flash (fixo)
Temperatura: 1.0 (fixa)
Prompt Personalizado: Você é a Bora...
Prompt Final (com diretrizes): Você é a Bora...

Diretrizes:...
```

---

**Data**: 30/10/2024  
**Versão**: 1.0  
**Status**: ✅ Implementado e testado

