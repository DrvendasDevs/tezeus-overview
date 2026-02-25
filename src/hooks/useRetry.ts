import { useCallback } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
}

export function useRetry() {
  const retry = useCallback(async <T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> => {
    const { maxAttempts = 3, baseDelay = 1000 } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Só fazer retry para erros de conexão
        const isConnectionError = 
          error?.message?.includes('ERR_CONNECTION_RESET') ||
          error?.message?.includes('Failed to send a request') ||
          error?.message?.includes('Failed to fetch') ||
          error?.name === 'FunctionsFetchError';

        if (!isConnectionError || attempt === maxAttempts - 1) {
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`⚠️ Erro de conexão. Tentativa ${attempt + 1}/${maxAttempts}. Aguardando ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Retry failed');
  }, []);

  return { retry };
}
