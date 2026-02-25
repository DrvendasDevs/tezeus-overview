import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function forwardToN8N(
  webhookUrl: string,
  webhookSecret: string | null,
  payload: any,
  requestId: string
) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (webhookSecret) {
      headers['X-Webhook-Secret'] = webhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ [${requestId}] N8N webhook error:`, response.status, text);
      throw new Error(`N8N webhook failed: ${response.status}`);
    }

    console.log(`✅ [${requestId}] N8N webhook sent successfully`);
  } catch (error) {
    console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
  }
}

serve(async (req) => {
  const requestId = `zapi_edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔥 [${requestId}] EDIT Z-API MESSAGE`);
  console.log(`🔥 [${requestId}] Method:`, req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      messageId,
      externalId,
      content,
      conversationId,
      workspaceId,
    } = await req.json();

    console.log("📋 Request params:", {
      messageId,
      externalId,
      content,
      conversationId,
      workspaceId,
    });

    if (!messageId || !externalId || !content || !conversationId || !workspaceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "messageId, externalId, content, conversationId e workspaceId são obrigatórios",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar a mensagem
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (messageError) {
      console.error(`❌ [${requestId}] Error fetching message:`, messageError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar mensagem: ${messageError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!message) {
      console.error(`❌ [${requestId}] Message not found:`, { messageId, workspaceId });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Mensagem não encontrada",
          debug: { messageId, workspaceId }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Message found:`, { 
      messageId: message.id, 
      conversationId: message.conversation_id
    });

    // Buscar a conversa
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, connection_id, workspace_id, contact_id')
      .eq('id', message.conversation_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (conversationError) {
      console.error(`❌ [${requestId}] Error fetching conversation:`, conversationError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar conversa: ${conversationError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!conversation) {
      console.error(`❌ [${requestId}] Conversation not found:`, { 
        conversationId: message.conversation_id 
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Conversa não encontrada",
          debug: { conversationId: message.conversation_id }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Conversation found:`, { 
      conversationId: conversation.id,
      connectionId: conversation.connection_id
    });

    // Buscar a conexão (incluindo metadata para instance_id e instance_token)
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, instance_name, provider_id, metadata')
      .eq('id', conversation.connection_id)
      .maybeSingle();

    if (connectionError) {
      console.error(`❌ [${requestId}] Error fetching connection:`, connectionError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar conexão: ${connectionError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connection) {
      console.error(`❌ [${requestId}] Connection not found:`, { 
        connectionId: conversation.connection_id 
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Conexão não encontrada",
          debug: { connectionId: conversation.connection_id }
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair instance_id e instance_token do metadata
    const instanceId = connection.metadata?.instanceId || 
                       connection.metadata?.instance_id ||
                       connection.instance_name; // Fallback para instance_name
    
    const instanceToken = connection.metadata?.token || 
                         connection.metadata?.instanceToken || 
                         connection.metadata?.instance_token ||
                         null;

    console.log(`✅ [${requestId}] Connection found:`, { 
      connectionId: connection.id,
      instanceName: connection.instance_name,
      providerId: connection.provider_id,
      instanceId: instanceId,
      hasInstanceToken: !!instanceToken
    });

    // Buscar o provider
    const { data: provider, error: providerError } = await supabase
      .from('whatsapp_providers')
      .select('id, provider, zapi_url, zapi_client_token, n8n_webhook_url')
      .eq('id', connection.provider_id)
      .maybeSingle();

    if (providerError) {
      console.error(`❌ [${requestId}] Error fetching provider:`, providerError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao buscar provider: ${providerError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!provider || provider.provider !== 'zapi') {
      console.error(`❌ [${requestId}] Provider invalid:`, { 
        providerId: connection.provider_id,
        provider: provider?.provider 
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Provider não é Z-API",
          debug: { provider: provider?.provider }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Provider found:`, { 
      providerId: provider.id,
      provider: provider.provider
    });

    // Atualizar mensagem no banco de dados
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        content: content,
      })
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      console.error(`❌ [${requestId}] Error updating message:`, updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: updateError.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [${requestId}] Message updated:`, updatedMessage.id);

    // Buscar dados do contato
    let contactData = null;
    if (conversation.contact_id) {
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone')
        .eq('id', conversation.contact_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      contactData = data;
    }

    // Buscar webhook_secret se necessário
    let webhookSecret = null;
    if (provider.n8n_webhook_url) {
      const { data: webhookSettings } = await supabase
        .from('workspace_webhook_settings')
        .select('webhook_secret')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      
      webhookSecret = webhookSettings?.webhook_secret || null;
    }

    // Disparar webhook para N8N
    if (provider.n8n_webhook_url) {
      console.log(`🎯 [${requestId}] Forwarding edited message to N8N`);
      
      const n8nPayload = {
        event_type: 'MESSAGE_EDITED',
        provider: 'zapi',
        instance_name: connection.instance_name,
        instance_id: instanceId, // ✅ ID da instância Z-API
        instance_token: instanceToken, // ✅ Token da instância Z-API
        workspace_id: workspaceId,
        connection_id: connection.id,
        processed_locally: true,
        processed_data: {
          contact: contactData ? {
            id: contactData.id,
            name: contactData.name,
            phone: contactData.phone
          } : null,
          conversation: {
            id: conversationId
          },
          message: {
            id: updatedMessage.id,
            messageId: externalId, // ✅ messageId original do z-api (gerado pelo z-api)
            external_id: externalId, // ✅ ID do z-api incluído no payload
            content: content,
            old_content: message.content,
            message_type: updatedMessage.message_type,
            sender_type: updatedMessage.sender_type,
            sender_id: updatedMessage.sender_id,
            status: updatedMessage.status,
            timestamp: updatedMessage.created_at,
            edited_at: new Date().toISOString()
          }
        }
      };

      await forwardToN8N(
        provider.n8n_webhook_url,
        webhookSecret,
        n8nPayload,
        requestId
      );
    } else {
      console.log(`⚠️ [${requestId}] No N8N webhook configured, edited message not forwarded`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: updatedMessage.id,
        externalId: externalId,
        updatedMessage: updatedMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error editing Z-API message:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

