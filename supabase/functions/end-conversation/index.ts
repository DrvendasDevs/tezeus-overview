import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user and workspace info from headers
    const systemUserId = req.headers.get('x-system-user-id')
    const workspaceId = req.headers.get('x-workspace-id')

    if (!systemUserId) {
      console.log('❌ Missing system user ID')
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!workspaceId) {
      console.log('❌ Missing workspace ID')
      return new Response(
        JSON.stringify({ success: false, error: 'Workspace não especificado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { conversation_id } = await req.json()

    if (!conversation_id) {
      console.log('❌ Missing conversation_id')
      return new Response(
        JSON.stringify({ success: false, error: 'ID da conversa é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Ending conversation ${conversation_id} by user ${systemUserId}`)

    // Verify user is member of workspace (masters/support bypass)
    const { data: userProfileData } = await supabaseClient
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .maybeSingle()

    const isMasterOrSupport = userProfileData?.profile === 'master' || userProfileData?.profile === 'support'

    if (!isMasterOrSupport) {
      const { data: membership, error: membershipError } = await supabaseClient
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', systemUserId)
        .single()

      if (membershipError || !membership) {
        console.log('❌ User not member of workspace:', membershipError)
        return new Response(
          JSON.stringify({ success: false, error: 'Usuário não é membro do workspace' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Buscar conversa atual para registrar histórico e preservar queue/responsável antes da alteração
    const { data: currentConversation, error: fetchError } = await supabaseClient
      .from('conversations')
      .select('assigned_user_id, queue_id, status')
      .eq('id', conversation_id)
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError || !currentConversation) {
      console.log('❌ Error fetching conversation:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar conversa removendo responsável e fila, mantendo status
    const completionTimestamp = new Date().toISOString()

    const { data: updatedConversation, error: updateError } = await supabaseClient
      .from('conversations')
      .update({ 
        assigned_user_id: null,
        assigned_at: null,
        queue_id: null,
        agente_ativo: false,
        agent_active_id: null,
        status: 'closed',
        updated_at: completionTimestamp
      })
      .eq('id', conversation_id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single()

    if (updateError || !updatedConversation) {
      console.log('❌ Error updating conversation:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao desvincular responsável' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Registrar no histórico a remoção do responsável
    if (currentConversation.assigned_user_id) {
      await supabaseClient
        .from('conversation_assignments')
        .insert({
          conversation_id,
          action: currentConversation.status === 'closed' ? 'unassign_closed' : 'unassign',
          from_assigned_user_id: currentConversation.assigned_user_id,
          to_assigned_user_id: null,
          changed_by: systemUserId
        })
    }

    // Registrar histórico de remoção de fila caso existisse
    if (currentConversation.queue_id) {
      await supabaseClient
        .from('conversation_assignments')
        .insert({
          conversation_id,
          action: 'queue_transfer',
          from_queue_id: currentConversation.queue_id,
          to_queue_id: null,
          changed_by: systemUserId,
          changed_at: completionTimestamp
        })
    }

    // Remover cards de pipeline vinculados à conversa
    const { error: deleteCardError } = await supabaseClient
      .from('pipeline_cards')
      .delete()
      .eq('conversation_id', conversation_id)
      .eq('workspace_id', workspaceId)

    if (deleteCardError) {
      console.error('❌ Error deleting related pipeline cards:', deleteCardError)
    }

    console.log(`✅ Conversation ${conversation_id} unassigned successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversation: updatedConversation,
        message: 'Responsável desvinculado com sucesso'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Error in end-conversation:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Erro interno do servidor'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})