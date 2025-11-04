// Configuração da API
const API_CONFIG = {
  // URL base do backend - usa variável de ambiente ou domínio de produção
  BASE_URL: import.meta.env.VITE_API_URL || 'https://bora.factoriasolutions.com',
  
  // URL para Socket.IO
  SOCKET_URL: import.meta.env.VITE_API_URL || 'https://bora.factoriasolutions.com',
  
  // Endpoints da API
  ENDPOINTS: {
    HEALTH: '/health',
    SESSIONS_ACTIVE: '/sessions/active',
    SESSION_STATUS: (sessionId: string) => `/api/whatsapp/status/${sessionId}`,
    SESSION_CONFIG: (sessionId: string) => `/api/whatsapp/config/${sessionId}`,
    SESSION_CONFIG_FULL: (sessionId: string) => `/api/whatsapp/config/${sessionId}`,
    SESSION_RECONNECT: (sessionId: string) => `/api/whatsapp/reconnect/${sessionId}`,
  }
};

export default API_CONFIG; 