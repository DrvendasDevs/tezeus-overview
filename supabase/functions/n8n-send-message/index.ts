import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBodyCache: any = null;
  let receivedMessageId: string | undefined;

  try {
    try {
      requestBodyCache = await req.json();
    } catch (_) {
      requestBodyCache = {};
    }

    const { 
      messageId, 
      phoneNumber, 
      content, 
      messageType = 'text', 
      fileUrl, 
      fileName, 
      mimeType: mimeTypeFromBody, 
      evolutionInstance: evolutionInstanceFromBody,
      conversationId,
      workspaceId,
      external_id,
      reply_to_message_id,
      quoted_message
    } = requestBodyCache;
    
    receivedMessageId = messageId;
    console.log(`📨 [${messageId}] N8N Send Message - Dados recebidos:`, { 
      messageId, 
      phoneNumber: phoneNumber?.substring(0, 8) + '***', 
      content: content?.substring(0, 50), 
      messageType, 
      hasFile: !!fileUrl,
      hasQuoted: !!quoted_message,
      reply_to: reply_to_message_id
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolver workspace se não fornecido
    let finalWorkspaceId = workspaceId;
    if (!finalWorkspaceId && conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('workspace_id')
        .eq('id', conversationId)
        .single();
      
      finalWorkspaceId = conversation?.workspace_id;
    }

    // Buscar dados da mensagem para ter contexto completo (incluindo sender_id)
    let conversationIdResolved: string | null = conversationId || null;
    let contactName: string | null = null;
    let contactEmail: string | null = null;
    let contactPhone: string | null = phoneNumber || null;
    let evolutionInstance: string | null = evolutionInstanceFromBody || null;
    let senderId: string | null = null;

    if (messageId) {
      const { data: msgRow, error: msgErr } = await supabase
        .from('messages')
        .select('conversation_id, sender_id')
        .eq('id', messageId)
        .maybeSingle();

      if (msgRow) {
        senderId = msgRow.sender_id;
        conversationIdResolved = msgRow.conversation_id;
      }
    }

    // Buscar informações do contato e conversação se necessário
    let connectionData: any = null;
    if (conversationIdResolved && !contactPhone) {
      console.log(`🔍 [${messageId}] Buscando informações de conversa: ${conversationIdResolved}`);
      
      const { data: convData, error: convErr } = await supabase
        .from('conversations')
        .select(`
          id,
          workspace_id,
          contact:contacts(phone, name, email),
          connection:connections(
            id,
            instance_name,
            provider_id,
            metadata,
            provider:whatsapp_providers!connections_provider_id_fkey(
              provider,
              evolution_url,
              evolution_token,
              zapi_url,
              zapi_token,
              zapi_client_token,
              n8n_webhook_url
            )
          )
        `)
        .eq('id', conversationIdResolved)
        .single();

      console.log(`🔍 [${messageId}] Query error:`, convErr);
      console.log(`🔍 [${messageId}] Raw convData:`, JSON.stringify(convData, null, 2));

      if (convData) {
        const contact = Array.isArray(convData.contact) ? convData.contact[0] : convData.contact;
        const connection = Array.isArray(convData.connection) ? convData.connection[0] : convData.connection;
        
        console.log(`🔍 [${messageId}] Connection raw:`, JSON.stringify(connection, null, 2));
        
        contactPhone = contact?.phone;
        contactName = contact?.name;
        contactEmail = contact?.email;
        evolutionInstance = connection?.instance_name;
        finalWorkspaceId = convData.workspace_id;
        connectionData = connection;
        
        // O provider pode vir como array também
        const provider = Array.isArray(connection?.provider) ? connection.provider[0] : connection?.provider;
        console.log(`📡 [${messageId}] Connection provider detected:`, provider?.provider || 'none');
        console.log(`📡 [${messageId}] ConnectionData stored:`, !!connectionData, 'provider_id:', connectionData?.provider_id);
      }
    }

    if (!contactPhone) {
      if (!phoneNumber) {
        console.error(`❌ [${messageId}] senderId is empty, message might fail instance resolution`);
      }
      contactPhone = phoneNumber;
    }

    if (!evolutionInstance) {
      console.error(`❌ [${messageId}] evolutionInstance is empty, message might fail`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve evolutionInstance',
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const finalEvolutionInstance = evolutionInstance;
    
    // Se não conseguimos connectionData via conversação, buscar direto pela instância
    if (!connectionData && finalEvolutionInstance && finalWorkspaceId) {
      console.log(`🔍 [${messageId}] Buscando connection direto por instance_name: ${finalEvolutionInstance}`);
      
      const { data: directConnection, error: directErr } = await supabase
        .from('connections')
        .select(`
          id,
          instance_name,
          provider_id,
          metadata,
          provider:whatsapp_providers!connections_provider_id_fkey(
            provider,
            evolution_url,
            evolution_token,
            zapi_url,
            zapi_token,
            zapi_client_token
          )
        `)
        .eq('instance_name', finalEvolutionInstance)
        .eq('workspace_id', finalWorkspaceId)
        .maybeSingle();
      
      if (directConnection) {
        console.log(`✅ [${messageId}] Connection encontrada direto:`, JSON.stringify(directConnection, null, 2));
        connectionData = directConnection;
      } else {
        console.log(`❌ [${messageId}] Nenhuma connection encontrada. Error:`, directErr);
      }
    }

    console.log(`🔍 [${messageId}] Buscando configuração do provider para instância: ${finalEvolutionInstance}`);

    // Detectar qual provider usar baseado na conexão
    let providerType: 'evolution' | 'zapi' = 'evolution';
    let providerUrl: string | null = null;
    let providerToken: string | null = null;
    let zapiInstanceId: string | null = null;
    let zapiClientToken: string | null = null;

    // Primeiro: verificar se temos dados do provider via connectionData
    if (connectionData?.provider) {
      const provider = Array.isArray(connectionData.provider) ? connectionData.provider[0] : connectionData.provider;
      
      if (provider) {
        providerType = provider.provider;
        
        if (providerType === 'zapi') {
          providerUrl = provider.zapi_url;
          providerToken = provider.zapi_token;
          zapiClientToken = provider.zapi_client_token;
          zapiInstanceId = connectionData.metadata?.instanceId;
          console.log(`✅ [${messageId}] Usando Z-API provider da conexão`);
        } else {
          providerUrl = provider.evolution_url;
          providerToken = provider.evolution_token;
          console.log(`✅ [${messageId}] Usando Evolution provider da conexão`);
        }
      }
    }

    // Fallback: buscar Evolution API priorizando evolution_instance_tokens
    if (!providerUrl && !providerToken) {
      const { data: masterConfig, error: masterConfigError } = await supabase
        .from('evolution_instance_tokens')
        .select('evolution_url, token')
        .eq('workspace_id', finalWorkspaceId)
        .eq('instance_name', '_master_config')
        .maybeSingle();

      if (!masterConfigError && masterConfig) {
        providerType = 'evolution';
        providerUrl = masterConfig.evolution_url;
        providerToken = masterConfig.token;
        console.log(`✅ [${messageId}] Evolution config encontrada em evolution_instance_tokens`);
      } else {
        console.warn(`⚠️ [${messageId}] evolution_instance_tokens não retornou config. Tentando fallback`, {
          error: masterConfigError?.message
        });

        const { data: evolutionConfig, error: fallbackError } = await supabase
          .from('_master_config')
          .select('evolution_api_url, evolution_api_key')
          .maybeSingle();

        if (!fallbackError && evolutionConfig) {
          providerType = 'evolution';
          providerUrl = evolutionConfig.evolution_api_url;
          providerToken = evolutionConfig.evolution_api_key;
          console.log(`✅ [${messageId}] Evolution config encontrada no fallback _master_config`);
        }
      }
    }

    // Fallback: buscar em whatsapp_providers se ainda não tiver
    if ((!providerUrl || !providerToken) && finalWorkspaceId) {
      const { data: providers, error: providerError } = await supabase
        .from('whatsapp_providers')
        .select('provider, evolution_url, evolution_token, zapi_url, zapi_token, zapi_client_token, is_active')
        .eq('workspace_id', finalWorkspaceId)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!providerError && providers) {
        providerType = providers.provider;
        
        if (providerType === 'zapi' && providers.zapi_url && providers.zapi_token) {
          providerUrl = providers.zapi_url;
          providerToken = providers.zapi_token;
          zapiClientToken = providers.zapi_client_token;
          console.log(`✅ [${messageId}] Z-API config encontrada via whatsapp_providers (is_active=${providers.is_active})`);
        } else if (providerType === 'evolution' && providers.evolution_url && providers.evolution_token) {
          providerUrl = providers.evolution_url;
          providerToken = providers.evolution_token;
          console.log(`✅ [${messageId}] Evolution config encontrada via whatsapp_providers (is_active=${providers.is_active})`);
        }
      } else if (providerError) {
        console.warn(`⚠️ [${messageId}] Falha ao buscar config em whatsapp_providers`, providerError);
      }
    }

    if (!providerUrl || !providerToken) {
      console.error(`❌ [${messageId}] Provider API não configurada após tentativas`);
      return new Response(JSON.stringify({
        success: false,
        error: 'WhatsApp Provider não configurado',
        message: messageId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ [${messageId}] Provider configurado: ${providerType} - ${providerUrl}`);
    console.log(`🔍 [${messageId}] Provider details:`, {
      providerType,
      providerUrl: providerUrl?.substring(0, 30) + '...',
      hasZapiToken: !!zapiClientToken,
      hasZapiInstanceId: !!zapiInstanceId,
      isZapi: providerType === 'zapi',
      isEvolution: providerType === 'evolution'
    });

    // Buscar dados da instância no banco (connections)
    const { data: instanceData, error: instanceErr } = await supabase
      .from('connections')
      .select('*')
      .eq('instance_name', finalEvolutionInstance)
      .eq('workspace_id', finalWorkspaceId)
      .maybeSingle();

    if (instanceErr || !instanceData) {
      console.error(`❌ [${messageId}] Instância não encontrada: ${finalEvolutionInstance}`, {
        error: instanceErr,
        workspaceId: finalWorkspaceId,
        instanceName: finalEvolutionInstance
      });
      return new Response(JSON.stringify({
        success: false,
        error: `Instância não encontrada: ${finalEvolutionInstance} no workspace ${finalWorkspaceId}`,
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ [${messageId}] Instância encontrada:`, {
      id: instanceData.id,
      name: instanceData.instance_name,
      status: instanceData.status
    });

    // MELHORADO: Verificar se workspace tem webhook N8N configurado antes de tentar
    if (!finalWorkspaceId) {
      console.error(`❌ [${messageId}] Could not resolve workspace_id`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve workspace_id',
        message: messageId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceWebhookSecretName = `N8N_WEBHOOK_URL_${finalWorkspaceId}`;
    let workspaceWebhookUrl: string | null = null;

    const { data: webhookSettings, error: settingsError } = await supabase
      .from('workspace_webhook_settings')
      .select('webhook_url')
      .eq('workspace_id', finalWorkspaceId)
      .maybeSingle();

    if (!settingsError && webhookSettings?.webhook_url) {
      workspaceWebhookUrl = webhookSettings.webhook_url;
      console.log(`📤 [${messageId}] Found workspace webhook in workspace_webhook_settings`);
    } else {
      const { data: webhookData, error: webhookError } = await supabase
        .from('workspace_webhook_secrets')
        .select('webhook_url')
        .eq('workspace_id', finalWorkspaceId)
        .eq('secret_name', workspaceWebhookSecretName)
        .maybeSingle();

      if (!webhookError && webhookData?.webhook_url) {
        workspaceWebhookUrl = webhookData.webhook_url;
        console.log(`📤 [${messageId}] Found workspace webhook in workspace_webhook_secrets (fallback)`);
      }
    }

    if (!workspaceWebhookUrl) {
      console.log(`⚠️ [${messageId}] No workspace webhook configured - N8N unavailable`);
      return new Response(JSON.stringify({
        success: false,
        error: 'N8N webhook not configured for workspace',
        message: messageId
      }), {
        status: 424,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Preparar estrutura de quotação (reply) se fornecida
    let quotedStructure = null;
    if (reply_to_message_id && quoted_message) {
      console.log(`💬 [${messageId}] Preparando reply para mensagem: ${quoted_message.external_id}`);
      quotedStructure = {
        key: {
          remoteJid: `${contactPhone}@s.whatsapp.net`,
          fromMe: quoted_message.sender_type === 'agent',
          id: quoted_message.external_id || reply_to_message_id
        },
        message: {
          conversation: quoted_message.content
        }
      };
    }

    // Preparar payload para N8N baseado no tipo de mensagem
    let evolutionMessage: any = {};
    let evolutionMessageType = 'conversation';

    if (messageType === 'text' || !fileUrl) {
      evolutionMessage = {
        conversation: content ?? '',
        ...(quotedStructure && { quoted: quotedStructure })
      };
      evolutionMessageType = 'conversation';
    } else if (messageType === 'image') {
      evolutionMessageType = 'imageMessage';
      evolutionMessage = {
        imageMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'image.jpg'
        },
        ...(quotedStructure && { quoted: quotedStructure })
      };
    } else if (messageType === 'video') {
      evolutionMessageType = 'videoMessage';
      evolutionMessage = {
        videoMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'video.mp4'
        },
        ...(quotedStructure && { quoted: quotedStructure })
      };
    } else if (messageType === 'audio') {
      evolutionMessageType = 'audioMessage';
      evolutionMessage = {
        audioMessage: {
          url: fileUrl,
          fileName: fileName || 'audio.ogg'
        },
        ...(quotedStructure && { quoted: quotedStructure })
      };
    } else if (messageType === 'document' || messageType === 'file') {
      evolutionMessageType = 'documentMessage';
      evolutionMessage = {
        documentMessage: {
          url: fileUrl,
          caption: content || '',
          fileName: fileName || 'document'
        },
        ...(quotedStructure && { quoted: quotedStructure })
      };
    } else {
      evolutionMessage = { 
        conversation: content ?? '',
        ...(quotedStructure && { quoted: quotedStructure })
      };
      evolutionMessageType = 'conversation';
    }

    // Montar payload base
    const n8nPayloadBase: any = {
      event: 'send.message',
      instance: finalEvolutionInstance,
      workspace_id: finalWorkspaceId,
      connection_id: instanceData.id,
      conversation_id: conversationIdResolved,
      phone_number: contactPhone,
      external_id: external_id || messageId,
      provider: providerType, // CAMPO IDENTIFICADOR DO PROVIDER
      data: {
        key: {
          remoteJid: `${contactPhone}@s.whatsapp.net`,
          fromMe: true,
          id: external_id || messageId
        },
        message: evolutionMessage,
        messageType: evolutionMessageType,
        messageTimestamp: Date.now()
      },
      destination: workspaceWebhookUrl,
      date_time: new Date().toISOString(),
      sender: contactPhone
    };

    // Adicionar dados específicos do provider (NUNCA MISTURAR!)
    if (providerType === 'evolution') {
      n8nPayloadBase.server_url = providerUrl;
      n8nPayloadBase.apikey = providerToken;
      console.log(`🔵 [${messageId}] Payload configurado para EVOLUTION API`);
    } else if (providerType === 'zapi') {
      // ✅ Buscar instance_token correto do metadata (campo 'token' da Z-API)
      const zapiInstanceToken = instanceData.metadata?.token || 
                                 instanceData.metadata?.instanceToken || 
                                 instanceData.metadata?.instance_token;
      
      n8nPayloadBase.zapi_url = providerUrl;
      n8nPayloadBase.zapi_token = providerToken;
      n8nPayloadBase.zapi_client_token = zapiClientToken;
      n8nPayloadBase.zapi_instance_id = zapiInstanceId;
      n8nPayloadBase.instance_id = zapiInstanceId; // ID da instância
      n8nPayloadBase.instance_token = zapiInstanceToken; // ✅ Token real da instância (diferente do client_token)
      
      console.log(`🟢 [${messageId}] Payload Z-API configurado:`, {
        instance_id: zapiInstanceId,
        instance_token: zapiInstanceToken ? zapiInstanceToken.substring(0, 10) + '...' : 'MISSING',
        client_token: zapiClientToken ? zapiClientToken.substring(0, 10) + '...' : 'MISSING'
      });
    }

    const n8nPayload = n8nPayloadBase;

    console.log(`📡 [${messageId}] Enviando para N8N:`, {
      provider: providerType,
      workspace_id: finalWorkspaceId,
      connection_id: instanceData.id,
      conversation_id: conversationIdResolved,
      phone_number: contactPhone,
      instance: finalEvolutionInstance,
      messageType: evolutionMessageType,
      hasEvolutionFields: !!(n8nPayload.server_url && n8nPayload.apikey),
      hasZapiFields: !!(n8nPayload.zapi_url && n8nPayload.zapi_token)
    });

    // Chamar N8N com timeout e detecção de falhas melhorada
    const n8nResponse = await fetch(workspaceWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload),
      signal: AbortSignal.timeout(15000) // 15 segundos timeout
    });

    const responseText = await n8nResponse.text();
    
    // Verificação melhorada de sucesso do N8N
    if (!n8nResponse.ok) {
      console.error(`❌ [${messageId}] N8N webhook failed (${n8nResponse.status}):`, responseText);
      return new Response(JSON.stringify({
        success: false,
        error: `N8N webhook failed with status ${n8nResponse.status}`,
        details: responseText,
        message: messageId
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se a resposta contém erro mesmo com status 200
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      if (responseData.error || responseData.success === false) {
        console.error(`❌ [${messageId}] N8N returned error in response:`, responseData);
        return new Response(JSON.stringify({
          success: false,
          error: 'N8N processing failed',
          details: responseData,
          message: messageId
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (parseError) {
      // Se não conseguir fazer parse, assumir que é texto simples e sucesso  
      responseData = { response: responseText };
    }

    console.log(`✅ [${messageId}] N8N webhook executado com sucesso`);
    console.log(`📊 [${messageId}] N8N response data:`, JSON.stringify(responseData, null, 2));

    // ============================================================
    // Persist provider message id for status correlation
    // - Evolution: we historically used external_id = evolution key.id
    // - Z-API: we must persist provider_msg_id (messageId) WITHOUT overwriting external_id
    // ============================================================

    // Z-API workflow returns provider_msg_id (preferred) or messageId/id (legacy)
    const zapiProviderMsgId =
      responseData?.provider_msg_id ||
      responseData?.messageId ||
      responseData?.id ||
      responseData?.response?.provider_msg_id ||
      responseData?.response?.messageId ||
      responseData?.response?.id ||
      responseData?.[0]?.provider_msg_id ||
      responseData?.[0]?.messageId ||
      responseData?.[0]?.id;

    if (providerType === 'zapi') {
      if (zapiProviderMsgId && messageId) {
        console.log(`🔄 [${messageId}] Saving Z-API provider_msg_id for status correlation: ${zapiProviderMsgId}`);

        // Merge metadata safely: read existing metadata first
        const { data: msgMetaRow } = await supabase
          .from('messages')
          .select('metadata')
          .eq('id', messageId)
          .maybeSingle();

        const nextMetadata = {
          ...(msgMetaRow?.metadata || {}),
          provider: 'zapi',
          provider_msg_id: zapiProviderMsgId,
        };

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            evolution_key_id: zapiProviderMsgId,
            status: 'sent',
            metadata: nextMetadata,
          })
          .eq('id', messageId);

        if (updateError) {
          console.error(`❌ [${messageId}] Failed to save Z-API provider_msg_id:`, updateError);
        } else {
          console.log(`✅ [${messageId}] Z-API provider_msg_id saved successfully (evolution_key_id + metadata.provider_msg_id)`);
        }
      } else {
        console.log(`⚠️ [${messageId}] Z-API send response missing provider_msg_id; status correlation may fail`, {
          hasResponse: !!responseData,
        });
      }
    } else {
      // Evolution: keep previous behavior (update external_id to evolution message key.id) if available
      const evolutionMessageId =
        responseData?.key?.id ||                    // Formato direto
        responseData?.data?.key?.id ||              // Formato com "data"
        responseData?.evolution_key_id ||           // Formato evolution_key_id
        responseData?.response?.key?.id ||          // Nested response
        responseData?.[0]?.data?.key?.id;           // Formato array

      if (evolutionMessageId && messageId) {
        console.log(`🔄 [${messageId}] Updating external_id to Evolution message ID: ${evolutionMessageId}`);

        const { error: updateError } = await supabase
          .from('messages')
          .update({
            external_id: evolutionMessageId,
            status: 'sent'  // Update status to sent after successful send
          })
          .eq('id', messageId);

        if (updateError) {
          console.error(`❌ [${messageId}] Failed to update external_id:`, updateError);
        } else {
          console.log(`✅ [${messageId}] external_id updated successfully to ${evolutionMessageId}`);
          console.log(`🔔 [${messageId}] WEBHOOK UPDATE EXPECTED: Evolution should now send messages.update webhooks for this message`);
        }
      } else {
        console.log(`⚠️ [${messageId}] No Evolution message ID found in response`);
        console.log(`📋 [${messageId}] Response structure:`, JSON.stringify(responseData, null, 2));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      method: 'n8n',
      message: messageId,
      response: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [${receivedMessageId}] Erro no N8N Send Message:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: receivedMessageId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});