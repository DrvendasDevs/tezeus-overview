import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface WhatsAppMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia' | 'system' | 'user';
  created_at: string;
  message_type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'sticker';
  file_url?: string;
  file_name?: string;
  external_id?: string;
  evolution_key_id?: string;
  mime_type?: string;
  status?: string;
  metadata?: any;
}

interface Contact {
  id: string;
  name?: string;
  phone?: string;
  profile_image_url?: string;
}

interface PeekConversationData {
  id: string;
  contact: Contact;
  messages: WhatsAppMessage[];
}

export function usePeekConversation() {
  const [isLoading, setIsLoading] = useState(false);
  const [conversationData, setConversationData] = useState<PeekConversationData | null>(null);
  const { getHeaders } = useWorkspaceHeaders();

  const loadConversationMessages = async (conversationId: string) => {
    if (!conversationId) return;

    setIsLoading(true);
    try {
      const headers = getHeaders();
      
      // Buscar mensagens da conversa
      const { data, error } = await supabase.functions.invoke(`get-chat-data?conversation_id=${conversationId}`, {
        headers
      });

      if (error) {
        console.error('❌ Erro ao carregar mensagens para peek:', error);
        return;
      }

      if (data?.conversation) {
        setConversationData(data.conversation);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar conversa para peek:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setConversationData(null);
  };

  return {
    conversationData,
    isLoading,
    loadConversationMessages,
    clearConversation
  };
}