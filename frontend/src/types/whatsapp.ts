
export interface WhatsAppInstance {
  id: number;
  name: string;
  isConnected: boolean;
  isReconnecting?: boolean;
  qrCode?: string;
  apiKey: string;
  assistantId: string;
  lastConnected?: Date;
  phoneNumber?: string;
}

export interface WhatsAppConfig {
  name: string;
  apiKey: string;
  assistantId: string;
}

export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  message?: string;
}
