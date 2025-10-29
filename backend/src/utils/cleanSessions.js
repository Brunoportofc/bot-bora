import fs from 'fs';
import path from 'path';

const SESSIONS_PATH = process.env.SESSIONS_PATH || './sessions';

/**
 * Limpa todas as sessões armazenadas
 */
function cleanSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const files = fs.readdirSync(SESSIONS_PATH);
      
      for (const file of files) {
        const filePath = path.join(SESSIONS_PATH, file);
        fs.rmSync(filePath, { recursive: true, force: true });
        console.log(`✅ Removido: ${file}`);
      }
      
      console.log('✅ Todas as sessões foram limpas com sucesso!');
    } else {
      console.log('⚠️  Diretório de sessões não existe');
    }
  } catch (error) {
    console.error('❌ Erro ao limpar sessões:', error);
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanSessions();
}

export default cleanSessions;

