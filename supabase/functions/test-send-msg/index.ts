import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

function generateRequestId(): string {
  return `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();
  console.log(`🚀 [${requestId}] SEND MESSAGE FUNCTION - ROTA EXCLUSIVA VIA N8N`);
  console.log(`📋 [${requestId}] Mensagens serão enviadas APENAS via N8N (Evolution será chamado pelo N8N)`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Wrong method: ${req.method}`);
    return new Response(JSON.stringify({
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    console.log(`📨 [${requestId}] Received body:`, JSON.stringify(body, null, 2));
    
    const { conversation_id, content, message_type = 'text', sender_id, sender_type, file_url, file_name, mime_type, clientMessageId, reply_to_message_id, quoted_message } = body;

    // Para mensagens de mídia, ignorar placeholders como [IMAGE], [VIDEO], etc
    const isMediaMessage = message_type && message_type !== 'text';
    const isPlaceholder = content && /^\[.*\]$/.test(content); // Detecta [IMAGE], [VIDEO], [DOCUMENT]
    const effectiveContent = (isMediaMessage && isPlaceholder) ? '' : (content || '');

    // Validação de file_url para mensagens de mídia
    if (isMediaMessage && !file_url) {
      console.log(`❌ [${requestId}] Media message missing file_url`);
      return new Response(JSON.stringify({
        error: 'file_url is required for media messages'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!conversation_id || (!effectiveContent && !isMediaMessage)) {
      console.log(`❌ [${requestId}] Missing required fields - conversation_id: ${!!conversation_id}, content: ${!!content}, message_type: ${message_type}`);
      return new Response(JSON.stringify({
        error: isMediaMessage 
          ? 'Missing required field: conversation_id' 
          : 'Missing required fields: conversation_id, content'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      console.log(`❌ [${requestId}] Missing env vars`);
      return new Response(JSON.stringify({
        error: 'Missing environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    console.log(`✅ [${requestId}] Supabase client created`);

    // Fetch conversation details with connection info
    console.log(`🔍 [${requestId}] Fetching conversation: ${conversation_id}`);
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('workspace_id, connection_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.log(`❌ [${requestId}] Conversation error:`, convError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: convError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If conversation doesn't have connection_id, try to find default connection for workspace
    let actualConnectionId = conversation.connection_id;
    if (!actualConnectionId) {
      console.log(`⚠️ [${requestId}] Conversation has no connection_id, finding default for workspace`);
      const { data: defaultConnection } = await supabase
        .from('connections')
        .select('id')
        .eq('workspace_id', conversation.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .single();
      
      if (defaultConnection) {
        actualConnectionId = defaultConnection.id;
        console.log(`✅ [${requestId}] Using default connection: ${actualConnectionId}`);
        
        // Update the conversation to include the connection_id
        await supabase
          .from('conversations')
          .update({ connection_id: actualConnectionId })
          .eq('id', conversation_id);
          
        console.log(`✅ [${requestId}] Updated conversation with connection_id`);
      }
    }

    console.log(`✅ [${requestId}] Conversation found:`, conversation);

    // Fetch contact details
    console.log(`🔍 [${requestId}] Fetching contact: ${conversation.contact_id}`);
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('phone')
      .eq('id', conversation.contact_id)
      .single();

    if (contactError || !contact) {
      console.log(`❌ [${requestId}] Contact error:`, contactError);
      return new Response(JSON.stringify({
        error: 'Contact not found',
        details: contactError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Contact found: ${contact.phone}`);

    // Fetch connection details to get instance_name
    let instance_name = null;
    
    if (actualConnectionId) {
      console.log(`🔍 [${requestId}] Fetching connection: ${actualConnectionId}`);
      const { data: connection, error: connectionError } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', actualConnectionId)
        .single();

      if (connectionError || !connection) {
        console.log(`❌ [${requestId}] Connection error:`, connectionError);
        return new Response(JSON.stringify({
          error: 'Connection not found',
          details: connectionError?.message
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      instance_name = connection.instance_name;
      console.log(`✅ [${requestId}] Connection found: ${instance_name}`);
    } else {
      console.log(`⚠️ [${requestId}] No connection available for this conversation`);
    }

    // Get N8N webhook URL from workspace configuration
    // Try workspace_webhook_settings first (new table)
    console.log(`🔍 [${requestId}] Looking for webhook URL in workspace_webhook_settings`);
    
    const { data: webhookSettings, error: settingsError } = await supabase
      .from('workspace_webhook_settings')
      .select('webhook_url')
      .eq('workspace_id', conversation.workspace_id)
      .maybeSingle();

    let n8nWebhookUrl = null;

    if (!settingsError && webhookSettings?.webhook_url) {
      n8nWebhookUrl = webhookSettings.webhook_url;
      console.log(`✅ [${requestId}] Found webhook in settings table: ${n8nWebhookUrl.substring(0, 50)}...`);
    } else {
      // Fallback to workspace_webhook_secrets (old table)
      console.log(`🔄 [${requestId}] Webhook not found in settings, trying secrets table (fallback)`);
      
      const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${conversation.workspace_id}`;
      
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')
        .select('webhook_url')
        .eq('workspace_id', conversation.workspace_id)
        .eq('secret_name', workspaceWebhookSecretName)
        .maybeSingle();

      if (!webhookError && webhookData?.webhook_url) {
        n8nWebhookUrl = webhookData.webhook_url;
        console.log(`✅ [${requestId}] Found webhook in secrets table (fallback): ${n8nWebhookUrl.substring(0, 50)}...`);
      }
    }

    if (!n8nWebhookUrl) {
      console.error(`❌ [${requestId}] N8N webhook not configured for workspace ${conversation.workspace_id} in either table`);
      return new Response(JSON.stringify({
        error: 'N8N webhook not configured for this workspace'
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar credenciais da Evolution API do _master_config (URL + API Key Global)
    console.log(`🔍 [${requestId}] Fetching Evolution credentials from _master_config`);
    const { data: masterConfig, error: configError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', conversation.workspace_id)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (configError || !masterConfig) {
      console.error(`❌ [${requestId}] Master config not found:`, configError);
      return new Response(JSON.stringify({
        error: 'Evolution API not configured for this workspace',
        details: configError?.message
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const evolutionUrl = masterConfig.evolution_url;
    const evolutionApiKey = masterConfig.token;
    console.log(`✅ [${requestId}] Evolution config found: ${evolutionUrl}`);


    // ✅ ETAPA 2: VERIFICAR DUPLICAÇÃO POR clientMessageId
    if (clientMessageId) {
      console.log(`🔍 [${requestId}] ETAPA 2 - Verificando duplicação:`, {
        request_id: requestId,
        session_id: conversation.workspace_id,
        chat_id: conversation_id,
        client_message_id: clientMessageId,
        source: 'frontend',
        attempt: 1
      });
      
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('external_id', clientMessageId)
        .maybeSingle();
      
      if (existing) {
        console.log(`✅ [${requestId}] ETAPA 2 - Duplicação detectada (DEDUPLICADO):`, {
          request_id: requestId,
          client_message_id: clientMessageId,
          existing_message_id: existing.id,
          action: 'skipped_insertion'
        });
        
        return new Response(JSON.stringify({
          success: true,
          message_id: existing.id,
          status: 'duplicate',
          message: 'Message already sent (deduplicated by clientMessageId)'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`✅ [${requestId}] ETAPA 2 - Nenhuma duplicação encontrada, prosseguindo`);
    }
    
    // Generate external_id for tracking (usar clientMessageId se fornecido)
    const external_id = clientMessageId || crypto.randomUUID();
    
    // CRÍTICO: Salvar a mensagem ANTES de chamar Evolution para evitar race condition
    console.log(`💾 [${requestId}] Saving message to database BEFORE calling Evolution`);
    
    let savedMessageId: string | null = null;

    try {
      // ✅ CORREÇÃO: Gerar UUID válido para o campo id, manter external_id para tracking
      const message_id = crypto.randomUUID();
      
      const messageData = {
        id: message_id,
        conversation_id: conversation_id,
        workspace_id: conversation.workspace_id,
        content: effectiveContent || '',
        message_type: message_type,
        sender_type: sender_type || 'agent',
        sender_id: sender_id,
        file_url: file_url || null,
        file_name: file_name || null,
        mime_type: mime_type || null,
        reply_to_message_id: reply_to_message_id || null,
        quoted_message: quoted_message || null,
        status: 'sending',
        origem_resposta: 'manual',
        external_id: external_id, // ✅ Salvar clientMessageId como external_id
        metadata: {
          source: 'test-send-msg-pre-save',
          request_id: requestId,
          step: 'before_evolution',
          client_message_id: clientMessageId
        }
      };

      console.log(`📋 [${requestId}] ETAPA 2 - PRÉ-SALVAMENTO:`, {
        request_id: requestId,
        session_id: conversation.workspace_id,
        chat_id: conversation_id,
        message_id: external_id,
        client_message_id: clientMessageId,
        source: 'frontend',
        attempt: 1
      });

      const { data: savedMessage, error: saveError } = await supabase
        .from('messages')
        .insert(messageData)
        .select('id')
        .single();

      if (saveError) {
        console.error(`❌ [${requestId}] Failed to save message before N8N:`, saveError);
        return new Response(JSON.stringify({
          error: 'Failed to save message',
          details: saveError instanceof Error ? saveError.message : String(saveError)
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ [${requestId}] ETAPA 2 - PÓS-SALVAMENTO:`, {
        request_id: requestId,
        database_id: savedMessage.id,
        external_id: external_id,
        client_message_id: clientMessageId
      });
      
      // ✅ Armazenar o ID real para retornar depois
      savedMessageId = savedMessage.id;
    } catch (preSaveError) {
      console.error(`❌ [${requestId}] Pre-save error:`, preSaveError);
      return new Response(JSON.stringify({
        error: 'Failed to save message before N8N',
        details: preSaveError instanceof Error ? preSaveError.message : String(preSaveError)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ============================================================
    // ENVIAR MENSAGEM VIA WHATSAPP PROVIDER ADAPTER
    // ============================================================
    console.log(`📤 [${requestId}] Enviando mensagem via WhatsApp Provider Adapter`);
    console.log(`📋 [${requestId}] Provedor será selecionado automaticamente (Evolution/Z-API)`);

    // Chamar message-sender que usa N8N webhook (com fallback para envio direto)
    try {
      if (!savedMessageId) {
        console.error(`❌ [${requestId}] savedMessageId ausente antes de chamar message-sender`);
        return new Response(JSON.stringify({
          error: 'Failed to save message',
          details: 'savedMessageId is null'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: sendResult, error: sendError } = await supabase.functions.invoke('message-sender', {
        body: {
          messageId: savedMessageId,
          phoneNumber: contact.phone,
          content: effectiveContent,
          messageType: message_type,
          fileUrl: file_url,
          fileName: file_name,
          evolutionInstance: instance_name,
          workspaceId: conversation.workspace_id,
          external_id: external_id,
          conversationId: conversation_id,
          reply_to_message_id: reply_to_message_id,
          quoted_message: quoted_message
        }
      });

      if (sendError) {
        console.error(`❌ [${requestId}] WhatsApp provider error:`, sendError);
        
        // Atualizar mensagem como failed
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: {
              client_msg_id: clientMessageId,
              request_id: requestId,
              error: sendError instanceof Error ? sendError.message : String(sendError),
              step: 'whatsapp_provider_failed'
            }
          })
          .eq('external_id', external_id);

        return new Response(JSON.stringify({
          error: 'Failed to send message via WhatsApp provider',
          details: sendError instanceof Error ? sendError.message : String(sendError)
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!sendResult?.success) {
        console.error(`❌ [${requestId}] WhatsApp provider returned error:`, sendResult);
        
        // Atualizar mensagem como failed
        await supabase
          .from('messages')
          .update({ 
            status: 'failed',
            metadata: {
              client_msg_id: clientMessageId,
              request_id: requestId,
              error: sendResult?.error || 'Unknown error',
              failover_from: sendResult?.failoverFrom,
              step: 'whatsapp_provider_error'
            }
          })
          .eq('external_id', external_id);

        return new Response(JSON.stringify({
          error: sendResult?.error || 'Failed to send message',
          details: sendResult?.details
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ [${requestId}] Message sent successfully`);
      console.log(`📋 [${requestId}] Provider message ID: ${sendResult.providerMsgId}`);
      
      // ✅ ATUALIZAR STATUS DA MENSAGEM PARA 'sent' APÓS ENVIO BEM-SUCEDIDO
      console.log(`📝 [${requestId}] Atualizando status da mensagem para 'sent'`);
      const updateData: any = {
        status: 'sent',
        metadata: {
          client_msg_id: clientMessageId,
          request_id: requestId,
          provider_msg_id: sendResult.providerMsgId,
          step: 'sent_successfully'
        }
      };
      
      // Se o provider retornou um ID externo, atualizar também
      if (sendResult.providerMsgId && sendResult.providerMsgId !== external_id) {
        updateData.evolution_key_id = sendResult.providerMsgId;
      }
      
      const { error: updateError } = await supabase
        .from('messages')
        .update(updateData)
        .eq('external_id', external_id);
      
      if (updateError) {
        console.error(`❌ [${requestId}] Erro ao atualizar status para 'sent':`, updateError);
      } else {
        console.log(`✅ [${requestId}] Status atualizado para 'sent' com sucesso`);
      }

      // A mensagem já foi atualizada pela função send-whatsapp-message com evolution_key_id
      return new Response(JSON.stringify({
        success: true,
        message: {
          id: external_id,
          external_id: external_id,
          evolution_key_id: sendResult.providerMsgId,
          created_at: new Date().toISOString(),
          status: 'sent',
          failover_from: sendResult.failoverFrom
        },
        conversation_id: conversation_id,
        phone_number: contact.phone
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (providerError) {
      console.error(`❌ [${requestId}] WhatsApp provider exception:`, providerError);
      
      // Atualizar mensagem como failed
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          metadata: {
            client_msg_id: clientMessageId,
            request_id: requestId,
            error: providerError instanceof Error ? providerError.message : String(providerError),
            step: 'whatsapp_provider_exception'
          }
        })
        .eq('external_id', external_id);

      return new Response(JSON.stringify({
        error: 'Failed to send message',
        details: providerError instanceof Error ? providerError.message : String(providerError)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Version 2.0.1 - Fixed N8N empty response handling