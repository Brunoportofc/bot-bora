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
        totalMessages: prev.totalMessages + 1,
        averageResponseTime: data.responseTime || prev.averageResponseTime
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

    // Escutar conexões de instâncias
    socket.on('instance-connected', (data) => {
      setStatus(prev => ({
        ...prev,
        activeInstances: prev.activeInstances + 1
      }));
    });

    // Escutar desconexões de instâncias
    socket.on('instance-disconnected', (data) => {
      setStatus(prev => ({
        ...prev,
        activeInstances: Math.max(0, prev.activeInstances - 1)
      }));
    });

    // Escutar erros
    socket.on('ai-error', (data) => {
      setStatus(prev => ({
        ...prev,
        errors: prev.errors + 1
      }));
    });

    // Solicitar status inicial
    socket.emit('get-ai-status');

    // Escutar resposta do status inicial
    socket.on('ai-status-response', (data) => {
      setStatus({
        activeInstances: data.activeInstances || 0,
        totalMessages: data.totalMessages || 0,
        averageResponseTime: data.averageResponseTime || 0,
        errors: data.errors || 0
      });
    });

    return () => {
      socket.off('message-processed');
      socket.off('config-updated');
      socket.off('instance-connected');
      socket.off('instance-disconnected');
      socket.off('ai-error');
      socket.off('ai-status-response');
    };
  }, [socket]);

  return (
    <Card className="bg-white/90 border border-bora-blue/30 backdrop-blur-sm shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-bora-blue text-base sm:text-lg">
          <Bot size={16} className="sm:w-5 sm:h-5" />
          Status do Assistente AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {/* Instâncias Ativas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={12} className="sm:w-4 sm:h-4 text-bora-blue/80" />
            <span className="text-xs sm:text-sm text-bora-blue/70">Instâncias Ativas</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-bora-blue">{status.activeInstances}</p>
        </div>

        {/* Mensagens Processadas */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={12} className="sm:w-4 sm:h-4 text-bora-blue/80" />
            <span className="text-xs sm:text-sm text-bora-blue/70">Mensagens</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-bora-blue">{status.totalMessages}</p>
        </div>

        {/* Tempo de Resposta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={12} className="sm:w-4 sm:h-4 text-bora-blue" />
            <span className="text-xs sm:text-sm text-bora-blue/70">Tempo Resposta</span>
          </div>
          <p className="text-sm sm:text-lg font-semibold text-bora-blue">
            {status.averageResponseTime === 'N/A' 
              ? 'N/A' 
              : `${status.averageResponseTime}ms`
            }
          </p>
        </div>

        {/* Erros */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-bora-blue/70">Erros</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-500">{status.errors}</p>
        </div>

        {/* Badge do Gemini */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-bora-blue/20">
          <Badge className="bg-bora-blue/20 text-bora-blue hover:bg-bora-blue/30 border border-bora-blue/30 text-xs sm:text-sm">
            Gemini
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIStatusCard;