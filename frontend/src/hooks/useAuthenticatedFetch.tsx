import { useCallback } from 'react';
import { auth } from '@/lib/firebase';

export const useAuthenticatedFetch = () => {
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      // Obter token do usuário atual
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const token = await user.getIdToken();

      // Adicionar header de autorização
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      };

      // Fazer a requisição
      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    } catch (error) {
      console.error('Erro na requisição autenticada:', error);
      throw error;
    }
  }, []);

  return { authenticatedFetch };
};
