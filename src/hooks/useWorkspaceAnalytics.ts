import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useRetry } from './useRetry';

export interface WorkspaceAnalytics {
  activeConversations: number;
  totalConversations: number;
  dealsInProgress: number;
  completedDeals: number;
  lostDeals: number;
  conversionRate: number;
  averageResponseTime: number;
  conversationTrends: { date: string; count: number }[];
  dealTrends: { date: string; completed: number; lost: number }[];
}

export const useWorkspaceAnalytics = () => {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics>({
    activeConversations: 0,
    totalConversations: 0,
    dealsInProgress: 0,
    completedDeals: 0,
    lostDeals: 0,
    conversionRate: 0,
    averageResponseTime: 0,
    conversationTrends: [],
    dealTrends: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();
  const { getHeaders } = useWorkspaceHeaders();
  const { retry } = useRetry();
  const hasFetched = useRef(false);

  const fetchAnalytics = async () => {
    setIsLoading(true); // Skeleton imediato
    
    if (!selectedWorkspace || !user) {
      setIsLoading(false);
      return;
    }
    
    try {
      const workspaceId = selectedWorkspace.workspace_id;
      
      // Get headers - if fail, return early
      let headers;
      try {
        headers = getHeaders();
      } catch (error) {
        console.error('❌ Analytics: Failed to get headers', error);
        setIsLoading(false);
        return;
      }

      console.log('📡 Analytics: Calling get-workspace-analytics edge function for workspace:', workspaceId);

      // CHAMADA OTIMIZADA: Uma única chamada para a Edge Function que faz tudo no servidor
      const { data, error } = await supabase.functions.invoke('get-workspace-analytics', {
        body: { workspaceId: workspaceId }, 
        headers
      });

      console.log('📡 [DEBUG ANALYTICS] Resposta bruta do servidor:', data);

      if (error) {
        console.error('❌ [DEBUG ANALYTICS] Erro ao invocar função:', error);
        throw error;
      }

      if (!data) {
        console.error('❌ [DEBUG ANALYTICS] Resposta vazia do servidor');
        throw new Error('Resposta vazia');
      }

      const edgeAnalytics: WorkspaceAnalytics = {
        activeConversations: Number(data.activeConversations ?? 0),
        totalConversations: Number(data.totalConversations ?? 0),
        dealsInProgress: Number(data.dealsInProgress ?? 0),
        completedDeals: Number(data.completedDeals ?? 0),
        lostDeals: Number(data.lostDeals ?? 0),
        conversionRate: Number(data.conversionRate ?? 0),
        averageResponseTime: Number(data.averageResponseTime ?? 0),
        conversationTrends: Array.isArray(data.conversationTrends) ? data.conversationTrends : [],
        dealTrends: Array.isArray(data.dealTrends) ? data.dealTrends : [],
      };

      // Fallback: se a edge retornar tudo 0, tenta contagem direta no client para não quebrar o dashboard
      const isAllZero =
        edgeAnalytics.activeConversations === 0 &&
        edgeAnalytics.totalConversations === 0 &&
        edgeAnalytics.dealsInProgress === 0 &&
        edgeAnalytics.completedDeals === 0 &&
        edgeAnalytics.lostDeals === 0;

      if (isAllZero) {
        console.warn("⚠️ Edge function retornou tudo zero, executando fallback local");

        // Contar conversas diretamente
        const { data: convs, error: convError } = await supabase
          .from("conversations")
          .select("id, status")
          .eq("workspace_id", workspaceId);

        if (convError) {
          console.error("❌ Fallback conversas:", convError);
        }

        const totalConversations = convs?.length || 0;
        const activeConversations =
          convs?.filter((c) =>
            ["open", "aberto", "active", "pendente", "waiting"].includes(
              (c as any).status?.toLowerCase?.()
            )
          ).length || 0;

        // Contar negócios diretamente
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id")
          .eq("workspace_id", workspaceId);
        const pipelineIds = pipelines?.map((p) => p.id) || [];

        let dealsInProgress = 0;
        let completedDeals = 0;
        let lostDeals = 0;

        if (pipelineIds.length > 0) {
          const { data: cards, error: cardsError } = await supabase
            .from("pipeline_cards")
            .select("status")
            .in("pipeline_id", pipelineIds);

          if (cardsError) {
            console.error("❌ Fallback cards:", cardsError);
          } else if (cards) {
            cards.forEach((card: any) => {
              const s = card.status?.toLowerCase?.();
              if (s === "won" || s === "ganho" || s === "vitoria" || s === "concluido") {
                completedDeals++;
              } else if (s === "lost" || s === "perdido" || s === "derrota" || s === "cancelado") {
                lostDeals++;
              } else {
                dealsInProgress++;
              }
            });
          }
        }

        const totalClosed = completedDeals + lostDeals;
        const conversionRate = totalClosed > 0 ? (completedDeals / totalClosed) * 100 : 0;

        setAnalytics({
          activeConversations,
          totalConversations,
          dealsInProgress,
          completedDeals,
          lostDeals,
          conversionRate,
          averageResponseTime: 0,
          conversationTrends: [],
          dealTrends: [],
        });
      } else {
        setAnalytics(edgeAnalytics);
      }
      
      setIsLoading(false);

    } catch (error) {
      console.error('❌ Analytics: Error fetching workspace analytics:', error);
      
      // Set default values on error
      const defaultAnalytics = {
        activeConversations: 0,
        totalConversations: 0,
        dealsInProgress: 0,
        completedDeals: 0,
        lostDeals: 0,
        conversionRate: 0,
        averageResponseTime: 0,
        conversationTrends: [],
        dealTrends: [],
      };
      
      setAnalytics(defaultAnalytics);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedWorkspace || !user?.id) return;
    
    // Refetch sempre que o workspace_id mudar
    fetchAnalytics();
  }, [selectedWorkspace?.workspace_id, user?.id]);

  return {
    analytics,
    isLoading,
    refetch: fetchAnalytics,
  };
};