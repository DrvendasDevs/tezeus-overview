import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('🚀 accept-conversation started');
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Get user info from headers
    const systemUserId = req.headers.get('x-system-user-id');
    const workspaceId = req.headers.get('x-workspace-id');
    
    if (!systemUserId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'User authentication required'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Workspace ID required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { conversation_id, agent_id } = await req.json();
    
    console.log('📝 Request body:', { conversation_id, agent_id });
    
    if (!conversation_id) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'conversation_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`👤 User ${systemUserId} trying to accept conversation ${conversation_id} in workspace ${workspaceId}`);

    // Verificar se o usuário tem permissão para aceitar conversas neste workspace
    // Masters/support têm acesso a todos os workspaces
    const { data: userProfileData } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .maybeSingle();

    const isMasterOrSupport = userProfileData?.profile === 'master' || userProfileData?.profile === 'support';

    if (!isMasterOrSupport) {
      const { data: workspaceMember, error: memberError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', systemUserId)
        .single();

      if (memberError || !workspaceMember) {
        console.error('❌ User not a member of workspace:', memberError);
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Usuário não tem permissão neste workspace'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Preparar dados de atualização
    const updateData: any = {
      assigned_user_id: systemUserId,
      assigned_at: new Date().toISOString(),
      status: 'open'
    };

    // Se agent_id foi fornecido, incluir nos dados de atualização
    if (agent_id) {
      console.log('✅ Agent ID provided:', agent_id);
      updateData.agent_active_id = agent_id;
      updateData.agente_ativo = true;
    } else {
      console.log('⚠️ No agent ID provided, setting to null');
      updateData.agent_active_id = null;
      updateData.agente_ativo = false;
    }

    console.log('📤 Update data:', updateData);

    // Update atômico com condição para evitar corrida
    const { data: updateResult, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation_id)
      .eq('workspace_id', workspaceId) // Garantir que é do workspace correto
      .is('assigned_user_id', null) // Condição crítica para evitar corrida - usar .is() para NULL
      .select('id, assigned_user_id, status, agent_active_id, agente_ativo');

    if (updateError) {
      console.error('❌ Error updating conversation:', updateError);
      throw updateError;
    }

    // Se nenhuma linha foi afetada, significa que a conversa já foi aceita
    if (!updateResult || updateResult.length === 0) {
      console.log('⚠️ Conversation already assigned');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Esta conversa já foi atribuída a outro usuário'
      }), {
        status: 409, // Conflict
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Registrar na auditoria
    const { error: auditError } = await supabase
      .from('conversation_assignments')
      .insert({
        conversation_id: conversation_id,
        from_assigned_user_id: null,
        to_assigned_user_id: systemUserId,
        changed_by: systemUserId,
        action: 'accept'
      });

    if (auditError) {
      console.error('⚠️ Audit log failed (non-critical):', auditError);
    }

    console.log(`✅ Conversation ${conversation_id} successfully accepted by user ${systemUserId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Conversa aceita com sucesso',
      conversation: updateResult[0]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in accept-conversation:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message || 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});