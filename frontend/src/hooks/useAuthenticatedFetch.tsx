import { useCallback } from 'react';

export const useAuthenticatedFetch = () => {
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      // Fazer a requisição sem autenticação
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    } catch (error) {
      console.error('Erro na requisição:', error);
      throw error;
    }
  }, []);

  return { authenticatedFetch };
};
