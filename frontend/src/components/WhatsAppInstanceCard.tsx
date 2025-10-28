import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WhatsAppInstance, WhatsAppConfig } from '@/types/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { Check, Loader, LogOut, Bot, Trash2, Settings } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import API_CONFIG from '@/config/api';
import AgentConfigModal, { AgentConfig } from './AgentConfigModal';

interface WhatsAppInstanceCardProps {
  instance: WhatsAppInstance;
  onGenerateQR: (instanceId: number) => void;
  onSaveConfig: (instanceId: number, config: WhatsAppConfig) => void;
  onDisconnect: (instanceId: number) => void;
  onRemove?: (instanceId: number) => void;
  isGeneratingQR?: boolean;
  isRemoving?: boolean;
}

const WhatsAppInstanceCard = ({ 
  instance, 
  onGenerateQR, 
  onSaveConfig,
  onDisconnect,
  onRemove,
  isGeneratingQR = false,
  isRemoving = false
}: WhatsAppInstanceCardProps) => {
  const [config, setConfig] = useState<WhatsAppConfig>({
    name: instance.name,
    apiKey: instance.apiKey || '',
    assistantId: instance.assistantId || '',
  });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | undefined>(undefined);
  const { toast } = useToast();
  const { socket } = useSocket();
  const { authenticatedFetch } = useAuthenticatedFetch();

  // Carregar configuração do backend quando a instância conectar
  useEffect(() => {
    if (instance.isConnected) {
      fetchConfig();
    }
  }, [instance.isConnected, instance.id]);

  // Buscar configuração do backend
  const fetchConfig = async () => {
    try {
      const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSION_CONFIG(`instance_${instance.id}`)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          setConfig({
            name: data.config.name || instance.name,
            apiKey: data.config.apiKey || '',
            assistantId: data.config.assistantId || '',
          });
          setAgentConfig({
            aiProvider: data.config.aiProvider || 'gemini',
            apiKey: data.config.apiKey || '',
            model: data.config.model,
            systemPrompt: data.config.systemPrompt,
            temperature: data.config.temperature,
            assistantId: data.config.assistantId,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    }
  };

  const handleSaveAgentConfig = async (newConfig: AgentConfig) => {
    try {
          const payload = {
            name: config.name || instance.name || `Instância ${instance.id}`,
            aiProvider: newConfig.aiProvider,
            apiKey: newConfig.apiKey,
            model: newConfig.model || 'gemini-2.0-flash-exp',
            systemPrompt: newConfig.systemPrompt || '',
            temperature: newConfig.temperature !== undefined ? newConfig.temperature : 1.0,
            assistantId: newConfig.assistantId || undefined,
            ttsEnabled: newConfig.ttsEnabled || false,
            ttsVoice: newConfig.ttsVoice || 'Aoede',
            enabled: true
          };

      console.log('Enviando configuração:', payload);

      // Salvar no backend via API
      const response = await authenticatedFetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSION_CONFIG(`instance_${instance.id}`)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Erro do servidor:', errorData);
        throw new Error(errorData.error || 'Erro ao salvar configuração');
      }

      // Atualizar estado local
      setAgentConfig(newConfig);
      setConfig(prev => ({
        ...prev,
        apiKey: newConfig.apiKey,
        assistantId: newConfig.assistantId || ''
      }));

      await onSaveConfig(instance.id, {
        ...config,
        apiKey: newConfig.apiKey,
        assistantId: newConfig.assistantId || ''
      });
      
      // Também enviar via socket para garantir sincronização
      if (socket) {
        socket.emit('save-config', {
          sessionId: `instance_${instance.id}`,
          config: newConfig
        });
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw error;
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnect(instance.id);
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro ao desconectar",
        description: "Não foi possível desconectar a instância.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
    if (isDisconnecting) {
      return (
        <Badge className="bg-red-500 text-white flex items-center gap-1">
          <Loader size={12} className="animate-spin" />
          Desconectando...
        </Badge>
      );
    }
    if (instance.isReconnecting) {
      return (
        <Badge className="bg-yellow-500 text-white flex items-center gap-1">
          <Loader size={12} className="animate-spin" />
          Reconectando...
        </Badge>
      );
    }
    if (instance.isConnected) {
      return (
        <Badge className="bg-primary text-primary-foreground flex items-center gap-1">
          <Check size={12} />
          Conectado
        </Badge>
      );
    }
    return <Badge variant="secondary">Desconectado</Badge>;
  };

  // Determinar o nome de exibição da instância
  const displayName = instance.name !== `Instância ${instance.id}` && instance.name ? 
    instance.name : 
    `Instância ${instance.id}`;

  return (
    <Card className={`w-full h-fit animate-fade-in hover:shadow-lg transition-all duration-300 bg-dark-navy-950/95 backdrop-blur-sm border border-mint-glow/30 rounded-2xl ${
      isRemoving ? 'animate-fade-out-scale opacity-0' : ''
    }`}>
      <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {displayName}
          </CardTitle>
          {getStatusBadge()}
        </div>
        {instance.phoneNumber && (
          <p className="text-xs sm:text-sm text-mint-glow/70">{instance.phoneNumber}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Estado Inicial - Não Conectado */}
        {!instance.isConnected && !isDisconnecting && !instance.isReconnecting && (
          <div className="text-center space-y-3 sm:space-y-4">
            {/* Ícone WhatsApp */}
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-mint-glow/20 to-secondary/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-mint-glow" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.479 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
            </div>
            
            {/* Botão Gerar QR Code */}
            <Button
              onClick={() => onGenerateQR(instance.id)}
              disabled={isGeneratingQR}
              className="w-full bg-gradient-to-r from-mint-glow to-secondary hover:from-mint-glow/90 hover:to-secondary/90 text-dark-navy transition-all duration-300 rounded-xl h-10 sm:h-11 text-sm sm:text-base"
            >
              Gerar QR Code
            </Button>
            
            {/* Botão Remover Instância */}
            {onRemove && (
              <Button
                onClick={() => onRemove(instance.id)}
                variant="outline"
                className="w-full btn-destructive rounded-xl flex items-center gap-2 h-10 sm:h-11 text-sm sm:text-base"
              >
                <Trash2 size={14} className="sm:w-4 sm:h-4" />
                Remover Instância
              </Button>
            )}
            
            <p className="text-xs text-mint-glow/50">
              Clique para iniciar conexão
            </p>
          </div>
        )}

        {/* Estado Desconectando */}
        {isDisconnecting && (
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
              <Loader size={20} className="sm:w-6 sm:h-6 text-red-600 animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-base sm:text-lg font-semibold text-red-700">Desconectando...</p>
              <p className="text-xs sm:text-sm text-gray-600">Encerrando a sessão do WhatsApp</p>
            </div>
          </div>
        )}

        {/* Estado Reconectando */}
        {instance.isReconnecting && !isDisconnecting && (
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center">
              <Loader size={20} className="sm:w-6 sm:h-6 text-yellow-600 animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-base sm:text-lg font-semibold text-yellow-700">Reconectando...</p>
              <p className="text-xs sm:text-sm text-gray-600">Tentando restaurar a conexão automaticamente</p>
            </div>
            <div className="text-xs text-yellow-600/70 bg-yellow-50 p-2 sm:p-3 rounded-lg">
              A conexão foi perdida e o sistema está tentando reconectar automaticamente
            </div>
            <Button
              onClick={() => {
                socket?.emit('generate-qr', { sessionId: `instance_${instance.id}` });
              }}
              variant="outline"
              className="w-full border-yellow-400/50 text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-400 bg-white/50 rounded-xl h-10 sm:h-11 text-sm sm:text-base"
            >
              Tentar Reconectar
            </Button>
          </div>
        )}

        {/* Estado Conectado - Botão para Configurar */}
        {instance.isConnected && !isDisconnecting && (
          <div className="space-y-3 sm:space-y-4">
            {/* Status da Configuração */}
            {agentConfig && agentConfig.apiKey && (
              <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-mint-glow">
                        Assistente Configurado
                      </p>
                      <p className="text-xs text-mint-glow/60">
                        {agentConfig.aiProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'} • {agentConfig.model || 'GPT Assistant'}
                      </p>
                    </div>
                  </div>
                  <Check className="w-5 h-5 text-secondary" />
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <Button
              onClick={() => setIsAgentModalOpen(true)}
              className="w-full bg-gradient-to-r from-mint-glow to-secondary hover:from-mint-glow/90 hover:to-secondary/90 text-dark-navy transition-all duration-300 rounded-xl h-10 sm:h-11 text-sm sm:text-base flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {agentConfig && agentConfig.apiKey ? 'Editar Agente' : 'Configurar Agente'}
            </Button>

            <Button
              onClick={handleDisconnect}
              variant="outline"
              className="w-full btn-destructive rounded-xl flex items-center gap-2 h-10 sm:h-11 text-sm sm:text-base"
            >
              <LogOut size={14} className="sm:w-4 sm:h-4" />
              Desconectar
            </Button>
          </div>
        )}

        {/* Connection Info */}
        {instance.lastConnected && !isDisconnecting && (
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-mint-glow/20">
            Última conexão: {instance.lastConnected.toLocaleString()}
          </div>
        )}
      </CardContent>

      {/* Modal de Configuração do Agente */}
      <AgentConfigModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        onSave={handleSaveAgentConfig}
        initialConfig={agentConfig}
        instanceName={displayName}
      />
    </Card>
  );
};

export default WhatsAppInstanceCard;
