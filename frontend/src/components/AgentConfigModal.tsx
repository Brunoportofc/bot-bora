import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Save, Sparkles, Thermometer, FileText, Eye, EyeOff, Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export interface AgentConfig {
  aiProvider: 'gemini' | 'openai';
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  assistantId?: string; // Para OpenAI
  ttsEnabled?: boolean; // Habilitar TTS
  ttsVoice?: string; // Voz do TTS
}

interface AgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AgentConfig) => Promise<void>;
  initialConfig?: AgentConfig;
  instanceName: string;
}

const GEMINI_MODELS = [
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)', description: 'Mais rápido, multimodal, recomendado' },
  { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', description: 'Balanceado, multimodal' },
  { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash', description: 'Rápido, econômico' },
  { value: 'gemini-pro', label: 'Gemini Pro', description: 'Modelo base estável' },
];

const GEMINI_VOICES = [
  { value: 'Aoede', label: 'Aoede', gender: 'Feminino' },
  { value: 'Kore', label: 'Kore', gender: 'Feminino' },
  { value: 'Charon', label: 'Charon', gender: 'Masculino' },
  { value: 'Fenrir', label: 'Fenrir', gender: 'Masculino' },
  { value: 'Puck', label: 'Puck', gender: 'Não-binário' },
  { value: 'Orus', label: 'Orus', gender: 'Masculino' },
];

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente virtual prestativo e profissional. Responda de forma clara, objetiva e amigável às perguntas dos usuários.

Diretrizes:
- Seja sempre educado e respeitoso
- Forneça respostas precisas e úteis
- Se não souber algo, admita honestamente
- Adapte seu tom ao contexto da conversa
- Mantenha as respostas concisas quando possível`;

const AgentConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  instanceName
}: AgentConfigModalProps) => {
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(initialConfig?.aiProvider || 'gemini');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [model, setModel] = useState(initialConfig?.model || 'gemini-2.0-flash-exp');
  const [systemPrompt, setSystemPrompt] = useState(initialConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState<number>(initialConfig?.temperature || 1.0);
  const [assistantId, setAssistantId] = useState(initialConfig?.assistantId || '');
  const [ttsEnabled, setTtsEnabled] = useState(initialConfig?.ttsEnabled || false);
  const [ttsVoice, setTtsVoice] = useState(initialConfig?.ttsVoice || 'Aoede');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initialConfig) {
      setAiProvider(initialConfig.aiProvider || 'gemini');
      setApiKey(initialConfig.apiKey || '');
      setModel(initialConfig.model || 'gemini-2.0-flash-exp');
      setSystemPrompt(initialConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT);
      setTemperature(initialConfig.temperature || 1.0);
      setAssistantId(initialConfig.assistantId || '');
      setTtsEnabled(initialConfig.ttsEnabled || false);
      setTtsVoice(initialConfig.ttsVoice || 'Aoede');
    }
  }, [initialConfig]);

  const handleSave = async () => {
    // Validações
    if (!apiKey.trim()) {
      toast({
        title: "API Key obrigatória",
        description: "Por favor, informe a API Key.",
        variant: "destructive",
      });
      return;
    }

    if (aiProvider === 'openai' && !assistantId.trim()) {
      toast({
        title: "Assistant ID obrigatório",
        description: "Para OpenAI, o Assistant ID é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const config: AgentConfig = {
        aiProvider,
        apiKey: apiKey.trim(),
        model: aiProvider === 'gemini' ? model : undefined,
        systemPrompt: aiProvider === 'gemini' ? systemPrompt.trim() : undefined,
        temperature: aiProvider === 'gemini' ? temperature : undefined,
        assistantId: aiProvider === 'openai' ? assistantId.trim() : undefined,
        ttsEnabled: aiProvider === 'gemini' ? ttsEnabled : undefined,
        ttsVoice: aiProvider === 'gemini' && ttsEnabled ? ttsVoice : undefined,
      };

      await onSave(config);

      toast({
        title: "Configuração salva",
        description: `Assistente ${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} configurado com sucesso!`,
      });

      onClose();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefault = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setTemperature(1.0);
    setTtsEnabled(false);
    setTtsVoice('Aoede');
    toast({
      title: "Configurações resetadas",
      description: "Todas as configurações voltaram aos valores padrão.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-dark-navy-950/95 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-dark-navy-950 border border-mint-glow/30 backdrop-blur-lg shadow-2xl mx-auto">
          <DialogHeader className="px-6 pt-6 space-y-2">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-mint-glow via-secondary to-primary bg-clip-text text-transparent flex items-center gap-2">
              <Bot className="w-6 h-6 text-mint-glow" />
              Editar Agente
            </DialogTitle>
            <DialogDescription className="text-mint-glow/70">
              Configure o assistente de IA para {instanceName}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-6">
            {/* Tabs de Provedor */}
            <Tabs value={aiProvider} onValueChange={(v) => setAiProvider(v as 'gemini' | 'openai')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-dark-navy-900/50">
                <TabsTrigger value="gemini" className="data-[state=active]:bg-mint-glow/20 data-[state=active]:text-mint-glow">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Google Gemini
                </TabsTrigger>
                <TabsTrigger value="openai" className="data-[state=active]:bg-mint-glow/20 data-[state=active]:text-mint-glow">
                  <Bot className="w-4 h-4 mr-2" />
                  OpenAI
                </TabsTrigger>
              </TabsList>

              {/* Configurações Gemini */}
              <TabsContent value="gemini" className="space-y-4 mt-4">
                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="gemini-api-key" className="text-mint-glow flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Gemini API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="gemini-api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="AIza..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10 bg-[#0a0e1a] border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/40"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4 text-mint-glow/60" />
                      ) : (
                        <Eye className="w-4 h-4 text-mint-glow/60" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-mint-glow/50">
                    Obtenha gratuitamente em{' '}
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-mint-glow hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>

                {/* Modelo Gemini */}
                <div className="space-y-2">
                  <Label htmlFor="gemini-model" className="text-mint-glow">Modelo Gemini</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-dark-navy-900 border-mint-glow/30 text-mint-glow">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent className="bg-dark-navy-900 border-mint-glow/30">
                      {GEMINI_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-mint-glow hover:bg-mint-glow/10">
                          <div>
                            <div className="font-medium">{m.label}</div>
                            <div className="text-xs text-mint-glow/60">{m.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperatura */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="temperature" className="text-mint-glow flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      Temperatura: {temperature.toFixed(1)}
                    </Label>
                    <span className="text-xs text-mint-glow/60">
                      {temperature < 0.7 ? 'Preciso' : temperature < 1.3 ? 'Balanceado' : 'Criativo'}
                    </span>
                  </div>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[temperature]}
                    onValueChange={([value]) => setTemperature(value)}
                    className="py-2"
                  />
                  <p className="text-xs text-mint-glow/50">
                    Controla a criatividade das respostas. Valores baixos são mais precisos, altos são mais criativos.
                  </p>
                </div>

                {/* Prompt do Sistema */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system-prompt" className="text-mint-glow flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Prompt do Sistema
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetToDefault}
                      className="text-xs text-mint-glow/60 hover:text-mint-glow hover:bg-mint-glow/10"
                    >
                      Resetar padrão
                    </Button>
                  </div>
                  <Textarea
                    id="system-prompt"
                    placeholder="Instruções para o modelo sobre como ele deve se comportar..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    className="resize-none bg-[#0a0e1a] border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/40 font-mono text-sm"
                  />
                  <p className="text-xs text-mint-glow/50">
                    Instrua o modelo sobre como ele deve se comportar, seu tom, personalidade e diretrizes.
                  </p>
                </div>

                {/* Configurações de TTS */}
                <div className="space-y-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" />
                      <Label htmlFor="tts-enabled" className="text-sm font-medium text-mint-glow cursor-pointer">
                        Respostas em Áudio (TTS)
                      </Label>
                    </div>
                    <Switch
                      id="tts-enabled"
                      checked={ttsEnabled}
                      onCheckedChange={setTtsEnabled}
                    />
                  </div>

                  {ttsEnabled && (
                    <div className="space-y-2 animate-fade-in">
                      <Label htmlFor="tts-voice" className="text-sm text-mint-glow">
                        Voz do Assistente
                      </Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger className="bg-dark-navy-900 border-mint-glow/30 text-mint-glow">
                          <SelectValue placeholder="Selecione a voz" />
                        </SelectTrigger>
                        <SelectContent className="bg-dark-navy-900 border-mint-glow/30">
                          {GEMINI_VOICES.map((voice) => (
                            <SelectItem key={voice.value} value={voice.value} className="text-mint-glow hover:bg-mint-glow/10">
                              <div>
                                <div className="font-medium">{voice.label}</div>
                                <div className="text-xs text-mint-glow/60">{voice.gender}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-mint-glow/50">
                        ℹ️ O TTS funciona com qualquer modelo Gemini. Recomendamos Gemini 2.0 Flash para melhor performance.
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-mint-glow/50">
                    {ttsEnabled ? 
                      '🎤 O assistente enviará áudio quando achar necessário ou quando o cliente pedir.' :
                      'Ative para permitir que o assistente envie mensagens em áudio.'
                    }
                  </p>
                </div>
              </TabsContent>

              {/* Configurações OpenAI */}
              <TabsContent value="openai" className="space-y-4 mt-4">
                {/* OpenAI API Key */}
                <div className="space-y-2">
                  <Label htmlFor="openai-api-key" className="text-mint-glow flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    OpenAI API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="openai-api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10 bg-dark-navy-900 border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/40"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4 text-mint-glow/60" />
                      ) : (
                        <Eye className="w-4 h-4 text-mint-glow/60" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-mint-glow/50">
                    Obtenha em{' '}
                    <a 
                      href="https://platform.openai.com/api-keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-mint-glow hover:underline"
                    >
                      platform.openai.com
                    </a>
                  </p>
                </div>

                {/* Assistant ID */}
                <div className="space-y-2">
                  <Label htmlFor="assistant-id" className="text-mint-glow flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    Assistant ID
                  </Label>
                  <Input
                    id="assistant-id"
                    placeholder="asst_..."
                    value={assistantId}
                    onChange={(e) => setAssistantId(e.target.value)}
                    className="bg-dark-navy-900 border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/40"
                  />
                  <p className="text-xs text-mint-glow/50">
                    Crie seu assistente em{' '}
                    <a 
                      href="https://platform.openai.com/assistants" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-mint-glow hover:underline"
                    >
                      platform.openai.com/assistants
                    </a>
                  </p>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    <strong>Nota:</strong> Com OpenAI, o prompt do sistema e configurações devem ser definidas no Assistant criado na plataforma OpenAI.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4 border-t border-mint-glow/20">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-mint-glow/30 text-mint-glow hover:bg-mint-glow/10"
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-mint-glow to-secondary hover:from-mint-glow/90 hover:to-secondary/90 text-dark-navy"
              >
                {isSaving ? (
                  <>
                    <Bot className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default AgentConfigModal;

