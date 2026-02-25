import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LabCallbackRequest {
  session_id: string
  action_type: string  // 'agent-response' para mensagem do agente, outros para ações
  params?: Record<string, any>
  status?: 'pending' | 'success' | 'error'  // Opcional para agent-response
  error_message?: string | null
  message?: string  // Mensagem do agente (quando action_type = 'agent-response')
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 [Lab Callback] Recebendo callback de ação')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { 
      session_id, 
      action_type, 
      params = {}, 
      status, 
      error_message = null,
      message = null
    } = body as LabCallbackRequest

    console.log('📋 [Lab Callback] Dados recebidos:', {
      session_id,
      action_type,
      status,
      message: message ? message.substring(0, 50) + '...' : null,
      params: JSON.stringify(params).substring(0, 100)
    })

    // Validar campos obrigatórios
    if (!session_id) {
      console.error('❌ [Lab Callback] session_id não fornecido')
      return new Response(
        JSON.stringify({ success: false, error: 'session_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!action_type) {
      console.error('❌ [Lab Callback] action_type não fornecido')
      return new Response(
        JSON.stringify({ success: false, error: 'action_type é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Para agent-response, status não é obrigatório
    const isAgentResponse = action_type === 'agent-response'
    
    if (!isAgentResponse && (!status || !['pending', 'success', 'error'].includes(status))) {
      console.error('❌ [Lab Callback] status inválido:', status)
      return new Response(
        JSON.stringify({ success: false, error: 'status deve ser pending, success ou error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Para agent-response, message é obrigatório
    if (isAgentResponse && !message) {
      console.error('❌ [Lab Callback] message não fornecido para agent-response')
      return new Response(
        JSON.stringify({ success: false, error: 'message é obrigatório para agent-response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verificar se a sessão existe e está ativa
    console.log('🔍 [Lab Callback] Buscando sessão com ID:', session_id)
    console.log('🔍 [Lab Callback] Tamanho do ID:', session_id.length, 'caracteres')
    
    const { data: session, error: sessionError } = await supabase
      .from('lab_sessions')
      .select('id, is_active')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      // Sessão não encontrada - mas não vamos retornar erro!
      // Isso pode acontecer se a sessão foi encerrada ou se não é uma chamada do Lab
      // Retornamos sucesso para não quebrar o fluxo do N8N
      console.warn('⚠️ [Lab Callback] Sessão não encontrada:', session_id)
      console.warn('⚠️ [Lab Callback] Isso é normal se não for uma chamada do Laboratório')
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Callback ignorado - sessão não encontrada (provavelmente não é do Lab)',
          session_id: session_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!session.is_active) {
      console.warn('⚠️ [Lab Callback] Sessão não está ativa, mas salvando mesmo assim')
    }

    // Se for resposta do agente, salvar como mensagem
    if (isAgentResponse) {
      console.log('💬 [Lab Callback] Salvando resposta do agente...')
      
      const { data: agentMessage, error: messageError } = await supabase
        .from('lab_messages')
        .insert({
          session_id: session_id,
          sender_type: 'agent',
          content: message
        })
        .select()
        .single()

      if (messageError) {
        console.error('❌ [Lab Callback] Erro ao salvar mensagem do agente:', messageError)
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao salvar mensagem: ' + messageError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      console.log('✅ [Lab Callback] Mensagem do agente salva:', agentMessage.id)

      return new Response(
        JSON.stringify({
          success: true,
          message_id: agentMessage.id,
          message: 'Mensagem do agente registrada com sucesso'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Caso contrário, salvar como ação
    const { data: actionLog, error: insertError } = await supabase
      .from('lab_action_logs')
      .insert({
        session_id: session_id,
        action_type: action_type,
        action_params: params,
        status: status || 'success',
        error_message: error_message,
        executed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ [Lab Callback] Erro ao salvar ação:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao salvar ação: ' + insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('✅ [Lab Callback] Ação salva com sucesso:', actionLog.id)

    return new Response(
      JSON.stringify({
        success: true,
        action_id: actionLog.id,
        message: 'Ação registrada com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ [Lab Callback] Erro geral:', error)
    
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
