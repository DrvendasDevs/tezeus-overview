import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, type Workspace } from '@/contexts/WorkspaceContext';
import { useCache } from './useCache';
import { useRetry } from './useRetry';

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { setWorkspaces: setContextWorkspaces, setIsLoadingWorkspaces } = useWorkspace();
  const { getCache, setCache, isExpired } = useCache<Workspace[]>(5); // 5 min cache
  const { retry } = useRetry();

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setContextWorkspaces([]);
      setIsLoadingWorkspaces(false);
      return;
    }

    // Check cache first
    const cached = getCache();
    if (cached && !isExpired()) {
      setWorkspaces(cached);
      setContextWorkspaces(cached);
      setIsLoadingWorkspaces(false);
      return;
    }

    setIsLoading(true);
    setIsLoadingWorkspaces(true);
    try {
      const data = await retry(async () => {
        const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
          headers: {
            'x-system-user-id': user.id,
            'x-system-user-email': user.email || ''
          }
        });
        if (error) throw error;
        return data;
      });

      // Transform the data to match expected format
      const workspaceData = data?.workspaces?.map((w: any) => ({
        workspace_id: w.workspace_id || w.id,
        name: w.name,
        default_pipeline_id: w.default_pipeline_id ?? null,
        slug: w.slug,
        cnpj: w.cnpj,
        created_at: w.created_at,
        updated_at: w.updated_at,
        connections_count: w.connections_count || 0,
        is_active: w.is_active !== false
      })) || [];

      // Workspaces fetched
      setWorkspaces(workspaceData);
      setContextWorkspaces(workspaceData);
      setCache(workspaceData);

      // Buscar estatísticas (negócios e conexões) via VIEW consolidada
      if (workspaceData.length > 0) {
        try {
          const workspaceIds = workspaceData.map((w: any) => w.workspace_id);
          const { data: statsData, error: statsError } = await supabase
            .from('v_workspace_stats')
            .select('*')
            .in('workspace_id', workspaceIds);

          if (statsError) throw statsError;

          if (statsData) {
            const statsMap = new Map(statsData.map(s => [s.workspace_id, s]));
            
            const updatedWorkspaces = workspaceData.map((w: any) => {
              const stats = statsMap.get(w.workspace_id);
              return {
                ...w,
                connections_count: stats?.connections_count || 0,
                deals_count: stats?.deals_count || 0
              };
            });

            setWorkspaces(updatedWorkspaces);
            setContextWorkspaces(updatedWorkspaces);
            setCache(updatedWorkspaces);
          }
        } catch (error) {
          console.error('❌ useWorkspaces: Erro ao buscar estatísticas via VIEW:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      
      // Use expired cache if available
      const cached = getCache();
      if (cached) {
        setWorkspaces(cached);
        setContextWorkspaces(cached);
      } else if (!workspaces.length) {
        toast({
          title: "Erro",
          description: "Falha ao carregar empresas",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      setIsLoadingWorkspaces(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setWorkspaces([]);
      setContextWorkspaces([]);
      setIsLoadingWorkspaces(false);
      return;
    }
    
    fetchWorkspaces();
  }, [user]);

  const createWorkspace = async (
    name: string,
    cnpj?: string,
    connectionLimit?: number,
    userLimit?: number,
    disparadorEnabled?: boolean,
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'create', name, cnpj, connectionLimit, userLimit, disparadorEnabled },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        // Handle specific error types
        if (error.message?.includes('401') || error.message?.includes('authenticated')) {
          toast({
            title: "Erro de Autenticação",
            description: "Sua sessão expirou. Faça login novamente.",
            variant: "destructive"
          });
        } else if (error.message?.includes('403') || error.message?.includes('master')) {
          toast({
            title: "Acesso Negado",
            description: "Somente usuários master podem criar empresas.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erro",
            description: "Falha ao criar empresa",
            variant: "destructive"
          });
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
      return data;
    } catch (error: any) {
      console.error('Error creating workspace:', error);
      
      // If error wasn't handled above, show generic message
      if (!error.message?.includes('401') && !error.message?.includes('403')) {
        toast({
          title: "Erro",
          description: "Falha ao criar empresa",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const updateWorkspace = async (
    workspaceId: string,
    updates: { name?: string; cnpj?: string; connectionLimit?: number; userLimit?: number; disparadorEnabled?: boolean },
  ) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'update', workspaceId, ...updates },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'delete', workspaceId },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Empresa removida com sucesso"
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  const toggleWorkspaceStatus = async (workspaceId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: { action: 'toggle-active', workspaceId, isActive },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || ''
        }
      });

      if (error) {
        throw error;
      }

      const statusText = isActive ? 'ativada' : 'inativada';
      toast({
        title: "Sucesso",
        description: `Empresa ${statusText} com sucesso`
      });

      fetchWorkspaces(); // Refresh list
    } catch (error) {
      console.error('Error toggling workspace status:', error);
      toast({
        title: "Erro",
        description: "Falha ao alterar status da empresa",
        variant: "destructive"
      });
      throw error;
    }
  };

  return {
    workspaces,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    toggleWorkspaceStatus,
    clearCache: () => setCache(null) // Adicionar função para limpar cache
  };
}