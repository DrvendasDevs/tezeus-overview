import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract headers
    const systemUserId = req.headers.get('x-system-user-id');
    const systemUserEmail = req.headers.get('x-system-user-email');
    const workspaceId = req.headers.get('x-workspace-id');

    console.log('📥 Assign conversation request:', {
      systemUserId,
      systemUserEmail,
      workspaceId
    });

    if (!systemUserId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Missing user or workspace context' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set user context
    await supabase.rpc('set_current_user_context', {
      user_id: systemUserId,
      user_email: systemUserEmail
    });

    const { conversation_id, target_user_id } = await req.json();

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedTargetUserId =
      typeof target_user_id === 'string'
        ? target_user_id.trim()
        : target_user_id;

    const targetUserId =
      normalizedTargetUserId === null ||
      normalizedTargetUserId === undefined ||
      normalizedTargetUserId === '' ||
      normalizedTargetUserId === 'none' ||
      normalizedTargetUserId === 'null'
        ? null
        : (normalizedTargetUserId as string);

    console.log('🔄 Assigning conversation:', {
      conversation_id,
      target_user_id,
      changed_by: systemUserId
    });

    // Verify current user is workspace member (masters/support bypass)
    const { data: userProfileData } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .maybeSingle();

    const isMasterOrSupport = userProfileData?.profile === 'master' || userProfileData?.profile === 'support';

    if (!isMasterOrSupport) {
      const { data: currentUserMember, error: currentUserError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', systemUserId)
        .single();

      if (currentUserError || !currentUserMember) {
        console.error('❌ Current user not a workspace member:', currentUserError);
        return new Response(
          JSON.stringify({ error: 'Você não tem permissão para atribuir conversas neste workspace' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (targetUserId) {
      // Verify target user is workspace member (masters/support podem atribuir a qualquer um)
      const { data: targetProfile } = await supabase
        .from('system_users')
        .select('profile')
        .eq('id', targetUserId)
        .maybeSingle();

      const isTargetMasterOrSupport = targetProfile?.profile === 'master' || targetProfile?.profile === 'support';

      if (!isTargetMasterOrSupport) {
        const { data: targetUserMember, error: targetUserError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', targetUserId)
          .single();

        if (targetUserError || !targetUserMember) {
          console.error('❌ Target user not a workspace member:', targetUserError);
          return new Response(
            JSON.stringify({ error: 'Usuário selecionado não é membro deste workspace' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Get current conversation state
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, assigned_user_id, workspace_id, contact_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('❌ Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.workspace_id !== workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Conversa não pertence a este workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousAssignedUserId = conversation.assigned_user_id;

    // Update conversation
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        assigned_user_id: targetUserId || null,
        assigned_at: targetUserId ? new Date().toISOString() : null,
        status: 'open'
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('❌ Error updating conversation:', updateError);
      throw updateError;
    }

    console.log('✅ Conversation updated:', {
      conversation_id,
      from: previousAssignedUserId,
      to: targetUserId
    });

    // Log assignment action
    let action: 'assign' | 'transfer' | 'unassign';
    if (targetUserId) {
      action = previousAssignedUserId ? 'transfer' : 'assign';
    } else {
      action = 'unassign';
    }
    const { error: assignmentError } = await supabase
      .from('conversation_assignments')
      .insert({
        conversation_id,
        from_assigned_user_id: previousAssignedUserId,
        to_assigned_user_id: targetUserId || null,
        changed_by: systemUserId,
        action
      });

    if (assignmentError) {
      console.error('⚠️ Error logging assignment:', assignmentError);
    }

    // Update pipeline card if exists
    const { data: pipelineCards } = await supabase
      .from('pipeline_cards')
      .select('id')
      .eq('conversation_id', conversation_id);

    if (pipelineCards && pipelineCards.length > 0) {
      for (const card of pipelineCards) {
        await supabase
          .from('pipeline_cards')
          .update({ responsible_user_id: targetUserId || null })
          .eq('id', card.id);
        
        console.log('✅ Pipeline card updated:', card.id);
      }
    }

    // Get updated conversation
    const { data: updatedConversation } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        conversation: updatedConversation,
        action
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in assign-conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao atribuir conversa';
    return new Response(
      JSON.stringify({
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
