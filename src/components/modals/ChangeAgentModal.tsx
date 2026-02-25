import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { Bot, Check, Loader2, Sparkles, Power } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangeAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentAgentId?: string | null;
  onAgentChanged?: () => void;
}

export function ChangeAgentModal({
  open,
  onOpenChange,
  conversationId,
  currentAgentId,
  onAgentChanged
}: ChangeAgentModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(currentAgentId || null);
  const [actualCurrentAgentId, setActualCurrentAgentId] = useState<string | null>(currentAgentId || null);

  // Buscar o agente ativo REAL do banco quando o modal abrir
  useEffect(() => {
    const fetchCurrentAgent = async () => {
      if (!open || !conversationId) return;
      
      console.log('🔄 Modal de agente aberto - Buscando agente atual do banco');
      
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('agente_ativo, agent_active_id')
          .eq('id', conversationId)
          .single();
        
        if (error) throw error;
        
        // IMPORTANTE:
        // Se o N8N desativar `agente_ativo=false` mas deixar `agent_active_id` preenchido,
        // o modal precisa refletir o estado REAL (agente inativo).
        const isActive = !!data?.agente_ativo;
        const agentId = isActive ? (data?.agent_active_id || null) : null;
        console.log('✅ Agente atual do banco:', { isActive, agentId });
        setActualCurrentAgentId(agentId);
        setSelectedAgentId(agentId);
      } catch (error) {
        console.error('❌ Erro ao buscar agente atual:', error);
        setActualCurrentAgentId(null);
        setSelectedAgentId(null);
      }
      
      // Refresh da lista de agentes
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
    };

    fetchCurrentAgent();
  }, [open, conversationId, selectedWorkspace?.workspace_id, queryClient]);

  // 🔄 Realtime subscription para atualizar agente ativo quando a conversa mudar
  useEffect(() => {
    if (!open || !conversationId) return;

    console.log('👂 Configurando realtime para agente ativo na conversa:', conversationId);

    const channel = supabase
      .channel(`change-agent-modal-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${conversationId}`
        },
        (payload) => {
          console.log('🔔 [Realtime ChangeAgentModal] Conversa atualizada:', payload);
          
          const isActive = !!(payload.new as any).agente_ativo;
          const newAgentId = isActive ? ((payload.new as any).agent_active_id || null) : null;
          console.log('🔄 [Realtime ChangeAgentModal] Novo agente ativo:', { isActive, newAgentId });
          
          setActualCurrentAgentId(newAgentId);
          setSelectedAgentId(newAgentId);
          
          // Invalidar queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['conversation-agent', conversationId] });
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Desconectando realtime do ChangeAgentModal');
      supabase.removeChannel(channel);
    };
  }, [open, conversationId, queryClient]);

  // Buscar agentes ativos do workspace
  const { data: agents, isLoading } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, description, is_active')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWorkspace?.workspace_id && open,
  });

  const handleChangeAgent = async () => {
    if (!selectedAgentId) {
      toast({
        title: "❌ Erro",
        description: "Selecione um agente para continuar",
        variant: "destructive",
      });
      return;
    }

    setIsChanging(true);
    try {
      // Buscar nome do agente anterior e do novo agente
      const oldAgentData = actualCurrentAgentId
        ? (await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', actualCurrentAgentId)
            .single()).data
        : null;

      const { data: newAgentData } = await supabase
        .from('ai_agents')
        .select('name')
        .eq('id', selectedAgentId)
        .single();

      // Atualizar o agente ativo da conversa
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agent_active_id: selectedAgentId,
          agente_ativo: true
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Registrar no histórico de agentes
      await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversationId,
          action: 'changed',
          agent_id: selectedAgentId,
          agent_name: newAgentData?.name || 'Novo agente',
          changed_by: (await supabase.auth.getUser()).data.user?.id || null,
          metadata: {
            old_agent_id: actualCurrentAgentId,
            old_agent_name: oldAgentData?.name
          }
        });

      toast({
        title: "✅ Agente trocado",
        description: `Agora usando: ${newAgentData?.name || 'Novo agente'}`,
      });

      // Atualizar dados do modal
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-agent', conversationId] });

      onAgentChanged?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao trocar agente:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível trocar o agente",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  const handleDeactivateAgent = async () => {
    setIsChanging(true);
    try {
      // ✅ Fonte da verdade: buscar estado atual da conversa (evita id=null por race/stale state)
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select('agente_ativo, agent_active_id')
        .eq('id', conversationId)
        .single();

      if (convErr) throw convErr;

      const agentIdToLog =
        (convData?.agente_ativo ? (convData?.agent_active_id || null) : null) ??
        actualCurrentAgentId ??
        null;

      // Buscar nome do agente atual antes de desativar (somente se tiver ID)
      const agentData = agentIdToLog
        ? (await supabase
            .from('ai_agents')
            .select('name')
            .eq('id', agentIdToLog)
            .single()).data
        : null;

      // Desativar o agente da conversa
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: false,
          agent_active_id: null
        })
        .eq('id', conversationId);

      if (error) throw error;

      // Registrar no histórico de agentes
      if (agentIdToLog) {
      await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversationId,
          action: 'deactivated',
            agent_id: agentIdToLog,
          agent_name: agentData?.name || 'Agente IA',
          changed_by: (await supabase.auth.getUser()).data.user?.id || null
          });
      } else {
        console.warn('⚠️ handleDeactivateAgent: desativando sem agent_active_id para registrar histórico', {
          conversationId,
          convData
        });
      }

      toast({
        title: "✅ Agente desativado",
        description: "O agente foi desativado com sucesso",
      });

      // Atualizar dados do modal
      queryClient.invalidateQueries({ queryKey: ['workspace-agents', selectedWorkspace?.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['conversation-agent', conversationId] });

      onAgentChanged?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao desativar agente:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível desativar o agente",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 border border-[#d4d4d4] bg-white shadow-sm rounded-none dark:bg-[#1f1f1f] dark:border-gray-700">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-200 bg-transparent dark:border-gray-700 dark:bg-transparent">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
            <Bot className="w-5 h-5" />
            {actualCurrentAgentId ? 'Trocar Agente de IA' : 'Ativar Agente de IA'}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-700 dark:text-gray-300">
            {actualCurrentAgentId 
              ? 'Selecione um novo agente para esta conversa. O agente permanecerá ativo.'
              : 'Selecione um agente para ativar nesta conversa.'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 bg-white dark:bg-[#1f1f1f]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground dark:text-gray-400" />
            </div>
          ) : agents && agents.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto pr-4 -mr-4">
              <div className="space-y-2 pr-4">
                {agents.map((agent) => {
                  const isCurrentAgent = agent.id === actualCurrentAgentId;
                  const isSelected = agent.id === selectedAgentId;

                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      disabled={isCurrentAgent}
                      className={cn(
                        "w-full p-3 rounded-none border transition-all text-left flex items-start gap-3 bg-white dark:bg-[#2d2d2d]",
                        isCurrentAgent && "opacity-60 cursor-not-allowed border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700",
                        !isCurrentAgent && "hover:bg-[#e6f2ff] hover:border-primary/30 dark:hover:bg-primary/20 dark:hover:border-primary/30",
                        !isCurrentAgent && isSelected && "border-primary bg-[#e6f2ff] dark:bg-primary/20 dark:border-primary",
                        !isCurrentAgent && !isSelected && "border-[#d4d4d4] dark:border-gray-700"
                      )}
                    >
                      <Avatar className={cn(
                        "w-8 h-8 transition-all rounded-none",
                        isSelected && !isCurrentAgent && "ring-1 ring-primary ring-offset-1 dark:ring-offset-gray-800"
                      )}>
                        <AvatarFallback className={cn(
                          "text-white font-bold text-xs rounded-none",
                          isSelected && !isCurrentAgent ? "bg-primary" : "bg-gray-400 dark:bg-gray-600"
                        )}>
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-bold text-xs text-gray-900 dark:text-gray-100">{agent.name}</h4>
                          {isCurrentAgent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-none bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />
                              Agente Ativo
                            </Badge>
                          )}
                          {isSelected && !isCurrentAgent && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          )}
                        </div>
                        {agent.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight dark:text-gray-400">
                            {agent.description}
                          </p>
                        )}
                        {isCurrentAgent && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic dark:text-gray-500">
                            Este agente já está ativo nesta conversa
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-50 dark:text-gray-500" />
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                Nenhum agente ativo encontrado
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 p-4 bg-gray-50 border-t border-[#d4d4d4] m-0 dark:bg-[#1a1a1a] dark:border-gray-700">
          <Button
            variant="destructive"
            onClick={handleDeactivateAgent}
            disabled={isChanging}
            className="h-8 text-xs rounded-none dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70"
          >
            {isChanging ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Desativando...
              </>
            ) : (
              <>
                <Power className="w-3.5 h-3.5 mr-2" />
                Desativar Agente
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isChanging}
              className="h-8 text-xs rounded-none border-gray-300 bg-white hover:bg-gray-100 text-gray-700 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeAgent}
              disabled={isChanging || !selectedAgentId || selectedAgentId === actualCurrentAgentId}
              className={cn(
                "h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground",
                selectedAgentId === actualCurrentAgentId && "opacity-50 cursor-not-allowed"
              )}
            >
              {isChanging ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Trocando...
                </>
              ) : selectedAgentId === actualCurrentAgentId ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-2" />
                  Agente Atual
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-2" />
                  {actualCurrentAgentId ? 'Trocar Agente' : 'Ativar Agente'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
