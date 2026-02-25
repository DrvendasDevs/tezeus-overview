import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceHeaders } from '@/lib/workspaceHeaders';

export interface WorkspaceConnection {
  id: string;
  instance_name: string;
  phone_number?: string;
  status: string;
}

export const useWorkspaceConnections = (workspaceId?: string) => {
  const [connections, setConnections] = useState<WorkspaceConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const isFirstLoadRef = useRef(true);
  const isFetchingRef = useRef(false);

  const fetchConnections = useCallback(async (isPolling = false) => {
    if (!workspaceId) {
      setConnections([]);
      setIsLoading(false);
      return;
    }
    
    // Evitar múltiplas chamadas simultâneas
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    // Só mostrar loading no primeiro carregamento, não em polling
    if (!isPolling && isFirstLoadRef.current) {
      setIsLoading(true);
    }
    
    try {
      console.log('🔌 [useWorkspaceConnections] Buscando conexões para workspace:', workspaceId);
      
      // Usar Edge Function para bypassar RLS
      const headers = getWorkspaceHeaders(workspaceId);
      const { data, error } = await supabase.functions.invoke('workspace-connections', {
        method: 'POST',
        headers,
        body: { workspaceId },
      });

      console.log('🔌 [useWorkspaceConnections] Resultado Edge Function:', { data, error });

      if (error) {
        console.warn('⚠️ Erro ao buscar conexões via Edge Function:', error);
        // Tentar fallback direto
        console.log('🔌 [useWorkspaceConnections] Tentando fallback direto...');
        const { data: directData, error: directError } = await supabase
          .from('connections')
          .select('id, instance_name, phone_number, status')
          .eq('workspace_id', workspaceId)
          .order('instance_name');
        
        console.log('🔌 [useWorkspaceConnections] Resultado direto:', { directData, directError, count: directData?.length });
        
        if (!directError && directData) {
          setConnections(directData);
        }
        return;
      }

      // Só atualizar se houver dados
      const connectionsData = data?.connections || [];
      console.log('🔌 [useWorkspaceConnections] Conexões recebidas:', connectionsData.length);
      setConnections(connectionsData);
      
      isFirstLoadRef.current = false;
    } catch (error) {
      console.error('Error fetching connections:', error);
      // NÃO zerar conexões em caso de erro - manter estado anterior
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Primeiro carregamento
  useEffect(() => {
    isFirstLoadRef.current = true;
    fetchConnections(false);
  }, [workspaceId, fetchConnections]);

  // Realtime subscription ao invés de polling agressivo
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`connections-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // Atualizar quando houver mudanças na tabela
          fetchConnections(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchConnections]);

  // Polling mais lento (30 segundos) como fallback para status
  useEffect(() => {
    if (!workspaceId || !pollingEnabled) return;

    const interval = setInterval(() => {
      fetchConnections(true);
    }, 30000); // 30 segundos (era 5)

    return () => clearInterval(interval);
  }, [workspaceId, pollingEnabled, fetchConnections]);

  return {
    connections,
    isLoading,
    fetchConnections: () => fetchConnections(false),
    setPollingEnabled,
  };
};