import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LabClearHistoryRequest {
  session_id: string
  delete_test_records?: boolean  // Se true, deleta também contato, conversa e card
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { session_id, delete_test_records }: LabClearHistoryRequest = await req.json()

    console.log('🗑️ [Lab] Limpando histórico da sessão:', session_id)
    console.log('🗑️ [Lab] Deletar registros de teste:', delete_test_records)

    // Buscar sessão para obter IDs dos registros de teste
    const { data: session, error: sessionError } = await supabase
      .from('lab_sessions')
      .select('*')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error('❌ [Lab] Sessão não encontrada:', sessionError)
      throw new Error('Sessão não encontrada')
    }

    // 0. Deletar histórico do N8N (n8n_chat_histories)
    // A coluna session_id nessa tabela armazena o ID da conversa
    const n8nSessionId = session.conversation_id || session_id
    if (n8nSessionId) {
      const { error: n8nHistoryError } = await supabase
        .from('n8n_chat_histories')
        .delete()
        .eq('session_id', n8nSessionId)

      if (n8nHistoryError) {
        console.error('❌ [Lab] Erro ao deletar n8n_chat_histories:', n8nHistoryError)
      } else {
        console.log('✅ [Lab] n8n_chat_histories deletado para session_id:', n8nSessionId)
      }
    } else {
      console.warn('⚠️ [Lab] Sem conversation_id para limpar n8n_chat_histories')
    }

    // 1. Deletar logs de ações
    const { error: actionsError } = await supabase
      .from('lab_action_logs')
      .delete()
      .eq('session_id', session_id)

    if (actionsError) {
      console.error('❌ [Lab] Erro ao deletar ações:', actionsError)
    } else {
      console.log('✅ [Lab] Ações deletadas')
    }

    // 2. Deletar mensagens do laboratório
    const { error: messagesError } = await supabase
      .from('lab_messages')
      .delete()
      .eq('session_id', session_id)

    if (messagesError) {
      console.error('❌ [Lab] Erro ao deletar mensagens:', messagesError)
    } else {
      console.log('✅ [Lab] Mensagens deletadas')
    }

    // 3. Se delete_test_records = true, deletar os registros de teste
    if (delete_test_records) {
      console.log('🗑️ [Lab] Deletando registros de teste...')

      // 3.1 Deletar card de teste
      if (session.card_id) {
        console.log('🗑️ [Lab] Deletando card:', session.card_id)
        
        // Primeiro deletar produtos associados ao card
        const { error: prodError } = await supabase
          .from('pipeline_cards_products')
          .delete()
          .eq('card_id', session.card_id)
        
        if (prodError) {
          console.log('⚠️ [Lab] Erro ao deletar produtos do card (pode não existir):', prodError.message)
        }
        
        // Depois deletar o card (SEM filtro is_lab_test pois pode não existir a coluna)
        const { error: cardError } = await supabase
          .from('pipeline_cards')
          .delete()
          .eq('id', session.card_id)

        if (cardError) {
          console.error('❌ [Lab] Erro ao deletar card:', cardError)
        } else {
          console.log('✅ [Lab] Card deletado:', session.card_id)
        }
      }

      // 3.2 Deletar conversa de teste
      if (session.conversation_id) {
        console.log('🗑️ [Lab] Deletando conversa:', session.conversation_id)
        
        // Deletar mensagens reais (se houver)
        const { error: msgError } = await supabase
          .from('messages')
          .delete()
          .eq('conversation_id', session.conversation_id)

        if (msgError) {
          console.log('⚠️ [Lab] Erro ao deletar mensagens:', msgError.message)
        }

        // Deletar tags da conversa
        const { error: convTagError } = await supabase
          .from('conversation_tags')
          .delete()
          .eq('conversation_id', session.conversation_id)

        if (convTagError) {
          console.log('⚠️ [Lab] Erro ao deletar tags da conversa:', convTagError.message)
        }

        // Deletar histórico de agentes da conversa
        const { error: agentHistError } = await supabase
          .from('conversation_agent_history')
          .delete()
          .eq('conversation_id', session.conversation_id)

        if (agentHistError) {
          console.log('⚠️ [Lab] Erro ao deletar histórico de agentes:', agentHistError.message)
        }

        // Depois deletar a conversa (SEM filtro is_lab_test)
        const { error: convError } = await supabase
          .from('conversations')
          .delete()
          .eq('id', session.conversation_id)

        if (convError) {
          console.error('❌ [Lab] Erro ao deletar conversa:', convError)
        } else {
          console.log('✅ [Lab] Conversa deletada:', session.conversation_id)
        }
      }

      // 3.3 Deletar contato de teste
      if (session.contact_id) {
        console.log('🗑️ [Lab] Deletando contato:', session.contact_id)
        
        // Primeiro deletar tags do contato
        const { error: contactTagError } = await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', session.contact_id)

        if (contactTagError) {
          console.log('⚠️ [Lab] Erro ao deletar tags do contato:', contactTagError.message)
        }

        // Depois deletar o contato (SEM filtro is_lab_test)
        const { error: contactError } = await supabase
          .from('contacts')
          .delete()
          .eq('id', session.contact_id)

        if (contactError) {
          console.error('❌ [Lab] Erro ao deletar contato:', contactError)
        } else {
          console.log('✅ [Lab] Contato deletado:', session.contact_id)
        }
      }

      // 3.4 Deletar a sessão completamente
      const { error: sessionDeleteError } = await supabase
        .from('lab_sessions')
        .delete()
        .eq('id', session_id)

      if (sessionDeleteError) {
        console.error('❌ [Lab] Erro ao deletar sessão:', sessionDeleteError)
      } else {
        console.log('✅ [Lab] Sessão deletada com sucesso')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: delete_test_records 
          ? 'Sessão deletada e registros de teste removidos'
          : 'Histórico limpo com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ [Lab] Erro ao limpar histórico:', error)
    
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
