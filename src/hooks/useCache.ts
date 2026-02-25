import { useRef, useCallback } from 'react';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function useCache<T>(expirationMinutes: number = 5) {
  const cacheRef = useRef<CacheEntry<T> | null>(null);

  const isExpired = useCallback(() => {
    if (!cacheRef.current) return true;
    
    const now = Date.now();
    const expirationMs = expirationMinutes * 60 * 1000;
    return now - cacheRef.current.timestamp > expirationMs;
  }, [expirationMinutes]);

  const getCache = useCallback((): T | null => {
    if (!cacheRef.current || isExpired()) {
      return null;
    }
    return cacheRef.current.data;
  }, [isExpired]);

  const setCache = useCallback((data: T) => {
    cacheRef.current = {
      data,
      timestamp: Date.now()
    };
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  return {
    getCache,
    setCache,
    clearCache,
    isExpired
  };
}
