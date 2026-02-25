import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface FunnelStep {
  id: string;
  type: 'message' | 'audio' | 'media' | 'document';
  item_id: string;
  delay_seconds: number;
  order: number;
}

export interface Funnel {
  id: string;
  title: string;
  workspace_id: string;
  steps: FunnelStep[];
  is_ai_agent?: boolean;
  created_by_id?: string | null;
  visible_to_all?: boolean;
  created_at: string;
}

export function useQuickFunnels(workspaceIdProp?: string) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();

  const workspaceId = workspaceIdProp || selectedWorkspace?.workspace_id;

  useEffect(() => {
    if (workspaceId && user) {
      fetchFunnels();
    }
  }, [workspaceId, user]);

  const fetchFunnels = async () => {
    if (!workspaceId || !user) {
      setFunnels([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = (supabase as any)
        .from('quick_funnels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (userRole !== 'master') {
        query = query.is('is_ai_agent', false);
      }

      query = query.or(`visible_to_all.eq.true,created_by_id.eq.${user.id}`);

      let { data, error } = await query;

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');

        if (isMissingColumns) {
          console.warn('[useQuickFunnels] Colunas de visibilidade/owner não encontradas no banco. Recarregando sem filtro. Aplique a migration.', error);
          const fallback = await (supabase as any)
            .from('quick_funnels')
            .select('*')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;
      setFunnels((data || []) as Funnel[]);
    } catch (error) {
      console.error('Error fetching funnels:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao buscar funis. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createFunnel = async (
    title: string,
    steps: FunnelStep[],
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean }
  ) => {
    if (!workspaceId || !user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      let { data, error } = await (supabase as any)
        .from('quick_funnels')
        .insert({
          title,
          steps,
          workspace_id: workspaceId,
          is_ai_agent: isAiAgent,
          created_by_id: user.id,
          visible_to_all: Boolean(options?.visibleToAll)
        })
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');
        if (isMissingColumns) {
          console.warn('[useQuickFunnels] Migration não aplicada no banco (colunas ausentes). Criando sem campos novos.', error);
          const fallback = await (supabase as any)
            .from('quick_funnels')
            .insert({
              title,
              steps,
              workspace_id: workspaceId,
              is_ai_agent: isAiAgent
            })
            .select()
            .single();
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;

      setFunnels(prev => [data as Funnel, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Funil criado com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating funnel:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao criar funil. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const updateFunnel = async (
    id: string,
    title: string,
    steps: FunnelStep[],
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean }
  ) => {
    try {
      let { data, error } = await (supabase as any)
        .from('quick_funnels')
        .update({ title, steps, is_ai_agent: isAiAgent, visible_to_all: options?.visibleToAll })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');
        if (isMissingColumns && typeof options?.visibleToAll === 'boolean') {
          console.warn('[useQuickFunnels] Migration não aplicada no banco (colunas ausentes). Atualizando sem campos novos.', error);
          const fallback = await (supabase as any)
            .from('quick_funnels')
            .update({ title, steps, is_ai_agent: isAiAgent })
            .eq('id', id)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          setFunnels(prev => prev.map(funnel => funnel.id === id ? (fallback.data as Funnel) : funnel));
          toast({
            title: 'Sucesso',
            description: 'Funil atualizado com sucesso',
          });
          return;
        }
      }

      if (error) throw error;

      setFunnels(prev => prev.map(funnel => funnel.id === id ? (data as Funnel) : funnel));
      toast({
        title: 'Sucesso',
        description: 'Funil atualizado com sucesso',
      });
    } catch (error) {
      console.error('Error updating funnel:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar funil. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const deleteFunnel = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('quick_funnels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFunnels(prev => prev.filter(funnel => funnel.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Funil excluído com sucesso',
      });
    } catch (error) {
      console.error('Error deleting funnel:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir funil',
        variant: 'destructive',
      });
    }
  };

  return {
    funnels,
    loading,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    refetch: fetchFunnels,
  };
}
