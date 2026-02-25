import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useWorkspaceAgent = (conversationId?: string) => {
  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['conversation-agent', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return null;
      }
      
      // Primeiro busca a conversa para pegar o agent_active_id
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('agent_active_id, agente_ativo')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (convError) {
        console.error('❌ Erro ao buscar conversa:', convError);
        throw convError;
      }
      
      if (!conversation?.agent_active_id || !conversation?.agente_ativo) {
        return null;
      }
      
      // Agora busca os dados do agente
      const { data: agentData, error: agentError } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('id', conversation.agent_active_id)
        .maybeSingle();
      
      if (agentError) {
        console.error('❌ Erro ao buscar agente:', agentError);
        throw agentError;
      }
      
      return agentData;
    },
    enabled: !!conversationId,
    // 🚀 Performance: evita refetch em massa ao remontar o board (50+ cards = 100+ queries)
    // O pipeline-level realtime (usePipelineRealtime) já atualiza conversation.agente_ativo
    // via handleConversationUpdate, então o staleTime pode ser alto.
    staleTime: 5 * 60 * 1000,  // 5 minutos — dados são considerados frescos
    gcTime: 10 * 60 * 1000,    // 10 minutos — mantém cache mesmo após unmount
    refetchOnWindowFocus: false, // Não refazer 50+ queries ao focar na janela
  });

  // ✅ Canal realtime REMOVIDO — o PipelinesContext já escuta conversations via
  // usePipelineRealtime e atualiza agente_ativo/agent_active_id por handleConversationUpdate.
  // Manter um canal por card criava N canais WebSocket (1 por card visível).
  
  const hasAgent = !!agent;
  
  return { 
    agent, 
    hasAgent, 
    isLoading 
  };
};
