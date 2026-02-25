import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  dealCount: number;
  dealIds: string[];
}

export function usePipelineActiveUsers(pipelineId?: string, workspaceId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activeUsers = [], isLoading } = useQuery({
    queryKey: ['pipeline-active-users', pipelineId, workspaceId],
    queryFn: async () => {
      if (!pipelineId || !workspaceId) return [];
      
      // Buscar membros do workspace via Edge Function
      const { data: membersResponse, error: membersError } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'list',
          workspaceId
        },
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': workspaceId
        }
      });

      if (membersError) {
        console.error('Error fetching workspace members:', membersError);
        return [];
      }

      if (!membersResponse?.success) {
        console.error('Failed to fetch workspace members:', membersResponse);
        return [];
      }

      const members = membersResponse.members || [];
      const allUsers = members
        .filter((member: any) => member.user)
        .map((member: any) => member.user);

      const currentUser = allUsers.find((u: any) => u.email === user?.email);
      if (!currentUser) return [];

      // Buscar todos os cards do pipeline
      const { data: cards, error: cardsError } = await supabase
        .from('pipeline_cards')
        .select(`
          id,
          description,
          responsible_user_id,
          conversation_id,
          conversations(
            id,
            status,
            assigned_user_id
          )
        `)
        .eq('pipeline_id', pipelineId);

      if (cardsError) {
        console.error('Error fetching cards:', cardsError);
        return [];
      }

      // Coletar IDs de usuários responsáveis
      const userIds = new Set<string>();
      
      cards?.forEach((card: any) => {
        if (card.responsible_user_id) {
          userIds.add(card.responsible_user_id);
        }
        if (card.conversations?.assigned_user_id) {
          userIds.add(card.conversations.assigned_user_id);
        }
      });

      if (userIds.size === 0) return [];

      const users = allUsers.filter((u: any) => userIds.has(u.id));

      // Agrupar por usuário
      const userMap = new Map<string, ActiveUser>();
      
      cards?.forEach((card: any) => {
        const userId = card.responsible_user_id || card.conversations?.assigned_user_id;
        
        if (userId) {
          const foundUser = users?.find((u: any) => u.id === userId);
          if (foundUser) {
            if (userMap.has(userId)) {
              const existingUser = userMap.get(userId)!;
              existingUser.dealCount += 1;
              existingUser.dealIds.push(card.id);
            } else {
              userMap.set(userId, {
                id: userId,
                name: foundUser.name,
                avatar: foundUser.avatar,
                dealCount: 1,
                dealIds: [card.id]
              });
            }
          }
        }
      });

      return Array.from(userMap.values());
    },
    enabled: !!pipelineId && !!workspaceId && !!user?.email,
    // 🚀 Performance: cache por 5 min para evitar refetch pesado ao remontar o board
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Função para forçar atualização manual (invalida cache)
  const refreshActiveUsers = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-active-users', pipelineId, workspaceId] });
  }, [queryClient, pipelineId, workspaceId]);

  return { activeUsers, isLoading, refreshActiveUsers };
}