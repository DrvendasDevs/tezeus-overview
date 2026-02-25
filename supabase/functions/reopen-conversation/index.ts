import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { conversation_id, workspace_id } = await req.json()

    if (!conversation_id || !workspace_id) {
      console.log('❌ Missing required parameters')
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros obrigatórios não fornecidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Checking if conversation ${conversation_id} needs to be reopened`)

    // Check if conversation exists and is closed
    const { data: conversation, error: convError } = await supabaseClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (convError || !conversation) {
      console.log('❌ Conversation not found:', convError)
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If conversation is already open, no action needed
    if (conversation.status !== 'closed') {
      console.log(`✅ Conversation ${conversation_id} is already open`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          conversation,
          message: 'Conversa já está aberta'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Reopen the conversation
    const { data: updatedConversation, error: updateError } = await supabaseClient
      .from('conversations')
      .update({ 
        status: 'open',
        updated_at: new Date().toISOString(),
        // Keep assigned_user_id to maintain history of who was handling it
        // assigned_user_id remains the same for continuity
      })
      .eq('id', conversation_id)
      .eq('workspace_id', workspace_id)
      .select('*')
      .single()

    if (updateError || !updatedConversation) {
      console.log('❌ Error reopening conversation:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao reabrir conversa' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Conversation ${conversation_id} reopened successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation: updatedConversation,
        message: 'Conversa reaberta automaticamente'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Error in reopen-conversation:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
