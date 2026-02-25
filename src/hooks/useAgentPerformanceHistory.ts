import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, eachDayOfInterval, format } from 'date-fns';

interface PerformanceDataPoint {
  date: string;
  totalConversations: number;
  activeConversations: number;
  activations: number;
  deactivations: number;
  successRate: number;
}

export const useAgentPerformanceHistory = (workspaceId?: string, days: number = 30) => {
  return useQuery({
    queryKey: ['agent-performance-history', workspaceId, days],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subDays(endDate, days);

      // Buscar histórico de agentes
      let historyQuery = supabase
        .from('conversation_agent_history' as any)
        .select(`
          created_at,
          action,
          agent_id,
          conversation_id,
          metadata
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (workspaceId) {
        // Buscar conversas do workspace
        const { data: conversations } = await supabase
          .from('whatsapp_conversations' as any)
          .select('id')
          .eq('workspace_id', workspaceId);

        if (conversations && conversations.length > 0) {
          const conversationIds = conversations.map((c: any) => c.id);
          historyQuery = historyQuery.in('conversation_id', conversationIds);
        } else {
          return [];
        }
      }

      const { data: history, error } = await historyQuery;

      if (error) {
        console.error('Erro ao buscar histórico de performance:', error);
        throw error;
      }

      // Criar array de todos os dias no intervalo
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

      // Agregar dados por dia
      const dataByDay = dateRange.map(date => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        const dayHistory = (history || []).filter((h: any) => {
          const historyDate = new Date(h.created_at);
          return historyDate >= dayStart && historyDate <= dayEnd;
        });

        const activations = dayHistory.filter((h: any) => h.action === 'activated').length;
        const deactivations = dayHistory.filter((h: any) => h.action === 'deactivated').length;
        
        // Conversas únicas do dia
        const uniqueConversations = new Set(dayHistory.map((h: any) => h.conversation_id)).size;
        
        // Conversas ativas no final do dia
        const activeAtEndOfDay = dayHistory.reduce((acc: Set<string>, h: any) => {
          if (h.action === 'activated') acc.add(h.conversation_id);
          if (h.action === 'deactivated') acc.delete(h.conversation_id);
          return acc;
        }, new Set<string>()).size;

        // Taxa de sucesso: (ativações - desativações) / ativações * 100
        const successRate = activations > 0 
          ? ((activations - deactivations) / activations) * 100 
          : 0;

        return {
          date: format(date, 'dd/MM'),
          totalConversations: uniqueConversations,
          activeConversations: activeAtEndOfDay,
          activations,
          deactivations,
          successRate: Math.max(0, Math.min(100, successRate)),
        } as PerformanceDataPoint;
      });

      return dataByDay;
    },
    enabled: true,
  });
};
