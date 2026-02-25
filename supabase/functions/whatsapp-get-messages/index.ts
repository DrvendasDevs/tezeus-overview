import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Cache-Control': 'private, max-age=5', // 5 seconds cache
};

// Campos necessários para exibição de mensagens (evita select *)
const MESSAGE_SELECT_FIELDS = `
  id,
  conversation_id,
  content,
  message_type,
  sender_type,
  sender_id,
  file_url,
  file_name,
  mime_type,
  created_at,
  status,
  delivered_at,
  read_at,
  external_id,
  metadata,
  workspace_id,
  origem_resposta,
  reply_to_message_id,
  evolution_key_id,
  provider_moment
`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get workspace from headers
    const workspaceId = req.headers.get('x-workspace-id');
    
    // Get request body
    const body = await req.json();
    const conversationId = body.conversation_id;
    const limit = parseInt(body.limit || '5');
    const before = body.before; // Format: "created_at|id"

    if (!workspaceId || !conversationId) {
      return new Response(
        JSON.stringify({ error: 'workspace_id e conversation_id são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📨 WhatsApp Get Messages Request:', {
      workspaceId,
      conversationId,
      limit,
      before
    });

    // Usar campos específicos para otimizar transferência de dados
    // 🕐 Ordenação por provider_moment (timestamp real do WhatsApp) em vez de created_at
    let query = supabase
      .from('messages')
      .select(MESSAGE_SELECT_FIELDS)
      .eq('workspace_id', workspaceId)
      .eq('conversation_id', conversationId)
      .order('provider_moment', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(limit);

    // Apply cursor pagination if provided (usando provider_moment)
    if (before) {
      const [beforeProviderMoment, beforeId] = before.split('|');
      // Fallback para created_at se provider_moment não existir
      query = query.or(`provider_moment.lt.${beforeProviderMoment},and(provider_moment.eq.${beforeProviderMoment},id.lt.${beforeId})`);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ DEDUPLICAR mensagens por ID (caso haja duplicatas no banco)
    const uniqueMessages = messages ? Array.from(
      new Map(messages.map(msg => [msg.id, msg])).values()
    ) : [];

    // Generate next cursor if we have results (usando provider_moment)
    let nextBefore = null;
    if (uniqueMessages && uniqueMessages.length === limit) {
      const lastMessage = uniqueMessages[uniqueMessages.length - 1];
      // Usar provider_moment para paginação (com fallback para created_at convertido)
      const providerMoment = lastMessage.provider_moment || 
        new Date(lastMessage.created_at).getTime();
      nextBefore = `${providerMoment}|${lastMessage.id}`;
    }

    // Reverse messages to display in chronological order (oldest first)
    const reversedMessages = uniqueMessages ? [...uniqueMessages].reverse() : [];

    return new Response(
      JSON.stringify({
        items: reversedMessages,
        nextBefore
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});