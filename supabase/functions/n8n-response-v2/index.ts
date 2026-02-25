import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Feature flags for hardening pipeline
const CORS_ALLOWED_ORIGIN = Deno.env.get('CORS_ALLOWED_ORIGIN') || '*';
const ENFORCE_N8N_SECRET = Deno.env.get('ENFORCE_N8N_SECRET') === 'true';
const ENABLE_MESSAGE_IDEMPOTENCY = Deno.env.get('ENABLE_MESSAGE_IDEMPOTENCY') === 'true';

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

function generateRequestId(): string {
  return `n8n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Accept calls from Evolution or N8N (configurable validation)
  const authHeader = req.headers.get('Authorization');
  const secretHeader = req.headers.get('X-Secret');
  const expectedAuth = `Bearer ${Deno.env.get('N8N_WEBHOOK_TOKEN')}`;
  const expectedSecret = 'supabase-evolution-webhook';
  
  // Allow Evolution API calls with X-Secret header OR N8N calls with Authorization header
  const isValidEvolutionCall = secretHeader === expectedSecret;
  const isValidN8NCall = authHeader === expectedAuth;
  
  // Optional enforcement based on feature flag
  if (ENFORCE_N8N_SECRET) {
    if (!isValidEvolutionCall && !isValidN8NCall) {
      console.log(`❌ [${requestId}] Unauthorized access attempt - missing valid auth (enforcement enabled)`);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'This endpoint accepts calls from Evolution API (X-Secret) or N8N (Authorization)',
        requestId 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } else if (!isValidEvolutionCall && !isValidN8NCall) {
    console.log(`⚠️ [${requestId}] Unauthorized access but enforcement disabled - continuing`);
  }
  
  const requestSource = isValidEvolutionCall ? 'Evolution API' : 'N8N';
  console.log(`✅ [${requestId}] Authorization verified - request from ${requestSource}`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Webhook received from ${requestSource}:`, JSON.stringify(payload, null, 2));

    // If request is from Evolution API, process locally AND forward to N8N
    if (isValidEvolutionCall) {
      console.log(`🔄 [${requestId}] Processing Evolution webhook event`);
      
      // Extract instance name from payload
      const instanceName = payload.instance || payload.instanceName;
      console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: ${payload.event}`);
      
      // Get workspace_id and webhook details from database
      let workspaceId = null;
      let webhookUrl = null;
      let webhookSecret = null;
      let processedData: any = null;
      
      if (instanceName) {
        // Get workspace_id from connections table
        const { data: connection } = await supabase
          .from('connections')
          .select('workspace_id')
          .eq('instance_name', instanceName)
          .single();

        if (connection) {
          workspaceId = connection.workspace_id;
          
          // Get webhook settings for this workspace
          const { data: webhookSettings } = await supabase
            .from('workspace_webhook_settings')
            .select('webhook_url, webhook_secret')
            .eq('workspace_id', workspaceId)
            .single();

          if (webhookSettings) {
            webhookUrl = webhookSettings.webhook_url;
            webhookSecret = webhookSettings.webhook_secret;
          }
        }
      }

      // If no webhook configured, use fallback
      if (!webhookUrl) {
        webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
        webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
      }

      // ❌ NÃO PROCESSAR LOCALMENTE - Apenas encaminhar para N8N
      console.log(`🔄 [${requestId}] Enviando para N8N processar (sem processamento local)`);
      processedData = null;

      // Forward to N8N with processed data
      if (webhookUrl) {
        console.log(`🚀 [${requestId}] Forwarding to N8N: ${webhookUrl}`);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (webhookSecret) {
          headers['Authorization'] = `Bearer ${webhookSecret}`;
        }

        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              ...payload,
              workspace_id: workspaceId,
              source: 'evolution-api',
              forwarded_by: 'n8n-response-v2',
              request_id: requestId,
              processed_data: processedData
            })
          });

          console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
          
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
        }
      }

      // Always return processed data or basic structure  
      return new Response(JSON.stringify({
        success: true,
        action: 'processed_and_forwarded',
        message_id: processedData?.message_id || crypto.randomUUID(),
        workspace_id: processedData?.workspace_id || workspaceId,
        conversation_id: processedData?.conversation_id,
        contact_id: processedData?.contact_id,
        connection_id: processedData?.connection_id,
        instance: processedData?.instance,
        phone_number: processedData?.phone_number,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // N8N Response Processing - Only process if from N8N
    console.log(`🎯 [${requestId}] Processing N8N response payload`);
    console.log(`📋 [${requestId}] Full payload structure:`, JSON.stringify(payload, null, 2));
    console.log(`🔍 [${requestId}] Auth header: ${authHeader ? 'present' : 'missing'}`);
    console.log(`🔍 [${requestId}] Expected auth: ${expectedAuth}`);
    console.log(`🔍 [${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));
    
    // 🎯 STRICT PAYLOAD VALIDATION - N8N must send normalized payload
    let { 
      direction,           // 'inbound' or 'outbound' 
      external_id,         // Required for message updates
      phone_number,        // Required
      content,            // Required for new messages
      message_type = 'text',
      sender_type,        // 'contact' or 'agent'
      file_url,
      file_name,
      mime_type,
      workspace_id,       // Required for new conversations
      connection_id,      // Optional for inbound
      contact_name,       // Optional
      reply_to_message_id, // Optional - UUID of quoted message
      quoted_message,      // Optional - JSONB with quoted message data
      metadata = {},
      provider_moment      // Optional - timestamp Unix em ms do momento real da mensagem
    } = payload;
    
    // 🕐 EXTRAIR provider_moment do payload do webhook (ZAPI/Evolution)
    // Prioridade: campo direto > webhook_data.momment > data.momment > fallback Date.now()
    if (!provider_moment) {
      provider_moment = payload.webhook_data?.momment || 
                        payload.data?.momment || 
                        payload.momment ||
                        Date.now();
    }
    console.log(`🕐 [${requestId}] provider_moment: ${provider_moment} (${new Date(provider_moment).toISOString()})`);
    
    // 🔄 EXTRACT QUOTED MESSAGE from Evolution payload structure (data.message.quoted)
    if (!reply_to_message_id && payload.data?.message?.quoted) {
      const quotedData = payload.data.message.quoted;
      console.log(`📨 [${requestId}] Extracting quoted message from Evolution payload:`, quotedData);
      
      // Try to find the quoted message in database by external_id
      const quotedExternalId = quotedData.key?.id;
      if (quotedExternalId) {
        const { data: quotedMsg } = await supabase
          .from('messages')
          .select('id, content, sender_type, message_type, file_url, file_name')
          .eq('external_id', quotedExternalId)
          .maybeSingle();
        
        if (quotedMsg) {
          console.log(`✅ [${requestId}] Found quoted message in database: ${quotedMsg.id}`);
          reply_to_message_id = quotedMsg.id;
          quoted_message = {
            id: quotedMsg.id,
            content: quotedMsg.content,
            sender_type: quotedMsg.sender_type,
            message_type: quotedMsg.message_type,
            file_url: quotedMsg.file_url,
            file_name: quotedMsg.file_name,
            external_id: quotedExternalId
          };
        } else {
          console.log(`⚠️ [${requestId}] Quoted message not found in database, creating minimal reference`);
          quoted_message = {
            content: quotedData.message?.conversation || quotedData.message?.extendedTextMessage?.text || '',
            sender_type: quotedData.key?.fromMe ? 'agent' : 'contact',
            external_id: quotedExternalId
          };
        }
      }
    }
    
    console.log(`📋 [${requestId}] Extracted fields: direction=${direction}, external_id=${external_id}, content="${content}", workspace_id=${workspace_id}, has_quote=${!!reply_to_message_id}`);

    // Validate required fields
    if (!direction || !['inbound', 'outbound'].includes(direction)) {
      console.error(`❌ [${requestId}] Invalid or missing direction: ${direction}`);
      return new Response(JSON.stringify({
        error: 'Invalid direction',
        message: 'direction must be "inbound" or "outbound"',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phone_number) {
      console.error(`❌ [${requestId}] Missing phone_number`);
      return new Response(JSON.stringify({
        error: 'Missing phone_number',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sanitizedPhone = sanitizePhoneNumber(phone_number);
    console.log(`📱 [${requestId}] Processing ${direction} message for phone: ${sanitizedPhone}`);

    if (external_id) {
      // UPDATE EXISTING MESSAGE (for N8N responses updating previously created messages)
      console.log(`🔄 [${requestId}] Updating existing message: ${external_id}`);
      
      // Check if this is a duplicate N8N response (same external_id and content)
      const { data: existingMessage, error: findError } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id, content, file_url, file_name, mime_type, metadata, sender_type, reply_to_message_id, quoted_message')
        .eq('external_id', external_id)
        .maybeSingle();

      if (findError) {
        console.error(`❌ [${requestId}] Error finding message:`, findError);
        return new Response(JSON.stringify({
          error: 'Failed to find message',
          details: findError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!existingMessage) {
        console.log(`⚠️ [${requestId}] Message not found for update: ${external_id}, treating as new message`);
        // If no content provided for new message, create placeholder message
        if (!content && !file_url && direction === 'outbound') {
          console.log(`📝 [${requestId}] Creating placeholder message for external_id: ${external_id}`);
          // Set default content for placeholder messages
          content = 'Mensagem em processamento...';
        }
        // Fall through to creation logic
      } else {
        // Check if this is an inbound message being processed again (prevent duplicate processing)
        if (existingMessage.sender_type === 'contact' && direction === 'inbound' && 
            existingMessage.metadata?.message_flow === 'inbound_original') {
          console.log(`⚠️ [${requestId}] Duplicate inbound message detected, skipping: ${external_id}`);
          
          // Get contact_id from conversation
          const { data: conversation } = await supabase
            .from('conversations')
            .select('contact_id')
            .eq('id', existingMessage.conversation_id)
            .single();
          
          return new Response(JSON.stringify({
            success: true,
            action: 'duplicate_skipped',
            message_id: external_id,
            workspace_id: existingMessage.workspace_id,
            conversation_id: existingMessage.conversation_id,
            contact_id: conversation?.contact_id,
            requestId
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update existing message (typically bot responses)
        const updateData: any = {};
        if (content !== undefined) updateData.content = content;
        if (file_url !== undefined) updateData.file_url = file_url;
        if (file_name !== undefined) updateData.file_name = file_name;
        if (mime_type !== undefined) updateData.mime_type = mime_type;
        // Preservar reply_to_message_id e quoted_message se existirem
        if (reply_to_message_id !== undefined) updateData.reply_to_message_id = reply_to_message_id;
        if (quoted_message !== undefined) updateData.quoted_message = quoted_message;
        if (Object.keys(metadata).length > 0) {
          updateData.metadata = { 
            ...existingMessage.metadata, 
            ...metadata,
            message_flow: 'n8n_response_update'
          };
        }

        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('external_id', external_id);

        if (updateError) {
          console.error(`❌ [${requestId}] Error updating message:`, updateError);
          return new Response(JSON.stringify({
            error: 'Failed to update message',
            details: updateError.message,
            requestId
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`✅ [${requestId}] Message updated successfully: ${external_id}`);
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', existingMessage.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'updated',
          message_id: external_id,
          workspace_id: existingMessage.workspace_id,
          conversation_id: existingMessage.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // CREATE NEW MESSAGE - só exigir content se não for atualização e não for outbound com external_id
    if (!content && !file_url && !external_id) {
      console.error(`❌ [${requestId}] Missing content for new message`);
      return new Response(JSON.stringify({
        error: 'Missing content',
        message: 'content, file_url, or external_id is required for messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Se não tem content mas tem external_id e é outbound, criar content padrão
    if (!content && !file_url && external_id && direction === 'outbound') {
      content = 'Mensagem em processamento...';
      console.log(`📝 [${requestId}] Using default content for outbound message with external_id`);
    }

    if (!workspace_id) {
      console.error(`❌ [${requestId}] Missing workspace_id for new message`);
      return new Response(JSON.stringify({
        error: 'Missing workspace_id',
        message: 'workspace_id is required for new messages',
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for duplicate messages by external_id before creating new
    if (external_id) {
      const { data: duplicateCheck } = await supabase
        .from('messages')
        .select('id, conversation_id, workspace_id')
        .eq('external_id', external_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      if (duplicateCheck) {
        console.log(`⚠️ [${requestId}] Message with external_id already exists, skipping creation: ${external_id}`);
        
        // Get contact_id from conversation
        const { data: conversation } = await supabase
          .from('conversations')
          .select('contact_id')
          .eq('id', duplicateCheck.conversation_id)
          .single();
        
        return new Response(JSON.stringify({
          success: true,
          action: 'duplicate_prevented',
          message_id: duplicateCheck.id,
          workspace_id: duplicateCheck.workspace_id,
          conversation_id: duplicateCheck.conversation_id,
          contact_id: conversation?.contact_id,
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`🆕 [${requestId}] Creating new ${direction} message`);

    // Find or create contact
    let contactId: string;
    const { data: existingContact, error: contactFindError } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', sanitizedPhone)
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (contactFindError) {
      console.error(`❌ [${requestId}] Error finding contact:`, contactFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find contact',
        details: contactFindError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (existingContact) {
      contactId = existingContact.id;
      console.log(`✅ [${requestId}] Found existing contact: ${contactId}`);
    } else {
      // Create new contact
      const { data: newContact, error: contactCreateError } = await supabase
        .from('contacts')
        .insert({
          phone: sanitizedPhone,
          name: contact_name || sanitizedPhone,
          workspace_id: workspace_id
        })
        .select('id')
        .single();

      if (contactCreateError) {
        console.error(`❌ [${requestId}] Error creating contact:`, contactCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create contact',
          details: contactCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      contactId = newContact.id;
      console.log(`✅ [${requestId}] Created new contact: ${contactId}`);
    }

    // Process contact profile image from N8N payload if available
    const profilePictureUrl = payload.profilePictureUrl || 
                              payload.data?.profilePictureUrl ||
                              payload.data?.message?.profilePictureUrl ||
                              payload.contact?.profilePicture ||
                              payload.sender?.profilePicture ||
                              payload.message?.profilePictureUrl;
    
    if (profilePictureUrl && phone_number && workspace_id) {
      console.log(`🖼️ [${requestId}] Profile image URL received from N8N: ${profilePictureUrl}`);
      
      try {
        // Use the new process-profile-image function
        const profileSaveResult = await supabase.functions.invoke('process-profile-image', {
          body: {
            phone: sanitizedPhone,
            profileImageUrl: profilePictureUrl,
            contactId: contactId,
            workspaceId: workspace_id,
            instanceName: payload.instance || 'n8n'
          }
        });

        if (profileSaveResult.error) {
          console.error(`⚠️ [${requestId}] Error saving profile image from N8N:`, profileSaveResult.error);
        } else {
          console.log(`✅ [${requestId}] Profile image saved from N8N payload for`, sanitizedPhone);
        }
      } catch (error) {
        console.error(`⚠️ [${requestId}] Error saving profile image from N8N:`, error);
      }
    } else if (phone_number && contact_name) {
      console.log(`🔍 [${requestId}] No profile image URL in N8N payload, checking if fetch is needed for ${sanitizedPhone}`);
      
      try {
        // Check if contact already has a recent profile image
        const { data: contactData } = await supabase
          .from('contacts')
          .select('profile_image_updated_at, profile_fetch_last_attempt')
          .eq('id', contactId)
          .maybeSingle();

        const now = new Date();
        const lastUpdate = contactData?.profile_image_updated_at ? new Date(contactData.profile_image_updated_at) : null;
        const lastAttempt = contactData?.profile_fetch_last_attempt ? new Date(contactData.profile_fetch_last_attempt) : null;
        
        // Skip if image was updated in the last 24 hours
        const shouldSkipRecent = lastUpdate && (now.getTime() - lastUpdate.getTime()) < 24 * 60 * 60 * 1000;
        // Skip if attempt was made in the last hour
        const shouldSkipAttempt = lastAttempt && (now.getTime() - lastAttempt.getTime()) < 60 * 60 * 1000;
        
        if (shouldSkipRecent) {
          console.log(`⏭️ [${requestId}] Skipping profile image fetch - updated recently for ${sanitizedPhone}`);
        } else if (shouldSkipAttempt) {
          console.log(`⏭️ [${requestId}] Skipping profile image fetch - attempted recently for ${sanitizedPhone}`);
        } else {
          console.log(`🔄 [${requestId}] May need to fetch profile image from Evolution API for ${sanitizedPhone}`);
          // Note: Evolution API fetch would happen via separate background process
        }
      } catch (error) {
        console.error(`⚠️ [${requestId}] Error checking profile image status:`, error);
      }
    }

    // Resolve latest phone number of the connection (instance number)
    let connectionPhone: string | null = null;
    if (connection_id) {
      const { data: connectionInfo, error: connectionInfoError } = await supabase
        .from('connections')
        .select('phone_number')
        .eq('id', connection_id)
        .maybeSingle();

      if (connectionInfoError) {
        console.error(`⚠️ [${requestId}] Error fetching connection phone:`, connectionInfoError.message);
      } else {
        connectionPhone = connectionInfo?.phone_number || null;
      }
    }

    // Find existing conversation for this contact and workspace (prioritize reusing any existing conversation)
    let conversationId: string;
    const { data: existingConversation, error: conversationFindError } = await supabase
      .from('conversations')
      .select('id, connection_id, connection_phone')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conversationFindError) {
      console.error(`❌ [${requestId}] Error finding conversation:`, conversationFindError);
      return new Response(JSON.stringify({
        error: 'Failed to find conversation',
        details: conversationFindError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let reusableConversation = existingConversation;

    if (existingConversation && connectionPhone) {
      if (existingConversation.connection_phone && existingConversation.connection_phone !== connectionPhone) {
        console.log(`↪️ [${requestId}] Connection phone changed (old: ${existingConversation.connection_phone}, new: ${connectionPhone}). Creating a fresh conversation.`);
        reusableConversation = null;
      } else if (!existingConversation.connection_phone) {
        await supabase
          .from('conversations')
          .update({ connection_phone: connectionPhone })
          .eq('id', existingConversation.id);
        reusableConversation = { ...existingConversation, connection_phone: connectionPhone };
      }
    }

    if (reusableConversation) {
      conversationId = reusableConversation.id;
      console.log(`✅ [${requestId}] Found existing conversation: ${conversationId}`);
      
      // Update connection_id if provided and different (link conversation to current connection)
      if (connection_id && reusableConversation.connection_id !== connection_id) {
        await supabase
          .from('conversations')
          .update({ connection_id: connection_id })
          .eq('id', conversationId);
        console.log(`🔗 [${requestId}] Updated conversation connection_id: ${connection_id}`);
      }
    } else {
      // Create new conversation only if none exists for this contact
      const { data: newConversation, error: conversationCreateError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          workspace_id: workspace_id,
          connection_id: connection_id,
          connection_phone: connectionPhone,
          status: 'open'
        })
        .select('id')
        .single();

      if (conversationCreateError) {
        console.error(`❌ [${requestId}] Error creating conversation:`, conversationCreateError);
        return new Response(JSON.stringify({
          error: 'Failed to create conversation',
          details: conversationCreateError.message,
          requestId
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      conversationId = newConversation.id;
      console.log(`✅ [${requestId}] Created new conversation: ${conversationId}`);
    }

    // Check for system message loop prevention when idempotency is enabled
    if (ENABLE_MESSAGE_IDEMPOTENCY && metadata?.origem_resposta === 'system') {
      console.log(`🔄 [${requestId}] Skipping system message to prevent loop (idempotency enabled)`);
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped_system_message',
        message: 'System message skipped to prevent loop',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create message with optional idempotency
    const messageData = {
      id: crypto.randomUUID(), // Sempre gerar UUID único para id
      conversation_id: conversationId,
      workspace_id: workspace_id,
      content: content || (file_url ? `📎 ${file_name || 'Arquivo'}` : ''),
      message_type: message_type,
      sender_type: sender_type || (direction === 'inbound' ? 'contact' : 'agent'),
      file_url: file_url || null,
      file_name: file_name || null,
      mime_type: mime_type || null,
      reply_to_message_id: reply_to_message_id || null,
      quoted_message: quoted_message || null,
      status: direction === 'inbound' ? 'received' : 'sent',
      origem_resposta: direction === 'inbound' ? 'automatica' : 'manual',
      external_id: external_id || crypto.randomUUID(), // external_id separado do id
      provider_moment: provider_moment, // 🕐 Timestamp real da mensagem no WhatsApp
      metadata: {
        source: 'n8n-response-v2',
        direction: direction,
        request_id: requestId,
        message_flow: direction === 'outbound' ? 'n8n_bot_response' : 'n8n_new_message',
        ...metadata
      }
    };

    // Insert or upsert based on idempotency flag
    let newMessage, messageCreateError;
    
    if (ENABLE_MESSAGE_IDEMPOTENCY && external_id) {
      console.log(`🔄 [${requestId}] Using upsert for idempotency with external_id: ${external_id}`);
      const { data, error } = await supabase
        .from('messages')
        .upsert(messageData, { 
          onConflict: 'workspace_id,external_id',
          ignoreDuplicates: false 
        })
        .select('id')
        .single();
      newMessage = data;
      messageCreateError = error;
    } else {
      console.log(`📝 [${requestId}] Using standard insert (idempotency disabled or no external_id)`);
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select('id')
        .single();
      newMessage = data;
      messageCreateError = error;
    }

    if (messageCreateError) {
      console.error(`❌ [${requestId}] Error creating message:`, messageCreateError);
      return new Response(JSON.stringify({
        error: 'Failed to create message',
        details: messageCreateError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!newMessage) {
      console.error(`❌ [${requestId}] Message created but not returned`);
      return new Response(JSON.stringify({
        error: 'Failed to create message',
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Message created successfully: ${newMessage.id}`, {
      has_quoted_message: !!reply_to_message_id,
      quoted_message_id: reply_to_message_id || 'none'
    });

    // Se mensagem é de contato, verificar automações
    if (direction === 'incoming') {
      console.log(`🔍 [${requestId}] Verificando automações para contato ${contactId}, conversa ${conversationId}`);
      
      try {
        await supabase.functions.invoke('check-message-automations', {
          body: {
            contactId,
            conversationId,
            workspaceId: workspace_id,
            messageId: newMessage.id
          }
        });
      } catch (automationError) {
        console.error(`⚠️ [${requestId}] Erro ao verificar automações:`, automationError);
        // Não falhar a request se automações falharem
      }
    }

    // Update conversation timestamp (triggers will handle unread_count)
    const { error: conversationUpdateError } = await supabase
      .from('conversations')
      .update({ 
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (conversationUpdateError) {
      console.warn(`⚠️ [${requestId}] Failed to update conversation timestamp:`, conversationUpdateError);
    }

    // Get connection details for response
    let instanceInfo = null;
    const finalConnectionId = connection_id || (existingConversation ? existingConversation.connection_id : null);
    if (finalConnectionId) {
      const { data: connectionData } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', finalConnectionId)
        .maybeSingle();
      
      if (connectionData) {
        instanceInfo = connectionData.instance_name;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'created',
      message_id: newMessage.id,
      workspace_id: workspace_id,
      conversation_id: conversationId,
      contact_id: contactId,
      connection_id: finalConnectionId,
      instance: instanceInfo,
      phone_number: phone_number,
      requestId
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
