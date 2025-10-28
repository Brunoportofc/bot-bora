import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface User {
  email: string;
  uid: string;
  displayName?: string;
}

// Lista de emails autorizados como admin
const AUTHORIZED_ADMIN_EMAILS = [
  'admin@clinica-ia.com',
  'seu-email@gmail.com',
  // Adicione outros emails de admin aqui
  // Temporariamente permitir qualquer email autenticado no Firebase
];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Monitorar estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const email = firebaseUser.email || '';
        
        // Permitir qualquer usuário autenticado no Firebase
        // (você controla quem pode se registrar no console Firebase)
        const userData: User = {
          email: firebaseUser.email || '',
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || undefined
        };
        setUser(userData);
        console.log('✅ Usuário autenticado:', email);
      } else {
        setUser(null);
    }
    setLoading(false);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged vai atualizar o estado automaticamente
    } catch (error: any) {
      // Re-throw o erro para ser tratado no componente
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // O onAuthStateChanged vai limpar o estado automaticamente
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };
};
