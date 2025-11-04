import pino from 'pino';

// Logger para o Baileys (sem pretty print)
export const baileysLogger = pino({ 
  level: process.env.LOG_LEVEL || 'silent' // silent para não poluir logs
});

// Logger geral da aplicação (com pretty print)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export default logger;

