import { useEffect, useCallback, useRef } from 'react';
import { supabase, syncUserContext } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Hook que mantém o contexto do usuário sincronizado no banco de dados
 * Isso permite que triggers de auditoria identifiquem quem está fazendo a ação
 * 
 * Uso: Adicione em componentes que fazem operações de escrita (CRUD)
 */
export function useUserContext() {
  const { user } = useAuth();
  const lastSyncRef = useRef<number>(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sincroniza o contexto no banco
  const sync = useCallback(async () => {
    if (!user?.id) return;
    
    const now = Date.now();
    // Evitar sincronizações muito frequentes (mínimo 5 segundos entre elas)
    if (now - lastSyncRef.current < 5000) return;
    
    lastSyncRef.current = now;
    
    try {
      await supabase.rpc('set_current_user_context', {
        user_id: user.id,
        user_email: user.email || null,
      });
    } catch (error) {
      console.warn('[UserContext] Erro ao sincronizar:', error);
    }
  }, [user?.id, user?.email]);

  // Sincronizar imediatamente quando o componente monta ou usuário muda
  useEffect(() => {
    if (user?.id) {
      sync();
      
      // Sincronizar a cada 30 segundos para manter o contexto ativo
      syncIntervalRef.current = setInterval(sync, 30000);
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [user?.id, sync]);

  // Função para sincronizar manualmente antes de uma operação
  const syncBeforeOperation = useCallback(async () => {
    lastSyncRef.current = 0; // Reset para forçar sync
    await sync();
  }, [sync]);

  return {
    sync,
    syncBeforeOperation,
    isReady: !!user?.id
  };
}

/**
 * Hook simplificado que apenas sincroniza o contexto uma vez no mount
 * Use em páginas/componentes que fazem operações de escrita
 */
export function useSyncUserContext() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      syncUserContext();
    }
  }, [user?.id]);
}
