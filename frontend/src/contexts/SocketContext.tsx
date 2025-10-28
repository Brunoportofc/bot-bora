import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import API_CONFIG from '@/config/api';

interface SocketContextData {
  socket: Socket | null;
  isConnected: boolean;
  generateQR: (sessionId: string) => void;
  logout: (sessionId: string) => void;
  forceReconnect: (sessionId: string) => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Conectar ao servidor backend com configurações de reconexão
    const socketInstance = io(API_CONFIG.SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false
    });

    socketInstance.on('connect', () => {
      console.log('✅ Conectado ao servidor Socket.IO');
      setIsConnected(true);
      
      // Não mostrar toast na primeira conexão, apenas em reconexões
      // (o evento 'reconnect' já mostra um toast)
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Desconectado do servidor Socket.IO:', reason);
      setIsConnected(false);
      
      // Não mostrar toast aqui, deixar o reconnect_failed fazer isso se necessário
      if (reason === 'io server disconnect') {
        // Servidor desconectou o cliente, tentar reconectar manualmente
        socketInstance.connect();
      }
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconectado ao servidor (tentativa ${attemptNumber})`);
      setIsConnected(true);
      
      // Toast apenas em reconexões após falha
      toast({
        title: "Reconectado",
        description: "Conexão com o servidor restaurada.",
      });
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Tentativa de reconexão ${attemptNumber}...`);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('❌ Erro na reconexão:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('❌ Falha na reconexão após todas as tentativas');
      setIsConnected(false);
      
      toast({
        title: "Conexão perdida",
        description: "Não foi possível reconectar ao servidor. Verifique sua conexão.",
        variant: "destructive",
      });
    });

    // Eventos do WhatsApp
    socketInstance.on('qr', ({ qr, sessionId }) => {
      // Emitir evento customizado para componentes interessados
      window.dispatchEvent(new CustomEvent('whatsapp-qr', { 
        detail: { qr, sessionId } 
      }));
    });

    socketInstance.on('qr-scanned', ({ sessionId, message }) => {
      window.dispatchEvent(new CustomEvent('whatsapp-qr-scanned', { 
        detail: { sessionId, message } 
      }));
    });

    socketInstance.on('connecting', ({ sessionId, message }) => {
      window.dispatchEvent(new CustomEvent('whatsapp-connecting', { 
        detail: { sessionId, message } 
      }));
    });

    socketInstance.on('connected', ({ sessionId, message }) => {
      toast({
        title: "WhatsApp Conectado",
        description: message,
      });
      window.dispatchEvent(new CustomEvent('whatsapp-connected', { 
        detail: { sessionId } 
      }));
    });

    socketInstance.on('user-info', ({ sessionId, user }) => {
      window.dispatchEvent(new CustomEvent('whatsapp-user-info', { 
        detail: { sessionId, user } 
      }));
    });

    socketInstance.on('already-connected', ({ sessionId, user }) => {
      toast({
        title: "Já Conectado",
        description: "Esta instância já está conectada ao WhatsApp.",
      });
      window.dispatchEvent(new CustomEvent('whatsapp-already-connected', { 
        detail: { sessionId, user } 
      }));
    });

    socketInstance.on('qr-error', ({ error, sessionId }) => {
      toast({
        title: "Erro ao gerar QR Code",
        description: error || "Ocorreu um erro ao gerar o QR Code.",
        variant: "destructive",
      });
      window.dispatchEvent(new CustomEvent('whatsapp-qr-error', { 
        detail: { sessionId, error } 
      }));
    });

    socketInstance.on('connection-error', ({ sessionId, error }) => {
      toast({
        title: "Erro de Conexão",
        description: error || "Erro ao conectar com o WhatsApp.",
        variant: "destructive",
      });
      window.dispatchEvent(new CustomEvent('whatsapp-connection-error', { 
        detail: { sessionId, error } 
      }));
    });

    socketInstance.on('logged-out', ({ sessionId }) => {
      // Removido toast de desconexão
      window.dispatchEvent(new CustomEvent('whatsapp-logged-out', { 
        detail: { sessionId } 
      }));
    });

    // Novos eventos de desconexão e reconexão
    socketInstance.on('disconnected', ({ sessionId, reason, willReconnect }) => {
      // Removido toast de desconexão
      window.dispatchEvent(new CustomEvent('whatsapp-disconnected', { 
        detail: { sessionId, reason, willReconnect } 
      }));
    });

    socketInstance.on('reconnection-failed', ({ sessionId, error }) => {
      // Removido toast de falha na reconexão
      window.dispatchEvent(new CustomEvent('whatsapp-reconnection-failed', { 
        detail: { sessionId, error } 
      }));
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      socketInstance.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez ao montar (toast não deve ser dependência)

  const generateQR = (sessionId: string) => {
    console.log('🔍 generateQR chamado:', { sessionId, socketConnected: !!socket, isConnected });
    
    if (socket && isConnected) {
      console.log('📡 Emitindo evento generate-qr:', { sessionId });
      socket.emit('generate-qr', { sessionId });
    } else {
      console.error('❌ Socket não conectado:', { socket: !!socket, isConnected });
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Verifique se o backend está rodando.",
        variant: "destructive",
      });
    }
  };

  const logout = (sessionId: string) => {
    if (socket && isConnected) {
      socket.emit('logout', { sessionId });
    }
  };

  const forceReconnect = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSION_RECONNECT(sessionId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao forçar reconexão');
      }

      toast({
        title: "Reconexão Iniciada",
        description: "Tentando reconectar a instância...",
      });
    } catch (error) {
      toast({
        title: "Erro na Reconexão",
        description: "Não foi possível iniciar a reconexão manual.",
        variant: "destructive",
      });
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, generateQR, logout, forceReconnect }}>
      {children}
    </SocketContext.Provider>
  );
}; 