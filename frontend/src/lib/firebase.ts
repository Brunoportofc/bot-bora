import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Configuração do Firebase para painel administrativo
const firebaseConfig = {
  apiKey: "AIzaSyAybSspyQrcTdHlYnQ7xwsGeX2kj9ko8Aw",
  authDomain: "clinicaadm-852df.firebaseapp.com",
  projectId: "clinicaadm-852df",
  storageBucket: "clinicaadm-852df.firebasestorage.app",
  messagingSenderId: "1093728684940",
  appId: "1:1093728684940:web:0066b82b92d0b1f298a4a9"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firebase Authentication
export const auth = getAuth(app);
export default app; 