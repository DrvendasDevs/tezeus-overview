import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { toast } from 'sonner';
import { useRetry } from './useRetry';

export interface QueueUser {
  id: string;
  queue_id: string;
  user_id: string;
  order_position: number;
  created_at: string;
  system_users?: {
    id: string;
    name: string;
    email: string;
    profile: string;
    avatar?: string;
  };
}

export function useQueueUsers(queueId?: string) {
  const [users, setUsers] = useState<QueueUser[]>([]);
  const [loading, setLoading] = useState(false);
  const { retry } = useRetry();

  const loadQueueUsers = useCallback(async () => {
    if (!queueId) return;

    try {
      setLoading(true);

      // Usar edge function com service_role para contornar RLS e retry para erros de conexão
      const result = await retry(async () => {
        const { data, error } = await supabase.functions.invoke('get-queue-users', {
          body: { queueId }
        });

        if (error) throw error;
        return data;
      });

      console.log('✅ Usuários da fila carregados:', result?.length || 0);
      setUsers(result || []);
    } catch (error) {
      console.error('Erro ao carregar usuários da fila:', error);
      toast.error('Erro ao carregar usuários da fila');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  const addUsersToQueue = useCallback(async (userIds: string[]) => {
    if (!queueId || userIds.length === 0) return;

    try {
      const { error } = await supabase.functions.invoke('manage-queue-users', {
        body: {
          action: 'add',
          queueId,
          userIds,
        },
        headers: getWorkspaceHeaders(),
      });

      if (error) throw error;

      toast.success(`${userIds.length} usuário(s) adicionado(s) à fila`);
      await loadQueueUsers();
    } catch (error: any) {
      console.error('Erro ao adicionar usuários à fila:', error);
      toast.error('Erro ao adicionar usuários à fila');
    }
  }, [queueId, loadQueueUsers]);

  const removeUserFromQueue = useCallback(async (userId: string) => {
    if (!queueId) return;

    try {
      const { error } = await supabase.functions.invoke('manage-queue-users', {
        body: {
          action: 'remove',
          queueId,
          userId,
        },
        headers: getWorkspaceHeaders(),
      });

      if (error) throw error;

      toast.success('Usuário removido da fila');
      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao remover usuário da fila:', error);
      toast.error('Erro ao remover usuário da fila');
    }
  }, [queueId, loadQueueUsers]);

  const updateUserOrder = useCallback(async (userId: string, newPosition: number) => {
    if (!queueId) return;

    try {
      const { error } = await supabase.functions.invoke('manage-queue-users', {
        body: {
          action: 'updateOrder',
          queueId,
          userId,
          newPosition,
        },
        headers: getWorkspaceHeaders(),
      });

      if (error) throw error;

      await loadQueueUsers();
    } catch (error) {
      console.error('Erro ao atualizar ordem do usuário:', error);
      toast.error('Erro ao atualizar ordem do usuário');
    }
  }, [queueId, loadQueueUsers]);

  // Set user context when the hook initializes
  useEffect(() => {
    const setContext = async () => {
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (currentUserData?.id) {
        await supabase.rpc('set_current_user_context', {
          user_id: currentUserData.id,
          user_email: currentUserData.email || ''
        });
      }
    };
    
    setContext();
  }, []);

  return {
    users,
    loading,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
    updateUserOrder,
  };
}
