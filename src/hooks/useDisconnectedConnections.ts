import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DisconnectedConnection {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

export function useDisconnectedConnections(workspaceId: string) {
  const [disconnectedConnections, setDisconnectedConnections] = useState<DisconnectedConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastWorkspaceIdRef = useRef<string>('');

  const fetchDisconnectedConnections = useCallback(async (forceRefresh = false) => {
    if (!workspaceId) {
      setDisconnectedConnections([]);
      return;
    }

    setIsLoading(true);
    try {
      // Buscar TODAS as conexões do workspace
      const { data: allConnections, error: allError } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', workspaceId);
      
      if (allError) {
        console.error('[useDisconnectedConnections] Erro ao buscar conexões:', allError);
        return;
      }

      // Filtrar conexões desconectadas (aceita múltiplos formatos de status)
      const disconnectedStatuses = ['disconnected', 'desconectado', 'offline', 'error', 'erro'];
      const disconnected = allConnections?.filter(conn => {
        const status = conn.status?.toLowerCase()?.trim();
        return disconnectedStatuses.includes(status || '');
      }) || [];

      setDisconnectedConnections(disconnected);
    } catch (error) {
      console.error('[useDisconnectedConnections] Exception:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Busca inicial e quando workspace mudar
  useEffect(() => {
    if (workspaceId && workspaceId !== lastWorkspaceIdRef.current) {
      lastWorkspaceIdRef.current = workspaceId;
      fetchDisconnectedConnections(true);
    } else if (workspaceId) {
      fetchDisconnectedConnections();
    }
  }, [workspaceId, fetchDisconnectedConnections]);

  // Subscribe para mudanças em tempo real
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`disconnected-connections-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // Refetch sempre que houver mudança
          fetchDisconnectedConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchDisconnectedConnections]);

  return {
    disconnectedConnections,
    hasDisconnected: disconnectedConnections.length > 0,
    disconnectedCount: disconnectedConnections.length,
    isLoading,
    refresh: fetchDisconnectedConnections
  };
}
