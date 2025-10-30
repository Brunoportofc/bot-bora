import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Loader, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ConnectionState = 'generating' | 'ready' | 'scanning' | 'connecting' | 'connected' | 'error';

interface WhatsAppConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: ConnectionState;
  qrCode?: string;
  errorMessage?: string;
  instanceName: string;
}

const WhatsAppConnectionModal = ({
  isOpen,
  onClose,
  connectionState,
  qrCode,
  errorMessage,
  instanceName
}: WhatsAppConnectionModalProps) => {
  const renderContent = () => {
    switch (connectionState) {
      case 'generating':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-6 sm:py-8 px-4">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-mint-glow/20 rounded-full flex items-center justify-center">
                <QrCode size={24} className="sm:w-8 sm:h-8 text-mint-glow" />
              </div>
              <div className="absolute inset-0 border-4 border-transparent border-t-mint-glow rounded-full animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-mint-glow">Gerando QR Code</h3>
              <p className="text-xs sm:text-sm text-mint-glow/70">Preparando código para {instanceName}...</p>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 py-3 sm:py-4 px-4">
            {qrCode && (
              <>
                <div className="bg-white/95 p-2 sm:p-4 rounded-xl border border-white/40 backdrop-blur-xl shadow-2xl max-w-full" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: '0 8px 32px 0 rgba(255, 255, 255, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)'
                }}>
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-48 h-48 sm:w-64 sm:h-64 object-contain mx-auto"
                  />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-base sm:text-lg font-semibold text-white">Escaneie o QR Code</h3>
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-white/90">1. Abra o WhatsApp no seu celular</p>
                    <p className="text-xs sm:text-sm text-white/90">2. Vá em Configurações › Aparelhos conectados</p>
                    <p className="text-xs sm:text-sm text-white/90">3. Clique em "Conectar um aparelho"</p>
                    <p className="text-xs sm:text-sm text-white/90">4. Escaneie este código</p>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 'scanning':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-6 sm:py-8 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-400/20 rounded-full flex items-center justify-center">
              <Loader size={24} className="sm:w-8 sm:h-8 text-yellow-400 animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-yellow-400">Verificando QR Code</h3>
              <p className="text-xs sm:text-sm text-mint-glow/70">Detectamos que você escaneou o código...</p>
            </div>
          </div>
        );

      case 'connecting':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-6 sm:py-8 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-400/20 rounded-full flex items-center justify-center">
              <Loader size={24} className="sm:w-8 sm:h-8 text-blue-400 animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-blue-400">Conectando ao WhatsApp</h3>
              <p className="text-xs sm:text-sm text-mint-glow/70">Estabelecendo conexão segura...</p>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-6 sm:py-8 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-secondary/20 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} className="sm:w-10 sm:h-10 text-secondary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-semibold text-secondary">Conectado com Sucesso!</h3>
              <p className="text-xs sm:text-sm text-mint-glow/70">{instanceName} está pronto para uso</p>
            </div>
            <Button
              onClick={onClose}
              className="bg-gradient-to-r from-mint-glow to-secondary hover:from-mint-glow/90 hover:to-secondary/90 text-dark-navy transition-all duration-300 w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base"
            >
              Fechar
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 py-6 sm:py-8 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-400/20 rounded-full flex items-center justify-center">
              <XCircle size={32} className="sm:w-10 sm:h-10 text-red-400" />
            </div>
            <div className="text-center space-y-2 max-w-sm">
              <h3 className="text-base sm:text-lg font-semibold text-red-400">Erro na Conexão</h3>
              <p className="text-xs sm:text-sm text-mint-glow/70">{errorMessage || 'Não foi possível conectar ao WhatsApp'}</p>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              className="btn-destructive w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base"
            >
              Fechar
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 backdrop-blur-md bg-transparent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent className="w-[95vw] max-w-md sm:max-w-md bg-dark-navy-950 border border-mint-glow/30 backdrop-blur-lg shadow-2xl mx-auto">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <DialogTitle className="text-center text-lg sm:text-xl font-bold bg-gradient-to-r from-mint-glow to-secondary bg-clip-text text-transparent">
              WhatsApp Web
            </DialogTitle>
          </DialogHeader>
          {renderContent()}
          
          {/* Botão Cancelar para estados em progresso */}
          {(connectionState === 'generating' || connectionState === 'ready' || connectionState === 'scanning' || connectionState === 'connecting') && (
            <div className="flex justify-center pb-4 px-4 sm:px-6">
              <Button
                onClick={onClose}
                variant="outline"
                className="min-w-[100px] w-full sm:w-auto h-10 sm:h-11 text-sm sm:text-base border-mint-glow/30 text-mint-glow hover:bg-mint-glow/10 bg-dark-navy-950/90 backdrop-blur-sm"
              >
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default WhatsAppConnectionModal; 