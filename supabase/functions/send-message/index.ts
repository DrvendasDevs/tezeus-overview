import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

// Gerar ID único para cada request
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Validar schema de entrada
function validateRequestBody(body: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!body.conversation_id || typeof body.conversation_id !== 'string') {
    errors.push('conversation_id is required and must be a string');
  }
  
  if (!body.content || typeof body.content !== 'string') {
    errors.push('content is required and must be a string');
  }
  
  if (!body.sender_id || typeof body.sender_id !== 'string') {
    errors.push('sender_id is required and must be a string');
  }
  
  const validMessageTypes = ['text', 'image', 'audio', 'video', 'file', 'document'];
  if (!validMessageTypes.includes(body.message_type)) {
    errors.push(`message_type must be one of: ${validMessageTypes.join(', ')}`);
  }
  
  const validSenderTypes = ['user', 'agent', 'system'];
  if (!validSenderTypes.includes(body.sender_type)) {
    errors.push(`sender_type must be one of: ${validSenderTypes.join(', ')}`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// Extrair informações do usuário do JWT para validação no sistema customizado
function extractUserDataFromJWT(authHeader: string | null): { email: string | null; systemUserId: string | null; systemEmail: string | null } {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { email: null, systemUserId: null, systemEmail: null };
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    return {
      email: payload.email || null,
      systemUserId: payload.system_user_id || null,
      systemEmail: payload.system_email || null
    };
  } catch (error) {
    console.error('Error extracting JWT data:', error);
    return { email: null, systemUserId: null, systemEmail: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  console.log(`🚀 [${requestId}] Send message request started`);

  try {
    // Parse request body
    const body = await req.json();
    console.log(`📝 [${requestId}] Request body:`, { 
      conversation_id: body.conversation_id,
      message_type: body.message_type,
      sender_type: body.sender_type,
      hasContent: !!body.content,
      hasFile: !!body.file_url
    });

    // Validate request body
    const { isValid, errors } = validateRequestBody(body);
    if (!isValid) {
      console.error(`❌ [${requestId}] Validation errors:`, errors);
      return new Response(JSON.stringify({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        errors,
        requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract headers
    const authHeader = req.headers.get('authorization');
    const systemUserIdHeader = req.headers.get('x-system-user-id');
    const systemUserEmailHeader = req.headers.get('x-system-user-email');
    const workspaceIdHeader = req.headers.get('x-workspace-id');

    // Extract user data from JWT
    const { email: currentUserEmail, systemUserId: jwtSystemUserId, systemEmail: jwtSystemEmail } = extractUserDataFromJWT(authHeader);
    const systemUserId = systemUserIdHeader || jwtSystemUserId;

    console.log(`👤 [${requestId}] User context:`, {
      systemUserId: systemUserId?.substring(0, 8) + '***',
      currentUserEmail: currentUserEmail?.substring(0, 5) + '***',
      workspaceIdHeader: workspaceIdHeader?.substring(0, 8) + '***'
    });

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get conversation details with contact and connection info
    const { data: conversation, error: conversationError } = await (supabase as any)
      .from('conversations')
      .select(`
        id,
        workspace_id,
        connection_id,
        contact:contacts(id, phone, name),
        connection:connections(id, instance_name, status)
      `)
      .eq('id', body.conversation_id)
      .single();

    if (conversationError || !conversation) {
      console.error(`❌ [${requestId}] Conversation not found:`, conversationError);
      return new Response(JSON.stringify({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
        requestId
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize joined data (Supabase may return arrays for joins)
    const connection = Array.isArray(conversation.connection) 
      ? conversation.connection[0] 
      : conversation.connection;
    const contact = Array.isArray(conversation.contact) 
      ? conversation.contact[0] 
      : conversation.contact;

    // Validate connection
    if (!connection || connection.status !== 'connected') {
      console.error(`❌ [${requestId}] Connection not ready:`, {
        hasConnection: !!connection,
        status: connection?.status
      });
      return new Response(JSON.stringify({
        code: 'CONNECTION_NOT_READY',
        message: 'WhatsApp connection is not ready',
        requestId
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ [${requestId}] Conversation and connection validated:`, {
      conversationId: conversation.id,
      workspaceId: conversation.workspace_id,
      connectionId: conversation.connection_id,
      instanceName: connection.instance_name,
      contactPhone: contact?.phone?.substring(0, 8) + '***'
    });

    // Create message record in database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        workspace_id: conversation.workspace_id,
        content: body.content,
        message_type: body.message_type,
        sender_type: body.sender_type,
        sender_id: body.sender_id,
        file_url: body.file_url,
        file_name: body.file_name,
        mime_type: body.mime_type,
        status: 'sending',
        external_id: requestId, // Usar requestId como external_id
        metadata: {
          requestId,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error(`❌ [${requestId}] Failed to create message:`, messageError);
      return new Response(JSON.stringify({
        code: 'MESSAGE_CREATION_ERROR',
        message: 'Failed to create message record',
        details: messageError?.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`💾 [${requestId}] Message created in database:`, { messageId: message.id });

    // REFATORADO: Usar centralizador inteligente com fallback automático
    console.log(`🚀 [${requestId}] Send message request initiated - ROUTING VIA SMART SENDER`);
    
    // Preparar payload para o centralizador
    const senderPayload = {
      messageId: message.id,
      phoneNumber: conversation.contact?.phone,
      content: body.content,
      messageType: body.message_type || 'text',
      fileUrl: body.file_url,
      fileName: body.file_name,
      evolutionInstance: conversation.connection.instance_name,
      conversationId: conversation.id,
      workspaceId: conversation.workspace_id,
      external_id: message.external_id // Incluir external_id no payload
    };

    // Chamar centralizador inteligente
    const { data: senderResult, error: senderError } = await supabase.functions.invoke('message-sender', {
      body: senderPayload,
      headers: {
        'x-system-user-id': systemUserId || body.sender_id,
        'x-system-user-email': currentUserEmail || systemUserEmailHeader || ''
      }
    });

    if (senderError) {
      console.error(`❌ [${requestId}] Message sender error:`, senderError);
      
      // Atualizar status da mensagem para erro
      await supabase
        .from('messages')
        .update({ 
          status: 'failed',
          metadata: { 
            error: senderError.message,
            sent_via: 'sender_error',
            requestId,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', message.id);

      return new Response(JSON.stringify({
        code: 'MESSAGE_SENDER_ERROR',
        message: 'Failed to send message',
        details: senderError.message,
        requestId
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Sucesso - atualizar metadata da mensagem
    await supabase
      .from('messages')
      .update({ 
        status: 'sent',
        metadata: { 
          sent_via: senderResult.method,
          fallback_reason: senderResult.fallback || null,
          requestId,
          timestamp: new Date().toISOString(),
          external_response: senderResult.result
        }
      })
      .eq('id', message.id);

    console.log(`✅ [${requestId}] Message sent successfully via ${senderResult.method}`);

    return new Response(JSON.stringify({
      success: true,
      message_id: message.id,
      conversation_id: conversation.id,
      sent_via: senderResult.method,
      fallback_reason: senderResult.fallback || null,
      requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error in send-message:`, error);
    
    return new Response(JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});