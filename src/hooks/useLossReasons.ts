import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase, withUserContext } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LossReason {
  id: string;
  name: string;
  workspace_id: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// 📸 Cache/Snapshot global para manter dados estáveis entre re-renders
const globalSnapshot: Map<string, { data: LossReason[]; timestamp: number }> = new Map();
const SNAPSHOT_TTL = 5 * 60 * 1000; // 5 minutos

export const useLossReasons = (workspaceId: string | null) => {
  // Inicializar com snapshot existente se disponível
  const getInitialData = (): LossReason[] => {
    if (!workspaceId) return [];
    const cached = globalSnapshot.get(workspaceId);
    if (cached) return cached.data;
    return [];
  };

  const [lossReasons, setLossReasons] = useState<LossReason[]>(getInitialData);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const fetchSeqRef = useRef(0);
  const lastToastAtRef = useRef(0);
  const isFetchingRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);

  const canToastNow = useMemo(() => {
    // debounce de erro para não "piscar" o toast em falhas transitórias
    return () => {
      const now = Date.now();
      if (now - lastToastAtRef.current < 5000) return false;
      lastToastAtRef.current = now;
      return true;
    };
  }, []);

  const fetchLossReasons = useCallback(async (forceRefresh = false) => {
    if (!workspaceId) {
      console.log('⚠️ useLossReasons: workspaceId não fornecido, pulando busca');
      return;
    }

    // Verificar cache válido (a menos que forçar refresh)
    if (!forceRefresh) {
      const cached = globalSnapshot.get(workspaceId);
      const now = Date.now();
      if (cached && (now - cached.timestamp) < SNAPSHOT_TTL) {
        console.log('💾 useLossReasons: Usando snapshot em cache:', cached.data.length, 'motivos');
        if (lossReasons.length === 0 || lossReasons !== cached.data) {
          setLossReasons(cached.data);
        }
        hasLoadedOnceRef.current = true;
        return;
      }
    }

    // Evitar fetch duplicado
    if (isFetchingRef.current) {
      console.log('⏸️ useLossReasons: Fetch já em andamento, ignorando...');
      return;
    }
    
    console.log('🔍 useLossReasons: Buscando motivos de perda para workspace:', workspaceId);
    isFetchingRef.current = true;
    
    // Só mostrar loading se ainda não carregou uma vez (evita piscar)
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    
    const seq = ++fetchSeqRef.current;
    
    try {
      let lastError: any = null;
      let data: any[] | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Usar withUserContext para garantir contexto de usuário
          const res = await withUserContext(() =>
            supabase
              .from('loss_reasons_view' as any)
              .select('id, name, workspace_id, is_active, created_at, updated_at')
              .eq('workspace_id', workspaceId)
              .order('name')
          );

          if (res.error) {
            // Fallback para tabela original se VIEW não existir
            console.log('⚠️ useLossReasons: VIEW não disponível, usando tabela original');
            const fallbackRes = await withUserContext(() =>
              supabase
                .from('loss_reasons')
                .select('*')
                .eq('workspace_id', workspaceId)
                .order('name')
            );
            
            if (fallbackRes.error) throw fallbackRes.error;
            data = fallbackRes.data || [];
          } else {
            data = res.data || [];
          }
          lastError = null;
          break;
        } catch (e: any) {
          lastError = e;
          await new Promise((r) => setTimeout(r, 300 + attempt * 500));
        }
      }

      if (lastError) throw lastError;
      
      // Evitar race: só aplica se for a requisição mais recente
      if (seq === fetchSeqRef.current) {
        console.log('✅ useLossReasons: Motivos de perda carregados:', data?.length || 0);
        
        // 📸 Salvar no snapshot global
        globalSnapshot.set(workspaceId, {
          data: data as LossReason[],
          timestamp: Date.now()
        });
        
        setLossReasons(data as LossReason[]);
        hasLoadedOnceRef.current = true;
      }
    } catch (error: any) {
      console.error('❌ useLossReasons: Erro ao carregar motivos de perda:', error);
      
      // 📸 Em caso de erro, usar snapshot existente se disponível
      const cached = globalSnapshot.get(workspaceId);
      if (cached && seq === fetchSeqRef.current) {
        console.log('📸 useLossReasons: Usando snapshot após erro:', cached.data.length, 'motivos');
        setLossReasons(cached.data);
        hasLoadedOnceRef.current = true;
      }
      
      if (seq === fetchSeqRef.current && canToastNow() && !hasLoadedOnceRef.current) {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os motivos de perda. Tentaremos novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [workspaceId, canToastNow, toast, lossReasons]);

  const createLossReason = async (name: string) => {
    if (!workspaceId) {
      console.error('❌ createLossReason: workspaceId não definido');
      toast({
        title: 'Erro',
        description: 'Workspace não identificado. Por favor, recarregue a página.',
        variant: 'destructive',
      });
      return null;
    }

    console.log('🔵 createLossReason: Criando motivo de perda:', { name, workspaceId });

    try {
      // Usar withUserContext para garantir que o contexto do usuário está definido
      const { data, error } = await withUserContext(() => 
        supabase
          .from('loss_reasons')
          .insert({
            name,
            workspace_id: workspaceId,
            is_active: true,
          })
          .select()
          .single()
      );

      if (error) {
        console.error('❌ createLossReason: Erro do Supabase:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      console.log('✅ createLossReason: Motivo criado com sucesso:', data);
      
      // Atualizar snapshot e estado local imediatamente
      const newReason = data as LossReason;
      const updatedReasons = [...lossReasons, newReason].sort((a, b) => a.name.localeCompare(b.name));
      
      globalSnapshot.set(workspaceId, {
        data: updatedReasons,
        timestamp: Date.now()
      });
      
      setLossReasons(updatedReasons);
      
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda criado com sucesso',
      });
      
      return data;
    } catch (error: any) {
      console.error('❌ createLossReason: Exceção:', error);
      
      // Mensagem de erro mais detalhada
      let errorMessage = 'Não foi possível criar o motivo de perda.';
      
      if (error?.code === '23505') {
        errorMessage = 'Já existe um motivo de perda com este nome.';
      } else if (error?.code === '42501' || error?.message?.includes('permission denied') || error?.message?.includes('policy')) {
        errorMessage = 'Você não tem permissão para criar motivos de perda. Verifique suas permissões com o administrador.';
      } else if (error?.code === '23503') {
        errorMessage = 'Workspace inválido. Por favor, recarregue a página.';
      } else if (error?.message) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      toast({
        title: 'Erro ao criar motivo de perda',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateLossReason = async (id: string, name?: string, isActive?: boolean) => {
    try {
      const updateData: { name?: string; is_active?: boolean; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };
      
      if (name !== undefined) {
        updateData.name = name;
      }
      
      if (isActive !== undefined) {
        updateData.is_active = isActive;
      }

      // Usar withUserContext para garantir que o contexto do usuário está definido
      const { error } = await withUserContext(() =>
        supabase
          .from('loss_reasons')
          .update(updateData)
          .eq('id', id)
      );

      if (error) throw error;
      
      // Atualizar snapshot e estado local imediatamente
      if (workspaceId) {
        const updatedReasons = lossReasons.map(r => 
          r.id === id ? { ...r, ...updateData } : r
        ).sort((a, b) => a.name.localeCompare(b.name));
        
        globalSnapshot.set(workspaceId, {
          data: updatedReasons,
          timestamp: Date.now()
        });
        
        setLossReasons(updatedReasons);
      }
      
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda atualizado com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao atualizar motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o motivo de perda',
        variant: 'destructive',
      });
    }
  };

  const deleteLossReason = async (id: string) => {
    try {
      // Usar withUserContext para garantir que o contexto do usuário está definido
      const { error } = await withUserContext(() =>
        supabase
          .from('loss_reasons')
          .delete()
          .eq('id', id)
      );

      if (error) throw error;
      
      // Atualizar snapshot e estado local imediatamente
      if (workspaceId) {
        const updatedReasons = lossReasons.filter(r => r.id !== id);
        
        globalSnapshot.set(workspaceId, {
          data: updatedReasons,
          timestamp: Date.now()
        });
        
        setLossReasons(updatedReasons);
      }
      
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda excluído com sucesso',
      });
    } catch (error: any) {
      console.error('Erro ao excluir motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o motivo de perda',
        variant: 'destructive',
      });
    }
  };

  // Carregar dados quando workspaceId mudar
  useEffect(() => {
    if (workspaceId) {
      // Primeiro, verificar se tem dados no snapshot para mostrar imediatamente
      const cached = globalSnapshot.get(workspaceId);
      if (cached) {
        setLossReasons(cached.data);
        hasLoadedOnceRef.current = true;
      }
      // Depois buscar dados atualizados
      fetchLossReasons();
    } else {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Retornar dados do snapshot se o estado estiver vazio mas o snapshot tiver dados
  const stableLossReasons = useMemo(() => {
    if (lossReasons.length > 0) return lossReasons;
    if (workspaceId) {
      const cached = globalSnapshot.get(workspaceId);
      if (cached) return cached.data;
    }
    return lossReasons;
  }, [lossReasons, workspaceId]);

  return {
    lossReasons: stableLossReasons,
    isLoading,
    fetchLossReasons: () => fetchLossReasons(true), // Força refresh quando chamado manualmente
    createLossReason,
    updateLossReason,
    deleteLossReason,
  };
};
