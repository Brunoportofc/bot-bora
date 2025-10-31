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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Save, Sparkles, FileText, Volume2 } from 'lucide-react';
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

const GEMINI_VOICES = [
  { value: 'Aoede', label: 'Aoede', gender: 'Feminino' },
  { value: 'Kore', label: 'Kore', gender: 'Feminino' },
  { value: 'Charon', label: 'Charon', gender: 'Masculino' },
  { value: 'Fenrir', label: 'Fenrir', gender: 'Masculino' },
  { value: 'Puck', label: 'Puck', gender: 'Não-binário' },
  { value: 'Orus', label: 'Orus', gender: 'Masculino' },
];

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente virtual prestativo e profissional. Responda de forma clara, objetiva e amigável às perguntas dos usuários.`;

const AgentConfigModal = ({
  isOpen,
  onClose,
  onSave,
  initialConfig,
  instanceName
}: AgentConfigModalProps) => {
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>(initialConfig?.aiProvider || 'gemini');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [systemPrompt, setSystemPrompt] = useState(initialConfig?.systemPrompt || DEFAULT_SYSTEM_PROMPT);
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
      setSystemPrompt(initialConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT);
      setAssistantId(initialConfig.assistantId || '');
      setTtsEnabled(initialConfig.ttsEnabled || false);
      setTtsVoice(initialConfig.ttsVoice || 'Aoede');
    }
  }, [initialConfig]);

  const handleSave = async () => {
    // Validações
    

    setIsSaving(true);
    try {
      const config: AgentConfig = {
        aiProvider,
        apiKey: apiKey.trim() || undefined, // Envia apenas se preenchido, senão usa a do .env
        model: 'gemini-2.5-flash', // Modelo fixo no backend
        systemPrompt: aiProvider === 'gemini' ? systemPrompt.trim() : undefined,
        temperature: 1.0, // Temperatura fixa no backend
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
        <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 border border-[#243B6B]/20 backdrop-blur-xl shadow-2xl mx-auto">
          <DialogHeader className="px-6 pt-6 space-y-2">
            <DialogTitle className="text-2xl font-bold text-[#243B6B] flex items-center gap-2">
              <Bot className="w-6 h-6 text-[#243B6B]" />
              Editar Agente
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Configure o assistente de IA para {instanceName}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-6">
            {/* Tabs de Provedor */}
            <Tabs value={aiProvider} onValueChange={(v) => setAiProvider(v as 'gemini' )} className="w-full ">
              <TabsList className="items-center justify-center w-full grid-cols-2 bg-white/70 border border-[#243B6B]/20 backdrop-blur-md">
                <TabsTrigger value="gemini" className="data-[state=active]:bg-[#243B6B] data-[state=active]:text-white">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Google Gemini
                </TabsTrigger>
               
              </TabsList>

              {/* Configurações Gemini */}
              <TabsContent value="gemini" className="space-y-4 mt-4">              
                              
                {/* Prompt do Sistema */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="system-prompt" className="text-[#243B6B] flex items-center gap-2 font-medium">
                      <FileText className="w-4 h-4" />
                      Prompt do Sistema
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetToDefault}
                      className="text-xs text-gray-600 hover:text-[#243B6B] hover:bg-[#243B6B]/10"
                    >
                      Resetar padrão
                    </Button>
                  </div>
                  <Textarea
                    id="system-prompt"
                    placeholder="Instruções personalizadas para o assistente..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    className="resize-none bg-[#243B6B] border-[#243B6B] focus:border-[#1e3257] text-white placeholder:text-white/60 font-mono text-sm shadow-inner"
                  />
                  <p className="text-xs text-gray-500">
                    Instrua o modelo sobre como ele deve se comportar, seu tom, personalidade e diretrizes.
                  </p>
                </div>

                {/* Configurações de TTS */}
                <div className="space-y-4 p-4 bg-[#243B6B]/5 border border-[#243B6B]/20 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-[#243B6B]" />
                      <Label htmlFor="tts-enabled" className="text-sm font-medium text-[#243B6B] cursor-pointer">
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
                      <Label htmlFor="tts-voice" className="text-sm text-[#243B6B] font-medium">
                        Voz do Assistente
                      </Label>
                      <Select value={ttsVoice} onValueChange={setTtsVoice}>
                        <SelectTrigger className="bg-white/90 backdrop-blur-sm border-[#243B6B]/30 text-gray-900 hover:bg-white transition-colors">
                          <SelectValue placeholder="Selecione a voz" />
                        </SelectTrigger>
                        <SelectContent 
                          className="bg-white/95 backdrop-blur-md border-[#243B6B]/20 shadow-xl"
                          side="bottom"
                          sideOffset={4}
                        >
                          {GEMINI_VOICES.map((voice) => (
                            <SelectItem 
                              key={voice.value} 
                              value={voice.value} 
                              className="text-gray-900 hover:bg-[#243B6B]/10 focus:bg-[#243B6B]/10 cursor-pointer"
                            >
                              <div>
                                <div className="font-medium">{voice.label}</div>
                                <div className="text-xs text-gray-600">{voice.gender}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        ℹ️ O TTS funciona perfeitamente com o Gemini 2.5 Flash configurado no sistema.
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-600">
                    {ttsEnabled ? 
                      'Ative para permitir que o assistente envie mensagens em áudio.' :
                      'Ative para permitir que o assistente envie mensagens em áudio.'
                    }
                  </p>
                </div>
              </TabsContent>

              
            </Tabs>

            {/* Botões de Ação */}
            <div className="flex gap-3 pt-4 border-t border-[#243B6B]/20">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 btn-destructive rounded-xl"
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 btn-new-instance rounded-xl"
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

