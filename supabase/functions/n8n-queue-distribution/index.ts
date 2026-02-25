import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { conversation_id, connection_id } = await req.json();
    
    console.log(`🎯 Distribuindo conversa ${conversation_id} para fila`);

    if (!conversation_id || !connection_id) {
      return new Response(JSON.stringify({ 
        error: 'conversation_id e connection_id são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar conversa e verificar se já está atribuída
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, assigned_user_id, queue_id')
      .eq('id', conversation_id)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const previousQueueId = conversation.queue_id; // Salvar para histórico

    // Se já está atribuída, não precisa distribuir
    if (conversation.assigned_user_id) {
      console.log(`⏭️ Conversa ${conversation_id} já atribuída ao usuário ${conversation.assigned_user_id}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Conversa já atribuída',
        assigned_user_id: conversation.assigned_user_id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar queue_id da conexão
    const { data: connection } = await supabase
      .from('connections')
      .select('queue_id')
      .eq('id', connection_id)
      .single();

    if (!connection?.queue_id) {
      console.log(`⚠️ Conexão ${connection_id} não possui fila configurada`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Conexão sem fila configurada'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Conexão vinculada à fila: ${connection.queue_id}`);

    // Buscar fila e suas configurações
    const { data: queue } = await supabase
      .from('queues')
      .select('id, name, distribution_type, last_assigned_user_index, ai_agent_id')
      .eq('id', connection.queue_id)
      .eq('is_active', true)
      .single();

    if (!queue) {
      console.log(`⚠️ Fila ${connection.queue_id} não encontrada ou inativa`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Fila não encontrada ou inativa'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔧 Fila encontrada: ${queue.name}, tipo: ${queue.distribution_type}`);

    // Buscar usuários ativos da fila
    const { data: queueUsers } = await supabase
      .from('queue_users')
      .select(`
        user_id,
        order_position,
        system_users!inner(id, status)
      `)
      .eq('queue_id', queue.id)
      .eq('system_users.status', 'active')
      .order('order_position', { ascending: true });

    if (!queueUsers || queueUsers.length === 0) {
      console.log(`⚠️ Nenhum usuário ativo na fila ${queue.name}`);
      
      // Apenas vincular à fila sem atribuir usuário
      await supabase
        .from('conversations')
        .update({ queue_id: queue.id })
        .eq('id', conversation_id);

      // Registrar mudança de fila se houve
      if (previousQueueId !== queue.id) {
        await supabase
          .from('conversation_assignments')
          .insert({
            conversation_id: conversation_id,
            action: 'queue_transfer',
            from_queue_id: previousQueueId,
            to_queue_id: queue.id,
            changed_by: null,
            changed_at: new Date().toISOString()
          });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Fila sem usuários ativos',
        queue_id: queue.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`👥 ${queueUsers.length} usuários ativos na fila`);

    let selectedUserId = null;
    let newIndex = queue.last_assigned_user_index || 0;

    // Selecionar usuário baseado no tipo de distribuição
    switch (queue.distribution_type) {
      case 'sequencial':
        newIndex = ((queue.last_assigned_user_index || 0) + 1) % queueUsers.length;
        selectedUserId = queueUsers[newIndex].user_id;
        console.log(`🔄 Distribuição sequencial - índice: ${newIndex}, usuário: ${selectedUserId}`);
        
        // Atualizar índice para próxima distribuição
        await supabase
          .from('queues')
          .update({ last_assigned_user_index: newIndex })
          .eq('id', queue.id);
        break;

      case 'aleatoria':
        const randomIndex = Math.floor(Math.random() * queueUsers.length);
        selectedUserId = queueUsers[randomIndex].user_id;
        console.log(`🎲 Distribuição aleatória - índice: ${randomIndex}, usuário: ${selectedUserId}`);
        break;

      case 'ordenada':
        selectedUserId = queueUsers[0].user_id;
        console.log(`📌 Distribuição ordenada - primeiro usuário: ${selectedUserId}`);
        break;

      case 'nao_distribuir':
        console.log(`⏸️ Fila configurada para não distribuir automaticamente`);
        
        // Apenas vincular à fila sem atribuir usuário
        await supabase
          .from('conversations')
          .update({ queue_id: queue.id })
          .eq('id', conversation_id);

        // Registrar mudança de fila se houve
        if (previousQueueId !== queue.id) {
          await supabase
            .from('conversation_assignments')
            .insert({
              conversation_id: conversation_id,
              action: 'queue_transfer',
              from_queue_id: previousQueueId,
              to_queue_id: queue.id,
              changed_by: null,
              changed_at: new Date().toISOString()
            });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Fila configurada para não distribuir',
          queue_id: queue.id
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        console.log(`⚠️ Tipo de distribuição desconhecido: ${queue.distribution_type}`);
    }

    if (selectedUserId) {
      // Atualizar conversa com assigned_user_id e queue_id
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          assigned_user_id: selectedUserId,
          assigned_at: new Date().toISOString(),
          queue_id: queue.id,
          status: 'open',
          agente_ativo: queue.ai_agent_id ? true : false,  // ✅ ATIVAR AGENTE SE EXISTIR
          agent_active_id: queue.ai_agent_id || null  // ✅ SALVAR ID DO AGENTE
        })
        .eq('id', conversation_id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar conversa:`, updateError);
        throw updateError;
      }

      // Registrar atribuição de responsável
      await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          to_assigned_user_id: selectedUserId,
          from_assigned_user_id: conversation.assigned_user_id || null,
          action: 'assign',
          changed_by: selectedUserId
        });

      // Registrar mudança de fila se houve
      if (previousQueueId !== queue.id) {
        await supabase
          .from('conversation_assignments')
          .insert({
            conversation_id: conversation_id,
            action: 'queue_transfer',
            from_queue_id: previousQueueId,
            to_queue_id: queue.id,
            changed_by: null,
            changed_at: new Date().toISOString()
          });
      }

      console.log(`✅ Conversa ${conversation_id} atribuída ao usuário ${selectedUserId} via fila ${queue.name}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Conversa distribuída com sucesso',
        assigned_user_id: selectedUserId,
        queue_id: queue.id,
        queue_name: queue.name
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fallback - apenas vincular à fila
    await supabase
      .from('conversations')
      .update({ queue_id: queue.id })
      .eq('id', conversation_id);

    // Registrar mudança de fila se houve
    if (previousQueueId !== queue.id) {
      await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: 'queue_transfer',
          from_queue_id: previousQueueId,
          to_queue_id: queue.id,
          changed_by: null,
          changed_at: new Date().toISOString()
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Conversa vinculada à fila sem distribuição',
      queue_id: queue.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na distribuição de fila:', error);
    return new Response(JSON.stringify({
      error: 'Erro ao distribuir conversa',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
