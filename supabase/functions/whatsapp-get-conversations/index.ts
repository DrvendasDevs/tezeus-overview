import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 whatsapp-get-conversations started');
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Get user info from headers
    const systemUserId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    console.log('🔄 Fetching for user:', systemUserId, 'workspace:', workspaceId);
    
    if (!systemUserId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'User authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('system_users')
      .select('id, profile')
      .eq('id', systemUserId)
      .single();

    if (userError || !userProfile) {
      console.error('❌ Error fetching user:', userError);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'User not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`👤 User profile: ${userProfile.profile}`);

    // Build base query
    let conversationsQuery = supabase
      .from('conversations')
      .select(`
        id,
        agente_ativo,
        agent_active_id,
        status,
        unread_count,
        last_activity_at,
        created_at,
        evolution_instance,
        contact_id,
        assigned_user_id,
        assigned_at,
        connection_id,
        workspace_id,
        contacts (
          id,
          name,
          phone,
          email,
          profile_image_url
        )
      `)
      .eq('canal', 'whatsapp');

    // Apply filters based on user role and workspace - REGRAS ESPECÍFICAS
    if (userProfile.profile === 'master') {
      // MentorMaster: vê tudo do workspace selecionado
      if (workspaceId) {
        console.log(`🏢 MentorMaster filtering by workspace: ${workspaceId}`);
        conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      } else {
        console.log('⚠️ MentorMaster sem workspace, acesso limitado');
        // Sem workspace selecionado, não vê nada
        // Return empty result if no workspace provided
        return new Response(
          JSON.stringify({ conversations: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (userProfile.profile === 'admin') {
      // Admin: vê tudo do seu workspace
      if (workspaceId) {
        console.log(`🏢 Admin filtering by workspace: ${workspaceId}`);
        conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      } else {
        console.log('⚠️ Admin sem workspace, buscando workspace do usuário');
        // Buscar workspace do admin
        const { data: userWorkspace } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', systemUserId)
          .single();
        
        if (userWorkspace?.workspace_id) {
          conversationsQuery = conversationsQuery.eq('workspace_id', userWorkspace.workspace_id);
        } else {
          // Se não encontrar workspace, não vê nada
          // Return empty result if no workspace provided
          return new Response(
            JSON.stringify({ conversations: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // User: vê apenas atribuídas a ele OU não atribuídas do workspace
      console.log('👤 User filtering by assignments and workspace');
      
      // Filtro crítico: só conversas atribuídas a ele OU não atribuídas
      conversationsQuery = conversationsQuery.or(
        `assigned_user_id.eq.${systemUserId},assigned_user_id.is.null`
      );
      
      // Sempre filtrar por workspace
      if (workspaceId) {
        conversationsQuery = conversationsQuery.eq('workspace_id', workspaceId);
      } else {
        // Buscar workspace do usuário
        const { data: userWorkspace } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', systemUserId)
          .single();
        
        if (userWorkspace?.workspace_id) {
          conversationsQuery = conversationsQuery.eq('workspace_id', userWorkspace.workspace_id);
        } else {
          // Se não encontrar workspace, não vê nada
          // Return empty result if no workspace provided
          return new Response(
            JSON.stringify({ conversations: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const { data: conversationsData, error: conversationsError } = await conversationsQuery
      .order('last_activity_at', { ascending: false });

    if (conversationsError) {
      console.error('❌ Error fetching conversations:', conversationsError);
      throw conversationsError;
    }

    console.log(`📋 Found ${conversationsData?.length || 0} conversations`);

    // Buscar TODAS as mensagens de uma vez (otimizado) - limitando às últimas 50 por conversa
    let allMessages: any[] = [];
    if (conversationsData && conversationsData.length > 0) {
      const conversationIds = conversationsData.map(conv => conv.id);
      
      console.log(`📨 Fetching messages for ${conversationIds.length} conversations`);
      
      // Buscar todas as mensagens de uma vez - muito mais eficiente que N+1 queries
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(50 * conversationIds.length); // Máximo 50 mensagens por conversa

      if (messagesError) {
        console.error('❌ Error fetching messages:', messagesError);
        allMessages = [];
      } else {
        allMessages = messages || [];
        console.log(`📨 Loaded ${allMessages.length} messages total`);
      }
    }

    // Agrupar mensagens por conversa (otimizado)
    const messagesByConversation = allMessages.reduce((acc, message) => {
      if (!acc[message.conversation_id]) {
        acc[message.conversation_id] = [];
      }
      acc[message.conversation_id].push(message);
      return acc;
    }, {} as Record<string, any[]>);

    // Montar resultado final com mensagens agrupadas
    const conversationsWithMessages = (conversationsData || []).map(conv => {
      const messages = (messagesByConversation[conv.id] || [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-50); // Manter apenas as últimas 50 mensagens ordenadas

      // Normalize joined data (Supabase may return arrays for joins)
      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      
      return {
        id: conv.id,
        contact: contact ? {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          profile_image_url: contact.profile_image_url,
        } : {
          id: conv.contact_id,
          name: 'Unknown Contact',
          phone: null,
          email: null,
          profile_image_url: null,
        },
        agente_ativo: conv.agente_ativo,
        status: conv.status,
        unread_count: conv.unread_count,
        last_activity_at: conv.last_activity_at,
        created_at: conv.created_at,
        evolution_instance: conv.evolution_instance,
        assigned_user_id: conv.assigned_user_id,
        assigned_at: conv.assigned_at,
        connection_id: conv.connection_id,
        workspace_id: conv.workspace_id,
        messages: messages.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender_type: msg.sender_type,
          created_at: msg.created_at,
          read_at: msg.read_at,
          status: msg.status,
          message_type: msg.message_type,
          file_url: msg.file_url,
          file_name: msg.file_name,
          origem_resposta: msg.origem_resposta || 'manual',
        })),
      };
    });

    console.log(`✅ Successfully fetched ${conversationsWithMessages.length} conversations`);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: conversationsWithMessages 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in whatsapp-get-conversations:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});