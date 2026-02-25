import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssignmentEntry {
  id: string;
  action: string;
  changed_at: string;
  changed_by: string | null;
  from_assigned_user_id: string | null;
  to_assigned_user_id: string | null;
  from_queue_id?: string | null;
  to_queue_id?: string | null;
  from_user_name?: string;
  to_user_name?: string;
  changed_by_name?: string;
  from_queue_name?: string | null;
  to_queue_name?: string | null;
}

export const useConversationAssignments = (conversationId?: string) => {
  return useQuery({
    queryKey: ['conversation-assignments', conversationId],
    queryFn: async () => {
      if (!conversationId || conversationId.trim() === '') {
        console.log('⚠️ useConversationAssignments: conversationId inválido');
        return [];
      }

      console.log('🔍 useConversationAssignments: Buscando histórico para:', conversationId);

      const { data, error } = await supabase.functions.invoke('conversation-assignments-history', {
        body: { conversation_id: conversationId }
      });

      if (error) {
        console.error('❌ Erro ao buscar histórico de atribuições:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('❌ Falha ao carregar histórico de atribuições:', data?.error);
        throw new Error(data?.error || 'Falha ao carregar histórico de atribuições');
      }

      const items = (data.items || []).map((entry: any) => ({
        ...entry,
        from_user_name: entry.from_user_name ?? null,
        to_user_name: entry.to_user_name ?? null,
        changed_by_name: entry.changed_by_name ?? null,
        from_queue_id: entry.from_queue_id ?? null,
        to_queue_id: entry.to_queue_id ?? null,
        from_queue_name: entry.from_queue_name ?? null,
        to_queue_name: entry.to_queue_name ?? null,
      })) as AssignmentEntry[];

      console.log('✅ useConversationAssignments: Encontrados', items.length, 'itens');
      return items;
    },
    enabled: !!conversationId && conversationId.trim() !== '',
  });
};
