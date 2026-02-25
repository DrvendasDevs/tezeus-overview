import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkspaceStats {
  usersCount: number;
  activeDealsCount: number;
}

export function useWorkspaceStats(workspaceId: string) {
  const [stats, setStats] = useState<WorkspaceStats>({
    usersCount: 0,
    activeDealsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Usar edge function para bypass RLS e contar corretamente
      const { data, error } = await supabase.functions.invoke('get-workspace-stats', {
        body: { workspaceId }
      });

      if (error) {
        console.error('Error fetching workspace stats:', error);
        throw error;
      }

      console.log('📊 useWorkspaceStats: Stats received:', data);

      setStats({
        usersCount: data?.usersCount || 0,
        activeDealsCount: data?.activeDealsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching workspace stats:', error);
      setStats({
        usersCount: 0,
        activeDealsCount: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!workspaceId) return;

    console.log('🔔 useWorkspaceStats: Setting up realtime subscriptions for workspace:', workspaceId);

    const channel = supabase
      .channel(`workspace-stats-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('🔔 Workspace member change detected:', payload);
          fetchStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_cards'
        },
        (payload) => {
          console.log('🔔 Pipeline card change detected:', payload);
          // Check if this card belongs to a pipeline in this workspace
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      console.log('🔕 useWorkspaceStats: Cleaning up realtime subscriptions');
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchStats]);

  return { stats, isLoading };
}
