import admin from 'firebase-admin';
import logger from './logger.js';

// Verificar se Firebase Admin já foi inicializado
if (!admin.apps.length) {
  try {
    // Configuração usando variáveis de ambiente
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    // Validar se todas as variáveis necessárias estão presentes
    if (!firebaseConfig.projectId || !firebaseConfig.privateKey || !firebaseConfig.clientEmail) {
      throw new Error('Variáveis de ambiente do Firebase não configuradas corretamente');
    }

    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig),
      projectId: firebaseConfig.projectId,
    });

    logger.info('✅ Firebase Admin inicializado com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao inicializar Firebase Admin:', error);
    throw error;
  }
} else {
  logger.info('🔄 Firebase Admin já estava inicializado');
}

export default admin;