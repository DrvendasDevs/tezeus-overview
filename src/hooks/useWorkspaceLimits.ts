import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface WorkspaceLimit {
  id: string;
  workspace_id: string;
  connection_limit: number;
  user_limit: number;
  disparador_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

interface ConnectionUsage {
  current: number;
  limit: number;
  canCreateMore: boolean;
}

interface UserUsage {
  current: number;
  limit: number;
  canCreateMore: boolean;
}

export function useWorkspaceLimits(workspaceId: string) {
  const [limits, setLimits] = useState<WorkspaceLimit | null>(null);
  const [usage, setUsage] = useState<ConnectionUsage | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLimits = useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // Usar edge function para bypass RLS
      const { data, error } = await supabase.functions.invoke('get-workspace-limits', {
        body: { workspaceId }
      });

      if (error) {
        console.error('❌ Error fetching workspace limits:', error);
        throw error;
      }

      const connectionLimit = data?.connectionLimit || 1;
      const userLimit = data?.userLimit || 5;
      const disparadorEnabled = data?.disparadorEnabled ?? true;
      const currentConnections = data?.connectionsCount || 0;
      const currentUsers = data?.usersCount || 0;

      setLimits({
        id: '',
        workspace_id: workspaceId,
        connection_limit: connectionLimit,
        user_limit: userLimit,
        disparador_enabled: disparadorEnabled,
        created_at: '',
        updated_at: ''
      });
      
      setUsage({
        current: currentConnections,
        limit: connectionLimit,
        canCreateMore: currentConnections < connectionLimit
      });
      
      setUserUsage({
        current: currentUsers,
        limit: userLimit,
        canCreateMore: currentUsers < userLimit
      });

    } catch (error) {
      console.error('Error fetching workspace limits:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar limites do workspace",
        variant: "destructive"
      });
      // Keep previous usage if any to prevent UI flashing
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  // Subscribe to realtime changes on connections table
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel(`workspace-connections-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // Refresh limits whenever a connection is added, updated, or deleted
          fetchLimits();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // Refresh when users are added or removed
          fetchLimits();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_limits',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // Refresh when the limit itself changes
          fetchLimits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, fetchLimits]);

  return {
    limits,
    usage,
    userUsage,
    isLoading,
    refreshLimits: fetchLimits
  };
}
