import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LabSendMessageRequest {
  session_id: string
  message_content: string
}

// Nota: A resposta do agente e ações são enviadas via callback (lab-action-callback)
// Não processamos mais a resposta do N8N aqui

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 [Lab] Iniciando lab-send-message')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { session_id, message_content } = body as LabSendMessageRequest

    console.log('📧 [Lab] Recebida mensagem para sessão:', session_id)

    // 1. Buscar dados completos da sessão
    const { data: session, error: sessionError } = await supabase
      .from('lab_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error('❌ [Lab] Sessão não encontrada:', sessionError)
      throw new Error('Sessão não encontrada')
    }

    console.log('✅ [Lab] Sessão encontrada:', session.id)
    console.log('📋 [Lab] IDs da sessão:', {
      contact_id: session.contact_id,
      conversation_id: session.conversation_id,
      card_id: session.card_id,
      connection_id: session.connection_id,
      agent_id: session.agent_id
    })

    // 2. Primeiro buscar a conversa para obter connection_id (caso session não tenha)
    let conversationData = null
    if (session.conversation_id) {
      const { data: conversation, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', session.conversation_id)
        .single()
      if (convErr) console.error('❌ [Lab] Erro ao buscar conversa:', convErr)
      conversationData = conversation
      console.log('💬 [Lab] Conversa encontrada, connection_id:', conversation?.connection_id)
    }

    // 3. Buscar dados do contato real
    let contactData = null
    const contactIdToUse = session.contact_id || conversationData?.contact_id
    if (contactIdToUse) {
      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactIdToUse)
        .single()
      if (contactErr) console.error('❌ [Lab] Erro ao buscar contato:', contactErr)
      contactData = contact
    }
    console.log('👤 [Lab] Contato:', contactData?.id || 'não encontrado')
    console.log('💬 [Lab] Conversa:', conversationData?.id || 'não encontrada')

    // 4. Buscar dados da conexão PRIMEIRO (precisamos para o payload)
    let connectionData = null
    // Primeiro tenta pelo session.connection_id, depois pela conversa
    const connectionIdToUse = session.connection_id || conversationData?.connection_id
    console.log('🔍 [Lab] Buscando conexão com ID:', connectionIdToUse)
    
    if (connectionIdToUse) {
      const { data: connection, error: connErr } = await supabase
        .from('connections')
        .select('*')
        .eq('id', connectionIdToUse)
        .single()
      if (connErr) console.error('❌ [Lab] Erro ao buscar conexão:', connErr)
      connectionData = connection
    }
    console.log('📱 [Lab] Conexão:', connectionData?.id || 'não encontrada', connectionData?.instance_name || '')

    // 5. Buscar dados do card real (ou criar se não existir)
    let cardData = null
    const cardIdToUse = session.card_id
    
    if (cardIdToUse) {
      const { data: card, error: cardErr } = await supabase
        .from('pipeline_cards')
        .select('*')
        .eq('id', cardIdToUse)
        .single()
      if (cardErr) console.error('❌ [Lab] Erro ao buscar card:', cardErr)
      cardData = card
    }
    
    // Fallback 1: buscar card pela conversa
    if (!cardData && conversationData?.id) {
      const { data: cardByConv } = await supabase
        .from('pipeline_cards')
        .select('*')
        .eq('conversation_id', conversationData.id)
        .maybeSingle()
      if (cardByConv) {
        cardData = cardByConv
        console.log('🔄 [Lab] Card encontrado via conversa:', cardData.id)
      }
    }
    
    // Fallback 2: CRIAR card se não existir e conexão tem pipeline configurado
    if (!cardData && connectionData?.default_pipeline_id && connectionData?.default_column_id && contactData?.id && conversationData?.id) {
      console.log('🎴 [Lab] Card não existe, criando automaticamente...')
      const { data: newCard, error: newCardErr } = await supabase
        .from('pipeline_cards')
        .insert({
          pipeline_id: connectionData.default_pipeline_id,
          column_id: connectionData.default_column_id,
          contact_id: contactData.id,
          conversation_id: conversationData.id,
          status: 'aberto',
          value: 0,
          is_lab_test: true
        })
        .select()
        .single()
      
      if (newCardErr) {
        console.error('❌ [Lab] Erro ao criar card:', newCardErr)
        // Tentar sem is_lab_test
        const { data: newCardNoFlag, error: newCardNoFlagErr } = await supabase
          .from('pipeline_cards')
          .insert({
            pipeline_id: connectionData.default_pipeline_id,
            column_id: connectionData.default_column_id,
            contact_id: contactData.id,
            conversation_id: conversationData.id,
            status: 'aberto',
            value: 0
          })
          .select()
          .single()
        
        if (!newCardNoFlagErr && newCardNoFlag) {
          cardData = newCardNoFlag
          console.log('✅ [Lab] Card criado (sem flag):', cardData.id)
          
          // Atualizar sessão com o card_id
          await supabase.from('lab_sessions').update({ card_id: cardData.id }).eq('id', session.id)
        }
      } else if (newCard) {
        cardData = newCard
        console.log('✅ [Lab] Card criado:', cardData.id)
        
        // Atualizar sessão com o card_id
        await supabase.from('lab_sessions').update({ card_id: cardData.id }).eq('id', session.id)
      }
    }
    
    console.log('🎴 [Lab] Card:', cardData?.id || 'não encontrado')

    // 6. Buscar dados do agente
    let agentData = null
    if (session.agent_id) {
      const { data: agent, error: agentErr } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', session.agent_id)
        .single()
      if (agentErr) console.error('❌ [Lab] Erro ao buscar agente:', agentErr)
      agentData = agent
    }
    console.log('🤖 [Lab] Agente:', agentData?.id || 'não encontrado')

    // 7. Buscar fila se existir
    let queueData = null
    if (conversationData?.queue_id) {
      const { data: queue, error: queueErr } = await supabase
        .from('queues')
        .select('*')
        .eq('id', conversationData.queue_id)
        .single()
      if (queueErr) console.error('❌ [Lab] Erro ao buscar fila:', queueErr)
      queueData = queue
    }
    console.log('📂 [Lab] Fila:', queueData?.id || 'não encontrada')

    console.log('✅ [Lab] Dados carregados:', {
      contact: contactData?.id,
      conversation: conversationData?.id,
      card: cardData?.id,
      connection: connectionData?.id,
      agent: agentData?.id
    })

    // 8. Salvar mensagem do usuário
    const { error: userMsgError } = await supabase
      .from('lab_messages')
      .insert({
        session_id: session.id,
        sender_type: 'user',
        content: message_content
      })

    if (userMsgError) {
      console.error('❌ [Lab] Erro ao salvar mensagem do usuário:', userMsgError)
    }

    // 9. Montar payload COMPLETO no formato que o N8N espera
    const instanceId = connectionData?.metadata?.instanceId || connectionData?.metadata?.id || ''
    const instanceToken = connectionData?.metadata?.instanceToken || connectionData?.metadata?.token || ''
    
    const payload = {
      webhook: {
        event_type: 'LabTest',
        provider: 'lab',
        instance_name: connectionData?.instance_name || '',
        instance_token: instanceToken,
        client_token: instanceToken,
        workspace_id: session.workspace_id,
        connection_id: session.connection_id,
        contact_phone: session.contact_phone,
        contact_id: session.contact_id,
        chat_lid: null,
        external_id: `lab_${Date.now()}`,
        status: 'received',
        timestamp: new Date().toISOString(),
        webhook_data: {
          isStatusReply: false,
          connectedPhone: connectionData?.phone_number || '',
          waitingMessage: false,
          isEdit: false,
          isGroup: false,
          isNewsletter: false,
          instanceId: instanceId,
          messageId: `lab_msg_${Date.now()}`,
          phone: session.contact_phone,
          fromMe: false,
          momment: Date.now(),
          status: 'received',
          chatName: session.contact_name,
          senderName: session.contact_name,
          broadcast: false,
          type: 'ReceivedCallback',
          fromApi: false,
          text: {
            message: message_content
          }
        },
        message_origin: 'external_outside_system',
        is_ai_agent: false,
        is_system_message: false
      },
      contato: contactData || {
        id: session.contact_id,
        name: session.contact_name,
        phone: session.contact_phone,
        workspace_id: session.workspace_id
      },
      conversa: conversationData || {
        id: session.conversation_id,
        contact_id: session.contact_id,
        status: 'open',
        agente_ativo: true,
        agent_active_id: session.agent_id,
        workspace_id: session.workspace_id
      },
      card: cardData,
      conexao: connectionData,
      fila: queueData,
      agente_ativo: agentData,
      mensagem: {
        id: `lab_msg_${Date.now()}`,
        conversation_id: session.conversation_id,
        sender_type: 'contact',
        sender_id: null,
        content: message_content,
        message_type: 'text',
        created_at: new Date().toISOString(),
        status: 'sent',
        origem_resposta: 'manual',
        workspace_id: session.workspace_id
      },
      midia: null,
      contact_id: session.contact_id,
      conversation_id: session.conversation_id,
      message_id: `lab_msg_${Date.now()}`,
      instance: connectionData?.instance_name || '',
      destinatario: session.contact_phone,
      mensagemTexto: message_content,
      workspace_id: session.workspace_id,
      lab_session_id: session.id
    }

    console.log('📤 [Lab] Enviando para N8N:', session.webhook_url)
    console.log('📤 [Lab] Payload completo com IDs reais')

    // 10. Enviar para o webhook do N8N
    // A resposta do agente e ações serão enviadas via callback (lab-action-callback)
    console.log('📤 [Lab] URL do webhook:', session.webhook_url)
    
    let webhookStatus = 'pending'
    let webhookError = null
    let webhookResponseStatus = null
    
    try {
      console.log('🚀 [Lab] Iniciando fetch para N8N...')
      
      const n8nResponse = await fetch(session.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      webhookResponseStatus = n8nResponse.status
      console.log('📥 [Lab] Status do N8N:', n8nResponse.status)

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text()
        console.error('❌ [Lab] N8N retornou erro:', n8nResponse.status, errorText.substring(0, 500))
        webhookStatus = 'error'
        webhookError = `N8N retornou status ${n8nResponse.status}: ${errorText.substring(0, 200)}`
      } else {
        console.log('✅ [Lab] Webhook recebido pelo N8N com sucesso')
        webhookStatus = 'success'
      }
    } catch (fetchError: any) {
      console.error('❌ [Lab] Erro de conexão com N8N:', fetchError.message)
      console.error('❌ [Lab] Stack:', fetchError.stack)
      webhookStatus = 'connection_error'
      webhookError = `Erro de conexão: ${fetchError.message}`
    }

    // A resposta do agente e as ações serão enviadas via callback (lab-action-callback)
    console.log('✅ [Lab] Mensagem processada - aguardando callbacks do N8N')
    console.log('📊 [Lab] Status final do webhook:', webhookStatus, webhookError || '')

    return new Response(
      JSON.stringify({
        success: webhookStatus === 'success',
        message: webhookStatus === 'success' 
          ? 'Mensagem enviada. Aguardando resposta via callback.'
          : `Erro ao enviar para webhook: ${webhookError}`,
        session_id: session.id,
        webhook_status: webhookStatus,
        webhook_response_status: webhookResponseStatus,
        webhook_error: webhookError,
        webhook_url_used: session.webhook_url
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Mantemos 200 para não quebrar o frontend, mas indicamos erro no body
      }
    )

  } catch (error: any) {
    console.error('❌ [Lab] Erro geral:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
