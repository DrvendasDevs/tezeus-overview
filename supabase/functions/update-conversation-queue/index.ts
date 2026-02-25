import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email, x-force-queue-history',
};

serve(async (req) => {
  console.log('🔄 [update-conversation-queue] Iniciando requisição');
  console.log('📝 Method:', req.method);
  console.log('🌐 Origin:', req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Retornando headers CORS para OPTIONS');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📦 Body recebido:', JSON.stringify(body, null, 2));
    
    const { 
      conversation_id, 
      queue_id, 
      assigned_user_id,
      activate_queue_agent = true // Por padrão, ativar o agente da fila
    } = body;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔧 [update-conversation-queue] Atualizando conversa ${conversation_id}`);
    console.log(`📋 Queue ID: ${queue_id || 'não especificado'}`);
    console.log(`👤 Assigned User: ${assigned_user_id || 'não especificado'}`);
    console.log(`🤖 Ativar agente da fila? ${activate_queue_agent}`);

    // Buscar estado atual da conversa para registrar histórico
    const { data: currentConversation, error: fetchError } = await supabase
      .from('conversations')
      .select('queue_id, assigned_user_id, agent_active_id, ai_agents:agent_active_id(name)')
      .eq('id', conversation_id)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar conversa atual:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conversa', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const previousQueueId = currentConversation?.queue_id;
    const previousUserId = currentConversation?.assigned_user_id;
    const previousAgentId = currentConversation?.agent_active_id;
    const previousAgentName = (currentConversation?.ai_agents as any)?.[0]?.name || 'Agente Anterior';
    
    console.log(`📋 Estado atual da conversa:`);
    console.log(`   • previousQueueId: ${previousQueueId}`);
    console.log(`   • previousUserId: ${previousUserId}`);
    console.log(`   • novo queue_id: ${queue_id}`);
    console.log(`   • novo assigned_user_id: ${assigned_user_id}`);

    const updateData: any = {};

    // Normalizar queue_id
    let normalizedQueueId = queue_id;
    if (queue_id !== undefined) {
      // Normalizar valores que representam "sem fila"
      if (
        queue_id === null ||
        queue_id === 'none' ||
        queue_id === 'null' ||
        queue_id === ''
      ) {
        normalizedQueueId = null;
      }
      
      updateData.queue_id = normalizedQueueId;

      if (normalizedQueueId) {
        // Buscar detalhes da fila para obter o agente
        if (activate_queue_agent) {
          const { data: queueData, error: queueError } = await supabase
            .from('queues')
            .select('ai_agent_id, name')
            .eq('id', queue_id)
            .single();

          if (queueError) {
            console.error('❌ Erro ao buscar fila:', queueError);
          } else if (queueData) {
            console.log(`✅ Fila encontrada: ${queueData.name}`);
            
            if (queueData.ai_agent_id) {
              updateData.agent_active_id = queueData.ai_agent_id;
              updateData.agente_ativo = true;
              updateData.new_agent_name = queueData.name; // Para usar no histórico
              console.log(`🤖 Ativando agente da fila: ${queueData.ai_agent_id}`);
            } else {
              updateData.agente_ativo = false;
              updateData.agent_active_id = null;
              updateData.should_log_agent_deactivation = true;
              console.log(`⚠️ Fila não tem agente - desativando agente atual`);
            }
          }
        }
      } else {
        // normalizedQueueId é null - remover fila e desativar agente
        updateData.agent_active_id = null;
        updateData.agente_ativo = false;
        updateData.should_log_agent_deactivation = true;
        console.log(`🗑️ Removendo fila e desativando agente`);
      }
    }

    // Normalizar e atualizar assigned_user_id
    let normalizedAssignedUserId = assigned_user_id;
    if (assigned_user_id !== undefined) {
      // Normalizar valores que representam "sem responsável"
      if (
        assigned_user_id === null ||
        assigned_user_id === 'none' ||
        assigned_user_id === 'null' ||
        assigned_user_id === ''
      ) {
        normalizedAssignedUserId = null;
      }
      
      updateData.assigned_user_id = normalizedAssignedUserId;
      if (normalizedAssignedUserId) {
        updateData.assigned_at = new Date().toISOString();
        console.log(`👤 Atribuindo responsável: ${normalizedAssignedUserId}`);
      } else {
        console.log(`🗑️ Removendo responsável`);
      }
    }

    // Executar atualização
    const { data: updatedConversation, error: updateError } = await supabase
      .from('conversations')
      .update(updateData)
      .eq('id', conversation_id)
      .select('id, queue_id, assigned_user_id, agent_active_id, agente_ativo')
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar conversa:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar conversa', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Conversa atualizada com sucesso:', updatedConversation);

    // Obter current_system_user_id do header ou usar null
    const systemUserId = req.headers.get('x-system-user-id') || null;
    const forceQueueHistory = req.headers.get('x-force-queue-history') === 'true';

    // Registrar histórico de transferência de fila se queue_id mudou OU se forçado
    console.log(`🔍 Verificando se deve registrar histórico de fila:`);
    console.log(`   • queue_id !== undefined: ${queue_id !== undefined}`);
    console.log(`   • previousQueueId: ${previousQueueId}`);
    console.log(`   • normalizedQueueId: ${normalizedQueueId}`);
    console.log(`   • previousQueueId !== normalizedQueueId: ${previousQueueId !== normalizedQueueId}`);
    console.log(`   • forceQueueHistory: ${forceQueueHistory}`);
    
    if (queue_id !== undefined && (previousQueueId !== normalizedQueueId || forceQueueHistory)) {
      console.log(`📝 ✅ Registrando transferência de fila: ${previousQueueId} → ${normalizedQueueId}`);
      
      const { error: queueHistoryError } = await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: 'queue_transfer',
          from_queue_id: previousQueueId,
          to_queue_id: normalizedQueueId,
          changed_by: systemUserId,
          changed_at: new Date().toISOString()
        });

      if (queueHistoryError) {
        console.error('⚠️ Erro ao registrar histórico de fila (não-bloqueante):', queueHistoryError);
      } else {
        console.log('✅ Histórico de transferência de fila registrado com sucesso');
      }
    } else {
      console.log(`⏭️ Não registrar histórico de fila (condição não satisfeita)`);
    }

    // Registrar histórico de mudança de responsável se assigned_user_id mudou
    if (assigned_user_id !== undefined && previousUserId !== normalizedAssignedUserId) {
      console.log(`📝 Registrando mudança de responsável: ${previousUserId} → ${normalizedAssignedUserId}`);
      
      let action: 'assign' | 'transfer' | 'unassign';
      if (normalizedAssignedUserId) {
        action = previousUserId ? 'transfer' : 'assign';
      } else {
        action = 'unassign';
      }
      
      const { error: userHistoryError } = await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: action,
          from_assigned_user_id: previousUserId,
          to_assigned_user_id: normalizedAssignedUserId,
          changed_by: systemUserId,
          changed_at: new Date().toISOString()
        });

      if (userHistoryError) {
        console.error('⚠️ Erro ao registrar histórico de responsável (não-bloqueante):', userHistoryError);
      } else {
        console.log('✅ Histórico de mudança de responsável registrado');
      }
    }

    // Registrar no histórico de agente
    // Caso 1: Agente foi ativado (novo agente diferente do anterior)
    if (updateData.agent_active_id && updateData.agent_active_id !== previousAgentId) {
      console.log(`📝 Registrando ativação de agente: ${updateData.agent_active_id}`);
      
      const { error: historyError } = await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversation_id,
          agent_id: updateData.agent_active_id,
          agent_name: updateData.new_agent_name || 'Agente da Fila',
          action: previousAgentId ? 'changed' : 'activated',
          changed_by: normalizedAssignedUserId || systemUserId || null,
          metadata: { 
            queue_id: normalizedQueueId,
            old_agent_id: previousAgentId,
            reason: 'Transferência de negócio com mudança de fila'
          }
        });

      if (historyError) {
        console.error('⚠️ Erro ao registrar histórico de agente (não-bloqueante):', historyError);
      } else {
        console.log('✅ Histórico de ativação de agente registrado');
      }
    }
    
    // Caso 2: Agente foi desativado (tinha agente e agora não tem mais)
    if (updateData.should_log_agent_deactivation && previousAgentId) {
      console.log(`📝 Registrando desativação de agente: ${previousAgentId}`);
      
      const { error: historyError } = await supabase
        .from('conversation_agent_history')
        .insert({
          conversation_id: conversation_id,
          agent_id: null,
          agent_name: previousAgentName,
          action: 'deactivated',
          changed_by: normalizedAssignedUserId || systemUserId || null,
          metadata: { 
            queue_id: normalizedQueueId,
            old_agent_id: previousAgentId,
            reason: normalizedQueueId ? 'Fila sem agente configurado' : 'Remoção de fila'
          }
        });

      if (historyError) {
        console.error('⚠️ Erro ao registrar histórico de desativação de agente (não-bloqueante):', historyError);
      } else {
        console.log('✅ Histórico de desativação de agente registrado');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation: updatedConversation,
        message: 'Conversa atualizada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no update-conversation-queue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
