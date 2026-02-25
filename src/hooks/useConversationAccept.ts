import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export const useConversationAccept = () => {
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const { getHeaders } = useWorkspaceHeaders();

  const acceptConversation = async (conversationId: string, agentId: string | null = null) => {
    try {
      setIsAccepting(conversationId);
      
      console.log('🔵 Accepting conversation:', { conversationId, agentId });
      
      const headers = getHeaders();
      
      const { data: response, error } = await supabase.functions.invoke('accept-conversation', {
        body: { 
          conversation_id: conversationId,
          agent_id: agentId 
        },
        headers
      });

      console.log('📥 Accept response:', { response, error });

      if (error) {
        throw error;
      }

      if (!response.success) {
        if (response.error === 'Esta conversa já foi atribuída a outro usuário') {
          toast({
            title: "Conversa já atribuída",
            description: "Esta conversa já foi aceita por outro usuário",
            variant: "destructive",
          });
          return { success: false, alreadyAssigned: true };
        }
        throw new Error(response.error);
      }

      toast({
        title: "Conversa aceita",
        description: "Você aceitou esta conversa com sucesso",
      });

      return { success: true, conversation: response.conversation };

    } catch (error) {
      console.error('❌ Error accepting conversation:', error);
      
      toast({
        title: "Erro ao aceitar conversa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      
      return { success: false, error: error.message };
    } finally {
      setIsAccepting(null);
    }
  };

  return {
    acceptConversation,
    isAccepting
  };
};