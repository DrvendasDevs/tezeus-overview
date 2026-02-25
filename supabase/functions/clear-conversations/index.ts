import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get workspace ID from headers
    const workspaceId = req.headers.get('x-workspace-id')
    console.log('🧹 Iniciando limpeza de conversas...', { workspaceId })

    if (!workspaceId) {
      console.log('⚠️ Nenhum workspace específico fornecido, limpando todas as conversas')
    }

    // Try using the SQL function first
    try {
      const { error: rpcError } = await supabaseClient.rpc('clear_all_conversations')
      
      if (rpcError) {
        console.error('❌ Erro na função SQL, tentando método alternativo:', rpcError)
        throw rpcError
      }
      
      console.log('✅ Limpeza realizada via função SQL')
    } catch (sqlError) {
      console.log('🔄 Tentando limpeza direta via client...')
      
      // Fallback: direct cleanup using Supabase client
      const { error: deleteMessagesError } = await supabaseClient
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (deleteMessagesError) {
        console.error('❌ Erro ao deletar mensagens:', deleteMessagesError)
        throw deleteMessagesError
      }

      const { error: deleteConversationsError } = await supabaseClient
        .from('conversations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (deleteConversationsError) {
        console.error('❌ Erro ao deletar conversas:', deleteConversationsError)
        throw deleteConversationsError
      }
      
      console.log('✅ Limpeza realizada via client direto')
    }

    // Limpar também o histórico de chat do N8N
    try {
      const { error: deleteN8nHistoryError } = await supabaseClient
        .from('n8n_chat_histories')
        .delete()
        .neq('id', 0) // Delete all (id é int, não uuid)

      if (deleteN8nHistoryError) {
        console.warn('⚠️ Erro ao limpar n8n_chat_histories:', deleteN8nHistoryError)
        // Não interromper o fluxo, apenas logar o aviso
      } else {
        console.log('✅ Histórico de chat N8N limpo')
      }
    } catch (n8nError) {
      console.warn('⚠️ Erro ao limpar n8n_chat_histories:', n8nError)
      // Não interromper o fluxo
    }

    console.log('🎉 Todas as conversas foram limpas com sucesso')

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Todas as conversas foram removidas com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Erro na função clear-conversations:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})