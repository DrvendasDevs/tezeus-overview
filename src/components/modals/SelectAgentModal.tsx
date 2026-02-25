import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePipelinesContext } from '@/contexts/PipelinesContext';
import { toast } from '@/hooks/use-toast';
import { Bot } from 'lucide-react';

interface SelectAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export const SelectAgentModal = ({ open, onOpenChange, conversationId }: SelectAgentModalProps) => {
  const { selectedWorkspace } = useWorkspace();
  const { updateConversationAgentStatus } = usePipelinesContext();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('none');
  const queryClient = useQueryClient();

  // Buscar dados da conversa
  const { data: conversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      
      const { data, error } = await supabase
        .from('conversations')
        .select('agente_ativo, agent_active_id')
        .eq('id', conversationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // 🔄 Pre-carregar sempre o estado REAL quando o modal abrir
  useEffect(() => {
    if (!open || !conversationId) return;
    queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    queryClient.refetchQueries({ queryKey: ['conversation', conversationId] });
  }, [open, conversationId, queryClient]);

  // 🔄 Realtime: se o N8N ativar/desativar no banco, refletir no modal imediatamente
  useEffect(() => {
    if (!open || !conversationId) return;

    const channel = supabase
      .channel(`select-agent-modal-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        (payload) => {
          const isActive = !!(payload.new as any).agente_ativo;
          const agentId = isActive ? ((payload.new as any).agent_active_id || null) : null;

          // Atualizar query cache + estado local
          queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
            ...(old || {}),
            agente_ativo: isActive,
            agent_active_id: agentId,
          }));

          setSelectedAgentId(agentId || 'none');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, conversationId, queryClient]);

  // Atualizar selectedAgentId quando carregar a conversa
  useEffect(() => {
    if (conversation?.agente_ativo && conversation?.agent_active_id) {
      // Usar o ID do agente ativo
      setSelectedAgentId(conversation.agent_active_id);
    } else if (conversation?.agente_ativo) {
      // Se agente_ativo está true mas não tem agent_active_id, manter comportamento atual
      setSelectedAgentId('default');
    } else {
      setSelectedAgentId('none');
    }
  }, [conversation]);

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace?.workspace_id && open,
  });

  const activateAgentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId || selectedAgentId === 'none') {
        throw new Error('Nenhum agente selecionado');
      }
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: true,
          agent_active_id: selectedAgentId  // ✅ SALVAR ID DO AGENTE
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      
      // Snapshot do valor anterior
      const previousConversation = queryClient.getQueryData(['conversation', conversationId]);
      
      // Atualização otimista no Query Client
      queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
        ...old,
        agente_ativo: true,
        agent_active_id: selectedAgentId
      }));
      
      // 🔥 UPDATE OTIMISTA NO PIPELINES CONTEXT (para cards CRM)
      updateConversationAgentStatus(conversationId, true, selectedAgentId);
      
      return { previousConversation };
    },
    onSuccess: async () => {
      // Registrar no histórico de agentes
      try {
        const { data: agentData } = await supabase
          .from('ai_agents')
          .select('name')
          .eq('id', selectedAgentId)
          .single();

        await supabase
          .from('conversation_agent_history')
          .insert({
            conversation_id: conversationId,
            action: 'activated',
            agent_id: selectedAgentId,
            agent_name: agentData?.name || 'Agente IA',
            changed_by: (await supabase.auth.getUser()).data.user?.id || null
          });
      } catch (error) {
        console.error('Erro ao registrar histórico do agente:', error);
      }

      toast({
        title: 'Agente ativado',
        description: 'Agente IA ativado para esta conversa',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['card-history', conversationId] });
      onOpenChange(false);
    },
    onError: (error, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousConversation) {
        queryClient.setQueryData(['conversation', conversationId], context.previousConversation);
      }
      console.error('Erro ao ativar agente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível ativar o agente',
        variant: 'destructive',
      });
    },
  });

  const deactivateAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: false,
          agent_active_id: null  // ✅ LIMPAR ID DO AGENTE
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onMutate: async () => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['conversation', conversationId] });
      
      // Snapshot do valor anterior
      const previousConversation = queryClient.getQueryData(['conversation', conversationId]);
      
      // Atualização otimista no Query Client
      queryClient.setQueryData(['conversation', conversationId], (old: any) => ({
        ...old,
        agente_ativo: false,
        agent_active_id: null
      }));
      
      // 🔥 UPDATE OTIMISTA NO PIPELINES CONTEXT (para cards CRM)
      updateConversationAgentStatus(conversationId, false, null);
      
      return { previousConversation };
    },
    onSuccess: async () => {
      // Registrar no histórico de agentes
      try {
        const { data: agentData } = await supabase
          .from('ai_agents')
          .select('name')
          .eq('id', conversation?.agent_active_id)
          .single();

        await supabase
          .from('conversation_agent_history')
          .insert({
            conversation_id: conversationId,
            action: 'deactivated',
            agent_id: conversation?.agent_active_id,
            agent_name: agentData?.name || 'Agente IA',
            changed_by: (await supabase.auth.getUser()).data.user?.id || null
          });
      } catch (error) {
        console.error('Erro ao registrar histórico do agente:', error);
      }

      toast({
        title: 'Agente Desativado',
        description: 'O agente não irá mais interagir nessa conversa',
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['card-history', conversationId] });
      onOpenChange(false);
    },
    onError: (error, variables, context) => {
      // Reverter em caso de erro
      if (context?.previousConversation) {
        queryClient.setQueryData(['conversation', conversationId], context.previousConversation);
      }
      console.error('Erro ao desativar agente:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível desativar o agente',
        variant: 'destructive',
      });
    },
  });

  const handleActivate = () => {
    if (selectedAgentId === 'none') {
      toast({
        title: 'Atenção',
        description: 'Selecione um agente para ativar',
        variant: 'destructive',
      });
      return;
    }
    activateAgentMutation.mutate();
  };

  const handleDeactivate = () => {
    deactivateAgentMutation.mutate();
  };

  const isAgentActive = conversation?.agente_ativo;
  const isLoading = isLoadingConversation || isLoadingAgents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {isAgentActive ? 'Agente IA Ativo' : 'Ativar Agente IA'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!isAgentActive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione o agente</label>
              <Select 
                value={selectedAgentId} 
                onValueChange={setSelectedAgentId}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum agente</SelectItem>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAgentActive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Agente ativo</label>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    {conversation?.agent_active_id 
                      ? agents?.find(a => a.id === conversation.agent_active_id)?.name || 'Agente IA'
                      : 'Agente IA'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {isAgentActive ? (
              <Button 
                variant="destructive"
                onClick={handleDeactivate} 
                disabled={deactivateAgentMutation.isPending}
              >
                {deactivateAgentMutation.isPending ? 'Desativando...' : 'Desativar'}
              </Button>
            ) : (
              <Button 
                onClick={handleActivate} 
                disabled={activateAgentMutation.isPending}
              >
                {activateAgentMutation.isPending ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
