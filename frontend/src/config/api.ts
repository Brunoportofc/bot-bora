// Configuração da API - FORÇANDO LOCALHOST
const API_CONFIG = {
  // URL base do backend - SEMPRE localhost:3001
  BASE_URL: 'http://localhost:3001',
  
  // URL para Socket.IO - SEMPRE localhost:3001
  SOCKET_URL: 'http://localhost:3001',
  
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