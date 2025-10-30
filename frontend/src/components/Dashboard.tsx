import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MessageSquare, Users, Activity, Bot, Loader } from 'lucide-react';
import WhatsAppInstanceCard from './WhatsAppInstanceCard';
import WhatsAppConnectionModal, { ConnectionState } from './WhatsAppConnectionModal';
import AIStatusCard from '@/components/AIStatusCard';
import { WhatsAppInstance, WhatsAppConfig } from '@/types/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/contexts/SocketContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import API_CONFIG from '@/config/api';

const Dashboard = () => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInstance, setCurrentInstance] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('generating');
  const [qrCode, setQrCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [removingInstances, setRemovingInstances] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();

  // Carregar instâncias do localStorage primeiro
  useEffect(() => {
    loadInstancesFromStorage();
  }, []); // Executar apenas uma vez ao montar

  // Verificar sessões ativas após carregar do localStorage
  useEffect(() => {
    // Aguardar um pouco para garantir que o localStorage foi carregado
    const timer = setTimeout(() => {
      checkActiveSessions();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []); // Executar apenas uma vez ao montar

  // Verificar status das instâncias periodicamente (silencioso)
  useEffect(() => {
    const interval = setInterval(() => {
      checkActiveSessions(true); // true = verificação silenciosa, sem toasts
    }, 30000); // Verificar a cada 30 segundos
    
    return () => clearInterval(interval);
  }, []); // Executar apenas uma vez ao montar

  // Salvar instâncias no localStorage sempre que mudarem
  useEffect(() => {
    if (instances.length > 0) {
      localStorage.setItem('whatsapp_instances', JSON.stringify(instances));
    }
  }, [instances]);

  const loadInstancesFromStorage = () => {
    try {
      const savedInstances = localStorage.getItem('whatsapp_instances');
      if (savedInstances) {
        const parsedInstances = JSON.parse(savedInstances);
        console.log('📦 Carregando instâncias do localStorage:', parsedInstances);
        console.log('📊 Total de instâncias:', parsedInstances.length);
        
        // Converter lastConnected de string para Date
        const instancesWithDates = parsedInstances.map((inst: any) => ({
          ...inst,
          lastConnected: inst.lastConnected ? new Date(inst.lastConnected) : new Date()
        }));
        
        setInstances(instancesWithDates);
        console.log('✅ Instâncias carregadas com sucesso');
      } else {
        console.log('ℹ️ Nenhuma instância salva no localStorage');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias do localStorage:', error);
    }
  };

  const checkActiveSessions = async (silent = false) => {
    try {
      if (!silent) {
        setIsInitializing(true);
      }
      console.log('🔍 Verificando sessões ativas...');
      
      // Buscar sessões ativas no backend
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SESSIONS_ACTIVE}`);
      const data = await response.json();
      
      console.log(`📊 Encontradas ${data.count} sessões ativas`);

      // Atualizar status das instâncias existentes baseado nas sessões ativas
      setInstances(prevInstances => {
        console.log('📋 Instâncias anteriores:', prevInstances.length);
        console.log('📋 Sessões ativas no backend:', data.count);
        
        if (prevInstances.length === 0 && data.count > 0) {
          // Se não há instâncias locais mas há sessões ativas, criar novas
          console.log('🆕 Criando instâncias baseadas nas sessões ativas...');
          const activeInstances: WhatsAppInstance[] = [];
          
          for (const session of data.sessions) {
            const instanceId = parseInt(session.sessionId.replace('instance_', ''));
            
            activeInstances.push({
              id: instanceId,
              name: `Instância ${instanceId}`,
              isConnected: true,
              apiKey: '',
              assistantId: '',
              lastConnected: new Date(),
              phoneNumber: session.user?.number || ''
            });
          }
          
          console.log('✅ Instâncias criadas:', activeInstances);
          return activeInstances;
        } else {
          // Atualizar status das instâncias existentes
          console.log('🔄 Atualizando status das instâncias existentes...');
          const updatedInstances = prevInstances.map(instance => {
            const sessionId = `instance_${instance.id}`;
            const activeSession = data.sessions.find((s: any) => s.sessionId === sessionId);
            
            const updated = {
              ...instance,
              isConnected: !!activeSession,
              phoneNumber: activeSession?.user?.number || instance.phoneNumber,
              lastConnected: activeSession ? new Date() : instance.lastConnected
            };
            
            console.log(`📝 Instância ${instance.id}: conectada=${updated.isConnected}, tel=${updated.phoneNumber}`);
            return updated;
          });
          
          console.log('✅ Instâncias atualizadas:', updatedInstances);
          return updatedInstances;
        }
      });

      // Mostrar toast apenas se não for verificação silenciosa e for a primeira vez
      if (!silent && data.count > 0) {
        toast({
          title: "Sessões verificadas",
          description: `${data.count} sessão(ões) ativa(s) encontrada(s).`,
        });
      }
    } catch (error) {
      console.error('❌ Erro ao verificar sessões ativas:', error);
      
      // Em caso de erro, manter instâncias existentes mas marcar como desconectadas
      setInstances(prevInstances => 
        prevInstances.map(instance => ({
          ...instance,
          isConnected: false
        }))
      );
      
      // Mostrar erro apenas se não for verificação silenciosa
      if (!silent) {
        toast({
          title: "Erro de conexão",
          description: "Não foi possível verificar o servidor. Verifique sua conexão.",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) {
        setIsInitializing(false);
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('qr', (data) => {
      if (data.sessionId === `instance_${currentInstance}`) {
        setQrCode(data.qr);
        setConnectionState('ready');
      }
    });

    socket.on('qr-scanned', (data) => {
      if (data.sessionId === `instance_${currentInstance}`) {
        setConnectionState('scanning');
      }
    });

    socket.on('connecting', (data) => {
      if (data.sessionId === `instance_${currentInstance}`) {
        setConnectionState('connecting');
      }
    });

    socket.on('connected', (data) => {
      if (data.sessionId === `instance_${currentInstance}`) {
        setConnectionState('connected');
        updateInstanceStatus(currentInstance!, true);
        
        setTimeout(() => {
          setIsModalOpen(false);
          setConnectionState('generating');
        }, 2000);
      }
    });

    socket.on('user-info', (data) => {
      const instanceId = parseInt(data.sessionId.replace('instance_', ''));
      updateInstancePhone(instanceId, data.user?.number);
    });

    socket.on('qr-error', (data) => {
      if (data.sessionId === `instance_${currentInstance}`) {
        setConnectionState('error');
        setErrorMessage(data.error);
      }
    });

    socket.on('logged-out', (data) => {
      const instanceId = parseInt(data.sessionId.replace('instance_', ''));
      updateInstanceStatus(instanceId, false);
    });

    return () => {
      socket.off('qr');
      socket.off('qr-scanned');
      socket.off('connecting');
      socket.off('connected');
      socket.off('user-info');
      socket.off('qr-error');
      socket.off('logged-out');
    };
  }, [socket, currentInstance]);

  const updateInstanceStatus = (instanceId: number, isConnected: boolean) => {
    setInstances(prev => prev.map(inst => 
      inst.id === instanceId ? { ...inst, isConnected } : inst
    ));
  };

  const updateInstancePhone = (instanceId: number, phoneNumber: string) => {
    setInstances(prev => prev.map(inst => 
      inst.id === instanceId ? { ...inst, phoneNumber } : inst
    ));
  };

  const addInstance = () => {
    // Verificar se já existem 4 instâncias
    if (instances.length >= 4) {
      toast({
        title: "Limite atingido",
        description: "Você pode criar no máximo 4 instâncias do WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const newInstance: WhatsAppInstance = {
      id: Date.now(),
      name: `Instância ${instances.length + 1}`,
      isConnected: false,
      apiKey: '',
      assistantId: '',
      lastConnected: new Date(),
    };
    setInstances([...instances, newInstance]);
  };

  const handleGenerateQR = (instanceId: number) => {
    console.log('🎯 Dashboard handleGenerateQR:', instanceId);
    setCurrentInstance(instanceId);
    setIsModalOpen(true);
    setConnectionState('generating');
    setQrCode('');
    
    const sessionId = `instance_${instanceId}`;
    console.log('📡 Dashboard emitindo generate-qr:', sessionId);
    
    if (socket) {
      socket.emit('generate-qr', { sessionId });
    } else {
      console.error('❌ Socket não disponível no Dashboard');
    }
  };

  const handleSaveConfig = async (instanceId: number, config: WhatsAppConfig) => {
    setInstances(prev => prev.map(inst => 
      inst.id === instanceId 
        ? { ...inst, ...config }
        : inst
    ));
  };

  const handleDisconnect = async (instanceId: number) => {
    if (socket) {
      socket.emit('logout', { sessionId: `instance_${instanceId}` });
    }
    updateInstanceStatus(instanceId, false);
  };

  const handleRemoveInstance = async (instanceId: number) => {
    // Adicionar à lista de instâncias sendo removidas
    setRemovingInstances(prev => new Set(prev).add(instanceId));

    // Se estiver conectada, desconectar primeiro
    const instance = instances.find(i => i.id === instanceId);
    if (instance?.isConnected) {
      await handleDisconnect(instanceId);
    }

    // Aguardar a animação antes de remover
    setTimeout(() => {
      // Remover a instância da lista
      setInstances(prev => prev.filter(inst => inst.id !== instanceId));
      
      // Remover da lista de instâncias sendo removidas
      setRemovingInstances(prev => {
        const newSet = new Set(prev);
        newSet.delete(instanceId);
        return newSet;
      });
      
      toast({
        title: "Instância removida",
        description: "A instância foi removida com sucesso.",
      });
    }, 500); // Tempo da animação
  };

  const stats = {
    totalInstances: instances.length,
    connectedInstances: instances.filter(i => i.isConnected).length,
    totalMessages: 0,
    configuredInstances: instances.filter(i => i.apiKey && i.assistantId).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f1f4f9] to-white">
      {/* Efeito de luz sutil */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#243B6B]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#243B6B]/3 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 relative z-10">
        {/* Loading Inicial */}
        {isInitializing && (
          <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="text-center space-y-4 max-w-sm">
              <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-[#243B6B]/10 to-[#243B6B]/20 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                <Loader size={24} className="sm:w-8 sm:h-8 text-[#243B6B] animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Verificando sessões ativas...</h3>
                <p className="text-xs sm:text-sm text-gray-600">Aguarde enquanto sincronizamos suas instâncias</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="text-center sm:text-left">
              <div className="flex justify-center sm:justify-start mb-2">
                <img 
                  src="/bora-logo.png" 
                  alt="Bora Expandir - Agência de Viagens e Assessoria de Imigração" 
                  className="h-16 sm:h-20 lg:h-24 w-auto"
                />
              </div>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Painel de Controle
              </p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? 'Servidor Online' : 'Servidor Offline'}
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full sm:w-auto">
                      <Button 
                        onClick={addInstance}
                        className="btn-new-instance disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        size="default"
                        disabled={instances.length >= 4}
                      >
                        <PlusCircle className="mr-2" size={18} />
                        <span className="text-sm sm:text-base">Nova Instância</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {instances.length >= 4 && (
                    <TooltipContent>
                      <p>Limite máximo de 4 instâncias atingido</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <Card className="bg-white/70 border border-[#243B6B]/20 backdrop-blur-md card-stats shadow-lg">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg font-medium text-gray-900">Total</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#243B6B]">{stats.totalInstances}/4</div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {stats.totalInstances >= 4 ? 'limite atingido' : `${4 - stats.totalInstances} disponíveis`}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#243B6B]/20 backdrop-blur-md card-stats shadow-lg">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg font-medium text-gray-900">Conectadas</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#243B6B]">{stats.connectedInstances}</div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">ativas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#243B6B]/20 backdrop-blur-md card-stats shadow-lg">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg font-medium text-gray-900">Mensagens</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#243B6B]">{stats.totalMessages}</div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">processadas</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 border border-[#243B6B]/20 backdrop-blur-md card-stats shadow-lg">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg font-medium text-gray-900">Assistentes</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#243B6B]">{stats.configuredInstances}</div>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">configurados</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* AI Status Card */}
          <div className="xl:col-span-1 order-2 xl:order-1">
            <AIStatusCard />
          </div>

          {/* Instances Grid */}
          <div className="xl:col-span-2 order-1 xl:order-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Instâncias WhatsApp</h2>
          {instances.length === 0 ? (
            <Card className="border-dashed border-2 border-[#243B6B]/30 bg-white/70 backdrop-blur-md shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <MessageSquare className="mx-auto text-[#243B6B]/60 mb-4" size={40} />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4">Comece criando sua primeira instância do WhatsApp</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full sm:w-auto">
                          <Button 
                            onClick={addInstance}
                            className="btn-new-instance disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                            disabled={instances.length >= 4}
                          >
                            <PlusCircle className="mr-2" size={18} />
                            <span className="text-sm sm:text-base">Criar Primeira Instância</span>
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {instances.length >= 4 && (
                        <TooltipContent>
                          <p>Limite máximo de 4 instâncias atingido</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {instances.map((instance) => (
                  <WhatsAppInstanceCard
                    key={instance.id}
                    instance={instance}
                    onGenerateQR={handleGenerateQR}
                    onSaveConfig={handleSaveConfig}
                    onDisconnect={handleDisconnect}
                    onRemove={handleRemoveInstance}
                    isGeneratingQR={currentInstance === instance.id && connectionState === 'generating'}
                    isRemoving={removingInstances.has(instance.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connection Modal */}
        <WhatsAppConnectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          connectionState={connectionState}
          qrCode={qrCode}
          errorMessage={errorMessage}
          instanceName={instances.find(i => i.id === currentInstance)?.name || ''}
        />
      </div>
    </div>
  );
};

export default Dashboard;
