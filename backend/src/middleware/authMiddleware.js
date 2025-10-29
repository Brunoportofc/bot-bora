
import logger from '../config/logger.js';

/**
 * Middleware para verificar autenticação Firebase
 */
export async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name
      };
      
      next();
    } catch (error) {
      logger.error('Erro ao verificar token Firebase:', error);
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado'
      });
    }
  } catch (error) {
    logger.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * Middleware opcional de autenticação (não bloqueia se não houver token)
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name
        };
      } catch (error) {
        // Token inválido, mas não bloqueia a requisição
        logger.warn('Token inválido em rota opcional:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Erro no middleware de autenticação opcional:', error);
    next();
  }
}

