import { useState, useEffect, useCallback } from 'react';
import { WhatsAppInstance } from '@/types/whatsapp';
import { useSocket } from '@/contexts/SocketContext';
import { ConnectionState } from '@/components/WhatsAppConnectionModal';
import API_CONFIG from '@/config/api';

interface ModalState {
  isOpen: boolean;
  instanceId: number | null;
  connectionState: ConnectionState;
  errorMessage?: string;
}

export const useWhatsAppInstances = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isGeneratingQR, setIsGeneratingQR] = useState<number | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    instanceId: null,
    connectionState: 'generating'
  });
  const { generateQR, logout } = useSocket();

  // Inicializar instâncias
  useEffect(() => {
    const initialInstances: WhatsAppInstance[] = [1, 2, 3, 4].map(id => ({
      id,
      name: `Instância ${id}`,
      isConnected: false,
      apiKey: '',
      assistantId: ''
    }));
    setInstances(initialInstances);

    // Verificar status das instâncias no backend
    checkInstancesStatus();

    // Verificar periodicamente (a cada 15 segundos) para garantir sincronização
    const intervalId = setInterval(() => {
      checkInstancesStatus();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  // Verificar status de uma instância específica
  const checkInstanceStatus = async (instanceId: number) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSION_STATUS(`instance_${instanceId}`)}`);
      const data = await response.json();
      
      if (data.connected && data.user) {
        setInstances(prev => prev.map(instance => 
          instance.id === instanceId ? {
            ...instance,
            isConnected: true,
            phoneNumber: data.user.phoneNumber || data.user.number,
            lastConnected: new Date()
          } : instance
        ));
      }
    } catch (error) {
      console.error(`Erro ao verificar status da instância ${instanceId}:`, error);
    }
  };

  // Verificar status de todas as instâncias
  const checkInstancesStatus = async () => {
    try {
      for (let i = 1; i <= 4; i++) {
        await checkInstanceStatus(i);
      }
    } catch (error) {
      console.error('Erro ao verificar status das instâncias:', error);
    }
  };

  // Listener para eventos do WhatsApp
  useEffect(() => {
    const handleQR = (event: CustomEvent) => {
      const { qr, sessionId } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar instância com QR code
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          qrCode: qr
        } : instance
      ));

      // Atualizar modal para mostrar QR code
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ ...prev, connectionState: 'ready' }));
      }
    };

    const handleQRScanned = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar modal para mostrar que o QR foi escaneado
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ ...prev, connectionState: 'scanning' }));
      }
    };

    const handleConnecting = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar modal para mostrar que está conectando
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ ...prev, connectionState: 'connecting' }));
      }
    };

    const handleConnected = (event: CustomEvent) => {
      const { sessionId, user } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      console.log('🔥 useWhatsAppInstances - handleConnected:', { sessionId, instanceId, user });
      
      // Atualizar instância como conectada SEMPRE (independente de quem conectou)
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: true,
          qrCode: undefined,
          phoneNumber: user?.phoneNumber || user?.number,
          lastConnected: new Date()
        } : instance
      ));
      
      // Atualizar modal para mostrar sucesso (apenas se for este usuário que está conectando)
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ ...prev, connectionState: 'connected' }));
        setIsGeneratingQR(null);
      }
      
      // Buscar informações do usuário conectado
      checkInstanceStatus(instanceId);
    };

    const handleUserInfo = (event: CustomEvent) => {
      const { sessionId, user } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar informações do usuário SEMPRE (independente de quem conectou)
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: true,
          phoneNumber: user?.phoneNumber || user?.number,
          lastConnected: new Date()
        } : instance
      ));
    };

    const handleAlreadyConnected = (event: CustomEvent) => {
      const { sessionId, user } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar instância como conectada SEMPRE (independente de quem tentou conectar)
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: true,
          phoneNumber: user?.phoneNumber || user?.number,
          qrCode: undefined,
          lastConnected: new Date()
        } : instance
      ));
      
      // Fechar modal se já estiver conectado (apenas se for este usuário)
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState({ isOpen: false, instanceId: null, connectionState: 'generating' });
        setIsGeneratingQR(null);
      }
    };

    const handleLoggedOut = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar instância como desconectada SEMPRE (independente de quem desconectou)
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: false,
          qrCode: undefined,
          phoneNumber: undefined,
          lastConnected: undefined
        } : instance
      ));
    };

    const handleQRError = (event: CustomEvent) => {
      const { sessionId, error } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar modal para mostrar erro
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ 
          ...prev, 
          connectionState: 'error',
          errorMessage: error || 'Erro ao gerar QR Code'
        }));
      }
      
      setIsGeneratingQR(null);
    };

    const handleConnectionError = (event: CustomEvent) => {
      const { sessionId, error } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar modal para mostrar erro
      if (modalState.isOpen && modalState.instanceId === instanceId) {
        setModalState(prev => ({ 
          ...prev, 
          connectionState: 'error',
          errorMessage: error || 'Erro de conexão'
        }));
      }
      
      setIsGeneratingQR(null);
    };

    const handleDisconnected = (event: CustomEvent) => {
      const { sessionId, reason, willReconnect } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar instância como desconectada
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: false,
          isReconnecting: willReconnect, // Adicionar flag de reconexão
          qrCode: undefined
        } : instance
      ));
    };

    const handleReconnectionFailed = (event: CustomEvent) => {
      const { sessionId, error } = event.detail;
      const instanceId = parseInt(sessionId.split('_')[1]);
      
      // Atualizar instância para indicar que a reconexão falhou
      setInstances(prev => prev.map(instance => 
        instance.id === instanceId ? {
          ...instance,
          isConnected: false,
          isReconnecting: false,
          qrCode: undefined,
          phoneNumber: undefined,
          lastConnected: undefined
        } : instance
      ));
    };

    // Adicionar listeners
    window.addEventListener('whatsapp-qr', handleQR as EventListener);
    window.addEventListener('whatsapp-qr-scanned', handleQRScanned as EventListener);
    window.addEventListener('whatsapp-connecting', handleConnecting as EventListener);
    window.addEventListener('whatsapp-connected', handleConnected as EventListener);
    window.addEventListener('whatsapp-user-info', handleUserInfo as EventListener);
    window.addEventListener('whatsapp-already-connected', handleAlreadyConnected as EventListener);
    window.addEventListener('whatsapp-logged-out', handleLoggedOut as EventListener);
    window.addEventListener('whatsapp-qr-error', handleQRError as EventListener);
    window.addEventListener('whatsapp-connection-error', handleConnectionError as EventListener);
    window.addEventListener('whatsapp-disconnected', handleDisconnected as EventListener);
    window.addEventListener('whatsapp-reconnection-failed', handleReconnectionFailed as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('whatsapp-qr', handleQR as EventListener);
      window.removeEventListener('whatsapp-qr-scanned', handleQRScanned as EventListener);
      window.removeEventListener('whatsapp-connecting', handleConnecting as EventListener);
      window.removeEventListener('whatsapp-connected', handleConnected as EventListener);
      window.removeEventListener('whatsapp-user-info', handleUserInfo as EventListener);
      window.removeEventListener('whatsapp-already-connected', handleAlreadyConnected as EventListener);
      window.removeEventListener('whatsapp-logged-out', handleLoggedOut as EventListener);
      window.removeEventListener('whatsapp-qr-error', handleQRError as EventListener);
      window.removeEventListener('whatsapp-connection-error', handleConnectionError as EventListener);
      window.removeEventListener('whatsapp-disconnected', handleDisconnected as EventListener);
      window.removeEventListener('whatsapp-reconnection-failed', handleReconnectionFailed as EventListener);
    };
  }, [modalState.isOpen, modalState.instanceId]);

  const handleGenerateQR = useCallback(async (instanceId: number) => {
    setIsGeneratingQR(instanceId);
    
    // Abrir modal com estado "generating"
    setModalState({
      isOpen: true,
      instanceId,
      connectionState: 'generating'
    });
    
    const sessionId = `instance_${instanceId}`;
    generateQR(sessionId);
  }, [generateQR]);

  const handleDisconnect = useCallback(async (instanceId: number) => {
    const sessionId = `instance_${instanceId}`;
    logout(sessionId);
  }, [logout]);

  const handleSaveConfig = useCallback(async (instanceId: number, config: { name: string; apiKey: string; assistantId: string }) => {
    setInstances(prev => prev.map(instance => 
      instance.id === instanceId ? {
        ...instance,
        name: config.name,
        apiKey: config.apiKey,
        assistantId: config.assistantId
      } : instance
    ));
    
    // Aqui você pode adicionar uma chamada à API para salvar as configurações no backend
    console.log(`Configurações salvas para instância ${instanceId}:`, config);
  }, []);

  const closeModal = useCallback(() => {
    // Limpar o estado isGeneratingQR ao fechar o modal
    setIsGeneratingQR(null);
    
    // Limpar QR code da instância se o modal foi fechado sem conectar
    if (modalState.instanceId) {
      setInstances(prev => prev.map(instance => 
        instance.id === modalState.instanceId && !instance.isConnected ? {
          ...instance,
          qrCode: undefined
        } : instance
      ));
    }
    
    // Fechar o modal
    setModalState({
      isOpen: false,
      instanceId: null,
      connectionState: 'generating'
    });
  }, [modalState.instanceId]);

  return {
    instances,
    isGeneratingQR,
    handleGenerateQR,
    handleDisconnect,
    handleSaveConfig,
    modalState,
    closeModal
  };
}; 