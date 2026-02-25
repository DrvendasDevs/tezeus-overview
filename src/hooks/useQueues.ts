import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface Queue {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ai_agent?: {
    id: string;
    name: string;
  };
}

export function useQueues(workspaceIdProp?: string, includeInactive?: boolean) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const isFetchingRef = useRef(false);
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 500; // ms

  // Priorizar workspaceId da prop, senão usar do contexto
  const workspaceId = workspaceIdProp || selectedWorkspace?.workspace_id;

  const fetchQueues = async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    // Proteção anti-loop: evitar requisições duplicadas
    if (isFetchingRef.current) {
      return;
    }

    // Proteção anti-loop: evitar requisições muito rápidas
    const now = Date.now();
    if (now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTime.current = now;

    isFetchingRef.current = true;

    try {
      setLoading(true);
      
      let query = supabase
        .from('queues')
        .select(`
          *,
          ai_agent:ai_agents(id, name)
        `)
        .eq('workspace_id', workspaceId);

      // Filtrar por is_active apenas se includeInactive for false ou undefined
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('order_position', { ascending: true });

      if (error) {
        console.error('❌ useQueues: Erro ao buscar filas:', error);
        throw error;
      }
      
      setQueues(data || []);
    } catch (error) {
      console.error('❌ useQueues: Erro ao carregar filas:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchQueues();
  }, [workspaceId]);

  return {
    queues,
    loading,
    refetch: fetchQueues
  };
}