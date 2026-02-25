import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversation_id');
    
    // Get user and workspace info from headers
    const systemUserId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('📋 Get chat data request - User:', systemUserId, 'Workspace:', workspaceId, 'Conversation:', conversationId);
    
    if (!systemUserId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User authentication required',
        details: 'x-system-user-id header is missing'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Set user context for RLS policies
    if (systemUserId) {
      const userEmail = req.headers.get('x-system-user-email') || '';
      await supabase.rpc('set_current_user_context', {
        user_id: systemUserId,
        user_email: userEmail
      });
      console.log('🔐 User context set for RLS - User ID:', systemUserId);
    }

    if (conversationId) {
      // Buscar conversa específica com dados do contato
      console.log(`📋 Buscando conversa completa: ${conversationId}`);
      
      let conversationQuery = supabase
        .from('conversations')
        .select(`
          id,
          contact_id,
          contacts (
            id,
            name,
            phone,
            profile_image_url
          )
        `)
        .eq('id', conversationId);
      
      // Apply workspace filtering if provided
      if (workspaceId) {
        conversationQuery = conversationQuery.eq('workspace_id', workspaceId);
      }
      
      const { data: conversation, error: conversationError } = await conversationQuery.single();

      if (conversationError) {
        console.error('Error fetching conversation:', conversationError);
        throw conversationError;
      }

      // Buscar mensagens da conversa
      let messagesQuery = supabase
        .from('messages')
        .select(`
          id,
          content,
          sender_type,
          sender_id,
          message_type,
          file_url,
          file_name,
          mime_type,
          external_id,
          evolution_key_id,
          created_at,
          status,
          metadata
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      // Apply workspace filtering if provided
      if (workspaceId) {
        messagesQuery = messagesQuery.eq('workspace_id', workspaceId);
      }
      
      const { data: messages, error: messagesError } = await messagesQuery;

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      // Montar resposta com conversa completa
      const conversationData = {
        id: conversation.id,
        contact: conversation.contacts,
        messages: messages || []
      };

      return new Response(JSON.stringify({
        success: true,
        conversation: conversationData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Buscar todas as conversas com a última mensagem
      console.log('📞 Buscando todas as conversas');
      
      let conversationsQuery = supabase
        .from('conversations')
        .select(`
          *,
          messages!inner (
            id,
            content,
            message_type,
            sender_type,
            created_at,
            file_url,
            file_name
          )
        `)
        .order('updated_at', { ascending: false });
      
      // Apply workspace filtering if provided
      if (workspaceId) {
        conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      }
      
      const { data: conversations, error: conversationsError } = await conversationsQuery;

      if (conversationsError) throw conversationsError;

      // Processar conversas para incluir apenas a última mensagem
      const processedConversations = (conversations || []).map(conv => {
        // Encontrar a mensagem mais recente
        const lastMessage = conv.messages.reduce((latest: any, current: any) => {
          return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
        });

        return {
          id: conv.id,
          phone_number: conv.phone_number,
          contact_name: conv.contact_name,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message: lastMessage
        };
      });

      return new Response(JSON.stringify({
        success: true,
        conversations: processedConversations
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Erro ao buscar dados:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});