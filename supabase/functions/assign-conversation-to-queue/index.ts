import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id, x-force-queue-history',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversation_id, queue_id } = await req.json();

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

    console.log(`🎯 [assign-conversation-to-queue] Starting assignment for conversation: ${conversation_id}, queue_id: ${queue_id || 'auto-detect'}`);

    // 1️⃣ Buscar informações da conversa INCLUINDO queue_id atual
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, workspace_id, connection_id, contact_id, assigned_user_id, queue_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('❌ Conversa não encontrada:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2️⃣ Determinar qual fila usar
    let targetQueueId = queue_id;

    if (!targetQueueId && conversation.connection_id) {
      // Buscar queue_id da conexão
      const { data: connection } = await supabase
        .from('connections')
        .select('queue_id')
        .eq('id', conversation.connection_id)
        .single();

      targetQueueId = connection?.queue_id;
      console.log(`📍 Queue ID from connection: ${targetQueueId}`);
    }

    if (!targetQueueId) {
      console.log('⚠️ Nenhuma fila configurada para esta conversa');
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'no_queue',
          message: 'Nenhuma fila configurada para esta conexão',
          conversation_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3️⃣ Buscar configurações da fila
    const { data: queue, error: queueError } = await supabase
      .from('queues')
      .select('id, name, distribution_type, last_assigned_user_index, workspace_id, ai_agent_id, description')
      .eq('id', targetQueueId)
      .eq('is_active', true)
      .single();

    if (queueError || !queue) {
      console.error('❌ Fila não encontrada ou inativa:', queueError);
      return new Response(
        JSON.stringify({ error: 'Fila não encontrada ou inativa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Fila encontrada: ${queue.name} (tipo: ${queue.distribution_type})`);

    // 4️⃣ Buscar usuários da fila (ordenados por order_position)
    const { data: queueUsers, error: usersError } = await supabase
      .from('queue_users')
      .select(`
        user_id,
        order_position,
        system_users!inner (
          id,
          name,
          email,
          status
        )
      `)
      .eq('queue_id', targetQueueId)
      .eq('system_users.status', 'active')
      .order('order_position', { ascending: true });

    // Para filas configuradas como "nao_distribuir", permitimos zero usuários ativos:
    // elas servem apenas para vincular a conversa à fila e (opcionalmente) ativar um agente de IA.
    if (queue.distribution_type !== 'nao_distribuir') {
      if (usersError || !queueUsers || queueUsers.length === 0) {
        console.error('❌ Nenhum usuário ativo encontrado na fila:', usersError);
        return new Response(
          JSON.stringify({ error: 'Nenhum usuário ativo na fila' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`👥 ${queueUsers.length} usuários ativos encontrados na fila`);
    } else {
      console.log('ℹ️ Fila com distribuição "nao_distribuir": permitindo zero usuários ativos');
    }

    // 5️⃣ Selecionar usuário baseado no tipo de distribuição
    let selectedUserId: string;
    let selectionReason: string;

    switch (queue.distribution_type) {
      case 'sequencial':
        // Distribuição sequencial (round-robin)
        const currentIndex = queue.last_assigned_user_index || 0;
        const nextIndex = (currentIndex + 1) % (queueUsers?.length || 1);
        selectedUserId = queueUsers?.[nextIndex]?.user_id || '';
        selectionReason = `Sequencial (índice ${nextIndex + 1}/${queueUsers?.length || 0})`;
        
        // Atualizar índice para próxima distribuição
        await supabase
          .from('queues')
          .update({ last_assigned_user_index: nextIndex })
          .eq('id', targetQueueId);
        
        console.log(`🔄 Distribuição sequencial: usuário ${nextIndex + 1} de ${queueUsers?.length || 0}`);
        break;

      case 'aleatoria':
        // Distribuição aleatória
        const randomIndex = Math.floor(Math.random() * (queueUsers?.length || 1));
        selectedUserId = queueUsers?.[randomIndex]?.user_id || '';
        selectionReason = `Aleatória (usuário ${randomIndex + 1}/${queueUsers?.length || 0})`;
        console.log(`🎲 Distribuição aleatória: usuário ${randomIndex + 1} de ${queueUsers?.length || 0}`);
        break;

      case 'ordenada':
        // Sempre o primeiro da ordem
        selectedUserId = queueUsers?.[0]?.user_id || '';
        selectionReason = 'Ordenada (sempre o primeiro)';
        console.log(`📋 Distribuição ordenada: sempre primeiro usuário`);
        break;

      case 'nao_distribuir':
        // Não distribuir, mas vincular à fila e ativar agente se configurado
        console.log(`⏸️ Fila configurada para não distribuir automaticamente`);
        console.log(`📋 Queue AI Agent ID: ${queue.ai_agent_id}`);
        console.log(`🤖 Agente será ativado? ${queue.ai_agent_id ? 'SIM' : 'NÃO'}`);
        
        // Buscar queue_id atual antes de atualizar
        const previousQueueIdNoDist = conversation.queue_id;
        
        // Atualizar conversa apenas com queue_id e agente se houver
        const { error: updateNoDistError } = await supabase
          .from('conversations')
          .update({
            queue_id: targetQueueId,
            agente_ativo: queue.ai_agent_id ? true : false,  // ✅ ATIVAR AGENTE SE EXISTIR
            agent_active_id: queue.ai_agent_id || null  // ✅ SALVAR ID DO AGENTE
          })
          .eq('id', conversation_id);

        if (updateNoDistError) {
          console.error('❌ Erro ao vincular conversa à fila:', updateNoDistError);
          return new Response(
            JSON.stringify({ error: 'Erro ao vincular conversa à fila' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`✅ Conversa vinculada à fila ${queue.name}${queue.ai_agent_id ? ' com agente ativado' : ''}`);
        console.log(`✅ agente_ativo definido como: ${queue.ai_agent_id ? true : false}`);

        // Registrar mudança de fila no histórico
        if (previousQueueIdNoDist !== targetQueueId) {
          console.log(`📝 Registrando mudança de fila: ${previousQueueIdNoDist} → ${targetQueueId}`);
          
          const { error: queueHistoryError } = await supabase
            .from('conversation_assignments')
            .insert({
              conversation_id: conversation_id,
              action: 'queue_transfer',
              from_queue_id: previousQueueIdNoDist,
              to_queue_id: targetQueueId,
              changed_by: null, // Sistema atribuindo automaticamente
              changed_at: new Date().toISOString()
            });

          if (queueHistoryError) {
            console.error('⚠️ Erro ao registrar histórico de fila (não-bloqueante):', queueHistoryError);
          } else {
            console.log('✅ Histórico de mudança de fila registrado');
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            action: 'no_distribution',
            message: `Conversa vinculada à fila${queue.ai_agent_id ? ' com agente ativo' : ''}`,
            queue_name: queue.name,
            queue_id: targetQueueId,
            conversation_id,
            agent_activated: queue.ai_agent_id ? true : false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        // Fallback: primeiro usuário
        selectedUserId = queueUsers?.[0]?.user_id || '';
        selectionReason = 'Padrão (primeiro da lista)';
        console.log(`⚠️ Tipo de distribuição desconhecido, usando primeiro usuário`);
    }

    // 6️⃣ Atualizar conversa com usuário atribuído e queue_id
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        assigned_user_id: selectedUserId,
        assigned_at: new Date().toISOString(),
        queue_id: targetQueueId,
        agente_ativo: queue.ai_agent_id ? true : false,  // ✅ ATIVAR AGENTE SE EXISTIR
        agent_active_id: queue.ai_agent_id || null  // ✅ SALVAR ID DO AGENTE
      })
      .eq('id', conversation_id);

    if (updateError) {
      console.error('❌ Erro ao atualizar conversa:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atribuir usuário à conversa' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7️⃣ Registrar atribuição de responsável no histórico
    const { error: assignmentError } = await supabase
      .from('conversation_assignments')
      .insert({
        conversation_id: conversation_id,
        to_assigned_user_id: selectedUserId,
        from_assigned_user_id: conversation.assigned_user_id || null,
        changed_by: selectedUserId, // Sistema atribuindo automaticamente
        action: conversation.assigned_user_id ? 'transfer' : 'assign'
      });

    if (assignmentError) {
      console.error('⚠️ Erro ao registrar histórico de atribuição (não-bloqueante):', assignmentError);
    }

    // 7b️⃣ Registrar mudança de fila no histórico (se houve mudança)
    const previousQueueId = conversation.queue_id;
    if (previousQueueId !== targetQueueId) {
      console.log(`📝 Registrando mudança de fila: ${previousQueueId} → ${targetQueueId}`);
      
      const { error: queueHistoryError } = await supabase
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation_id,
          action: 'queue_transfer',
          from_queue_id: previousQueueId,
          to_queue_id: targetQueueId,
          changed_by: selectedUserId,
          changed_at: new Date().toISOString()
        });

      if (queueHistoryError) {
        console.error('⚠️ Erro ao registrar histórico de fila (não-bloqueante):', queueHistoryError);
      } else {
        console.log('✅ Histórico de mudança de fila registrado');
      }
    }

    // 8️⃣ Atualizar pipeline_cards se existir
    const { data: pipelineCards } = await supabase
      .from('pipeline_cards')
      .select('id')
      .eq('conversation_id', conversation_id);

    if (pipelineCards && pipelineCards.length > 0) {
      await supabase
        .from('pipeline_cards')
        .update({ responsible_user_id: selectedUserId })
        .eq('conversation_id', conversation_id);
      
      console.log(`🎯 ${pipelineCards.length} pipeline card(s) atualizado(s) com responsável`);
    }

    // 9️⃣ Enviar mensagem de saudação se configurada
    if (queue.description && queue.description.trim()) {
      console.log(`💬 Enviando mensagem de saudação da fila: "${queue.description}"`);
      
      try {
        const { error: sendError } = await supabase.functions.invoke('test-send-msg', {
          body: {
            conversation_id: conversation_id,
            content: queue.description,
            message_type: 'text'
          }
        });

        if (sendError) {
          console.error('⚠️ Erro ao enviar mensagem de saudação (não-bloqueante):', sendError);
        } else {
          console.log('✅ Mensagem de saudação enviada com sucesso');
        }
      } catch (greetingError) {
        console.error('⚠️ Exceção ao enviar mensagem de saudação (não-bloqueante):', greetingError);
      }
    }

    console.log(`✅ Conversa ${conversation_id} atribuída para usuário ${selectedUserId} via fila ${queue.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'assigned',
        conversation_id,
        assigned_user_id: selectedUserId,
        queue_id: targetQueueId,
        queue_name: queue.name,
        distribution_type: queue.distribution_type,
        selection_reason: selectionReason,
        pipeline_cards_updated: pipelineCards?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [assign-conversation-to-queue] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
