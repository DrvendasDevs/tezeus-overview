import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface AgentStats {
  agentId: string;
  agentName: string;
  totalConversations: number;
  activeConversations: number;
  averageActiveDuration: number; // em minutos
  activationCount: number;
  deactivationCount: number;
  lastUsed: string | null;
}

export const useAgentStats = (workspaceId?: string) => {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  
  const targetWorkspaceId = workspaceId || selectedWorkspace?.workspace_id;

  const fetchAgentStats = async () => {
    if (!targetWorkspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const currentWorkspaceId = targetWorkspaceId;

      // Buscar todos os agentes do workspace
      const { data: agents, error: agentsError } = await supabase
        .from('ai_agents')
        .select('id, name, workspace_id')
        .eq('workspace_id', currentWorkspaceId);

      if (agentsError) {
        console.error('❌ Erro ao buscar agentes:', agentsError);
        throw agentsError;
      }

      if (!agents || agents.length === 0) {
        setStats([]);
        setIsLoading(false);
        return;
      }

      // Para cada agente, buscar estatísticas
      const agentStatsPromises = agents.map(async (agent) => {
        // Buscar histórico de uso do agente
        const { data: history, error: historyError } = await supabase
          .from('conversation_agent_history' as any)
          .select('id, action, created_at, conversation_id')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false });

        if (historyError) {
          console.error(`❌ Erro ao buscar histórico do agente ${agent.id}:`, historyError);
          return null;
        }

        const historyData = (history || []) as unknown as Array<{
          id: string;
          action: string;
          created_at: string;
          conversation_id: string;
        }>;

        // Buscar conversas ativas com este agente
        const { data: activeConversations, error: activeError } = await supabase
          .from('conversations')
          .select('id')
          .eq('workspace_id', currentWorkspaceId)
          .eq('agent_active_id', agent.id)
          .eq('status', 'open');

        if (activeError) {
          console.error(`❌ Erro ao buscar conversas ativas do agente ${agent.id}:`, activeError);
        }

        // Calcular estatísticas
        const activations = historyData.filter(h => h.action === 'activated');
        const deactivations = historyData.filter(h => h.action === 'deactivated');
        const uniqueConversations = new Set(historyData.map(h => h.conversation_id));
        
        // Calcular tempo médio ativo (simplificado - pode ser melhorado)
        let totalDuration = 0;
        let durationCount = 0;
        
        // Agrupar por conversa para calcular durações
        const conversationGroups = new Map<string, typeof historyData>();
        historyData.forEach(h => {
          if (!conversationGroups.has(h.conversation_id)) {
            conversationGroups.set(h.conversation_id, []);
          }
          conversationGroups.get(h.conversation_id)?.push(h);
        });

        conversationGroups.forEach(events => {
          // Ordenar por data
          events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
          for (let i = 0; i < events.length - 1; i++) {
            if (events[i].action === 'activated' && events[i + 1].action === 'deactivated') {
              const start = new Date(events[i].created_at).getTime();
              const end = new Date(events[i + 1].created_at).getTime();
              const duration = (end - start) / (1000 * 60); // em minutos
              totalDuration += duration;
              durationCount++;
            }
          }
        });

        const averageActiveDuration = durationCount > 0 ? totalDuration / durationCount : 0;
        const lastUsed = historyData.length > 0 ? historyData[0].created_at : null;

        return {
          agentId: agent.id,
          agentName: agent.name,
          totalConversations: uniqueConversations.size,
          activeConversations: activeConversations?.length || 0,
          averageActiveDuration: Math.round(averageActiveDuration),
          activationCount: activations.length,
          deactivationCount: deactivations.length,
          lastUsed,
        } as AgentStats;
      });

      const agentStats = (await Promise.all(agentStatsPromises)).filter(Boolean) as AgentStats[];
      
      // Ordenar por total de conversas (mais usado primeiro)
      agentStats.sort((a, b) => b.totalConversations - a.totalConversations);
      
      setStats(agentStats);
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas de agentes:', error);
      setStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentStats();
  }, [targetWorkspaceId]);

  return {
    stats,
    isLoading,
    refetch: fetchAgentStats,
  };
};
