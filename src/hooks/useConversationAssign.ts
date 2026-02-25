import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export const useConversationAssign = () => {
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const { getHeaders } = useWorkspaceHeaders();

  const assignConversation = async (conversationId: string, targetUserId: string | null) => {
    try {
      setIsAssigning(conversationId);
      
      const headers = getHeaders();
      
      const { data: response, error } = await supabase.functions.invoke('assign-conversation', {
        body: { 
          conversation_id: conversationId,
          target_user_id: targetUserId
        },
        headers
      });

      if (error) {
        throw error;
      }

      if (!response.success) {
        throw new Error(response.error);
      }

      let actionText = 'atribuída';
      if (response.action === 'transfer') {
        actionText = 'transferida';
      } else if (response.action === 'unassign') {
        actionText = 'desvinculada';
      }

      toast({
        title: `Conversa ${actionText}`,
        description: `A conversa foi ${actionText} com sucesso`,
      });

      return { success: true, conversation: response.conversation, action: response.action };

    } catch (error) {
      console.error('❌ Error assigning conversation:', error);
      
      toast({
        title: "Erro ao atribuir conversa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      
      return { success: false, error: error.message };
    } finally {
      setIsAssigning(null);
    }
  };

  return {
    assignConversation,
    isAssigning
  };
};
