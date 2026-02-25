import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AgentHistoryEntry {
  id: string;
  agent_id: string | null;
  agent_name: string;
  action: 'activated' | 'deactivated' | 'changed';
  changed_by: string | null;
  created_at: string;
  metadata?: any;
}

export const useAgentHistory = (conversationId?: string) => {
  return useQuery({
    queryKey: ['agent-history', conversationId],
    queryFn: async () => {
      if (!conversationId || conversationId.trim() === '') {
        console.log('⚠️ useAgentHistory: conversationId inválido');
        return [];
      }

      console.log('🔍 useAgentHistory: Buscando histórico para:', conversationId);

      const { data, error } = await supabase
        .from('conversation_agent_history' as any)
        .select(`
          id,
          agent_id,
          agent_name,
          action,
          changed_by,
          created_at,
          metadata
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar histórico de agentes:', error);
        throw error;
      }

      const result = (data || []) as unknown as AgentHistoryEntry[];
      console.log('✅ useAgentHistory: Encontrados', result.length, 'itens');
      return result;
    },
    enabled: !!conversationId && conversationId.trim() !== '',
  });
};
