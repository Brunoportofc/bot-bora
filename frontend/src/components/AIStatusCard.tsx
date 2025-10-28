import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Activity, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';

interface AIStatus {
  activeInstances: number;
  totalMessages: number;
  averageResponseTime: number;
  errors: number;
}

const AIStatusCard = () => {
  const [status, setStatus] = useState<AIStatus>({
    activeInstances: 0,
    totalMessages: 0,
    averageResponseTime: 0,
    errors: 0
  });
  
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Escutar eventos de mensagens processadas
    socket.on('message-processed', (data) => {
      setStatus(prev => ({
        ...prev,
        totalMessages: prev.totalMessages + 1
      }));
    });

    // Escutar atualizações de configuração
    socket.on('config-updated', (data) => {
      if (data.success) {
        setStatus(prev => ({
          ...prev,
          activeInstances: prev.activeInstances + 1
        }));
      }
    });

    return () => {
      socket.off('message-processed');
      socket.off('config-updated');
    };
  }, [socket]);

  return (
    <Card className="bg-dark-navy-950/90 border border-mint-glow/30 backdrop-blur-sm">
      <CardHeader className="pb-3 sm:pb-6 px-4 sm:px-6 pt-4 sm:pt-6">
        <CardTitle className="flex items-center gap-2 text-mint-glow text-base sm:text-lg">
          <Bot size={16} className="sm:w-5 sm:h-5" />
          Status do Assistente AI
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <Activity size={12} className="sm:w-4 sm:h-4 text-mint-glow/80" />
              <span className="text-xs sm:text-sm text-mint-glow/70">Instâncias Ativas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-mint-glow">{status.activeInstances}</p>
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <MessageSquare size={12} className="sm:w-4 sm:h-4 text-mint-glow/80" />
              <span className="text-xs sm:text-sm text-mint-glow/70">Mensagens</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-mint-glow">{status.totalMessages}</p>
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <CheckCircle size={12} className="sm:w-4 sm:h-4 text-secondary" />
              <span className="text-xs sm:text-sm text-mint-glow/70">Tempo Resposta</span>
            </div>
            <p className="text-sm sm:text-lg font-semibold text-secondary">
              {status.averageResponseTime > 0 ? `${status.averageResponseTime}s` : 'N/A'}
            </p>
          </div>
          
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <AlertCircle size={12} className="sm:w-4 sm:h-4 text-red-400" />
              <span className="text-xs sm:text-sm text-mint-glow/70">Erros</span>
            </div>
            <p className="text-sm sm:text-lg font-semibold text-red-400">{status.errors}</p>
          </div>
        </div>
        
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-mint-glow/20">
          <Badge className="bg-mint-glow/20 text-mint-glow hover:bg-mint-glow/30 border border-mint-glow/30 text-xs sm:text-sm">
            <Bot size={10} className="sm:w-3 sm:h-3 mr-1" />
            OpenAI Assistants API
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIStatusCard; 