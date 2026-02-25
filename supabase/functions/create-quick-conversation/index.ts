import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phoneNumber, connectionId } = await req.json()

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get workspace_id from headers
    const workspaceId = req.headers.get('x-workspace-id')
    
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Normalize phone number to digits only (consistent with webhooks)
    const normalizedPhone = phoneNumber.replace(/\D/g, '')

    console.log(`Creating quick conversation for phone: ${normalizedPhone}`)
    
    // PROTEÇÃO: Bloquear uso de números da instância como contato
    const { data: connections } = await supabase
      .from('connections')
      .select('phone_number, instance_name')
      .eq('workspace_id', workspaceId)
    
    const isInstanceNumber = connections?.some(conn => {
      const connPhone = conn.phone_number?.replace(/\D/g, '')
      return connPhone && normalizedPhone === connPhone
    })
    
    if (isInstanceNumber) {
      console.error(`❌ BLOQUEADO: Tentativa de criar conversa com número da instância: ${normalizedPhone}`)
      return new Response(
        JSON.stringify({ 
          error: 'Este número pertence a uma instância WhatsApp e não pode ser usado como contato.',
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if contact already exists
    let { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', normalizedPhone)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    let contactId = existingContact?.id

    // Create temporary contact if doesn't exist
    if (!contactId) {
      console.log(`🏗️ CRIANDO NOVO CONTATO (create-quick-conversation):`, {
        phone: normalizedPhone,
        name: `+${normalizedPhone}`,
        workspace_id: workspaceId,
        source: 'create-quick-conversation'
      })
      
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          name: normalizedPhone, // SEM PREFIXO - apenas o número
          phone: normalizedPhone,
          workspace_id: workspaceId,
          extra_info: { temporary: true }
        })
        .select('id')
        .single()

      if (contactError) {
        console.error('Error creating contact:', contactError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar contato temporário' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      contactId = newContact.id
      console.log(`Created temporary contact with ID: ${contactId}`)

      // 🖼️ Try to fetch profile image for new contact
      try {
        console.log(`🖼️ Attempting to fetch profile image for new contact: ${normalizedPhone}`);
        
        const { error: profileError } = await supabase.functions.invoke('fetch-contact-profile-image', {
          body: {
            phone: normalizedPhone,
            contactId: contactId,
            workspaceId: workspaceId
          }
        });

        if (profileError) {
          console.error(`⚠️ Failed to fetch profile image (non-blocking):`, profileError);
        } else {
          console.log(`✅ Profile image fetch requested for ${normalizedPhone}`);
        }
      } catch (profileFetchError) {
        console.error(`⚠️ Error requesting profile image (non-blocking):`, profileFetchError);
      }
    } else {
      console.log(`Using existing contact with ID: ${contactId}`)
    }

    // Buscar conexão alvo (selecionada ou padrão)
    let targetConnection: any = null;

    if (connectionId) {
      const { data: selectedConnection, error: selectedConnError } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status, default_pipeline_id, queue_id')
        .eq('workspace_id', workspaceId)
        .eq('id', connectionId)
        .maybeSingle();

      if (selectedConnError) {
        console.error('❌ Erro ao buscar conexão selecionada:', selectedConnError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar conexão selecionada', success: false }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!selectedConnection) {
        return new Response(
          JSON.stringify({ error: 'Conexão não encontrada', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (String(selectedConnection.status || '').toLowerCase() !== 'connected') {
        return new Response(
          JSON.stringify({ error: 'Conexão selecionada não está conectada', success: false }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetConnection = selectedConnection;
    } else {
      // Buscar conexão padrão ativa
      const { data: defaultConnection } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status, default_pipeline_id, queue_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected')
        .eq('is_default', true)
        .maybeSingle();

      targetConnection = defaultConnection;

      // Fallback: se não houver padrão, pegar a primeira conectada
      if (!targetConnection) {
        const { data: firstConnected } = await supabase
          .from('connections')
          .select('id, instance_name, phone_number, status, default_pipeline_id, queue_id')
          .eq('workspace_id', workspaceId)
          .eq('status', 'connected')
          .order('instance_name', { ascending: true })
          .limit(1)
          .maybeSingle();

        targetConnection = firstConnected;
      }
    }

    const targetConnectionId = targetConnection?.id || null;

    // Buscar conversas existentes do contato no workspace
    let existingConvQuery = supabase
      .from('conversations')
      .select('id, status, connection_id')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    // Se temos conexão alvo, buscar/reutilizar APENAS conversas daquela conexão
    if (targetConnectionId) {
      existingConvQuery = existingConvQuery.eq('connection_id', targetConnectionId);
    }

    const { data: existingConversations, error: existingConvError } = await existingConvQuery;

    if (existingConvError) {
      console.error('❌ Erro ao buscar conversas existentes:', existingConvError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar conversas existentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let conversationId: string | undefined;
    const conversationToReuse = existingConversations?.[0];
    let createdNewConversation = false;

    if (conversationToReuse) {
      conversationId = conversationToReuse.id;

      // Reabrir conversa caso esteja fechada e garantir que está vinculada à conexão alvo
      const updates: Record<string, any> = {
        status: 'open',
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      };

      if (targetConnection?.id) {
        updates.connection_id = targetConnection.id;
        updates.evolution_instance = targetConnection.instance_name || null;
        updates.instance_phone = targetConnection.phone_number || null;
      }

      const { error: reopenError } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId)
        .eq('workspace_id', workspaceId);

      if (reopenError) {
        console.error('❌ Erro ao reabrir conversa existente:', reopenError);
        return new Response(
          JSON.stringify({ error: 'Erro ao reabrir conversa existente' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🔁 Reutilizando conversa existente ${conversationId} (status atualizado para open)`);
    }

    // Create conversation if doesn't exist
    if (!conversationId) {
      console.log('📡 Creating new conversation for contact:', contactId);

      if (!targetConnection) {
        console.warn(`⚠️ Nenhuma conexão ativa encontrada para workspace ${workspaceId}`);
      }

      const conversationData: any = {
        contact_id: contactId,
        status: 'open',
        workspace_id: workspaceId,
        canal: 'whatsapp',
        agente_ativo: false,
        connection_id: targetConnection?.id || null,
        evolution_instance: targetConnection?.instance_name || null,
        instance_phone: targetConnection?.phone_number || null,
      }

      console.log('📦 Conversation data:', {
        connection_id: conversationData.connection_id,
        evolution_instance: conversationData.evolution_instance
      });

      const { data: newConversation, error: conversationError } = await supabase
        .from('conversations')
        .insert(conversationData)
        .select('id')
        .single()

      if (conversationError) {
        console.error('Error creating conversation:', conversationError)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar conversa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      conversationId = newConversation.id
      createdNewConversation = true;
      console.log(`Created new conversation with ID: ${conversationId}`)

      // 🎯 DISTRIBUIR CONVERSA PARA FILA PADRÃO DO WORKSPACE (se existir)
      try {
        console.log(`🎯 Verificando fila padrão do workspace: ${workspaceId}`);
        
        let defaultQueueId = targetConnection?.queue_id || null;
        if (!defaultQueueId) {
          // Fallback: fila da conexão padrão
          const { data: defaultConnectionQueue } = await supabase
            .from('connections')
            .select('queue_id, instance_name')
            .eq('workspace_id', workspaceId)
            .eq('is_default', true)
            .maybeSingle();
          defaultQueueId = defaultConnectionQueue?.queue_id || null;
        }

        if (defaultQueueId) {
          console.log(`📋 Conexão padrão vinculada à fila: ${defaultQueueId}`);
          
          // Buscar fila e suas configurações
          const { data: queue } = await supabase
            .from('queues')
            .select('id, name, distribution_type, last_assigned_user_index, ai_agent_id')
            .eq('id', defaultQueueId)
            .eq('is_active', true)
            .single();

          if (queue) {
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

            if (queueUsers && queueUsers.length > 0) {
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
                  break;

                default:
                  console.log(`⚠️ Tipo de distribuição desconhecido: ${queue.distribution_type}`);
              }

              if (selectedUserId) {
                // Atualizar conversa com assigned_user_id (ACEITAR AUTOMATICAMENTE)
                const { error: updateError } = await supabase
                  .from('conversations')
                  .update({
                    assigned_user_id: selectedUserId,
                    assigned_at: new Date().toISOString(),
                    queue_id: defaultQueueId,
                    status: 'open',
                    agente_ativo: queue.ai_agent_id ? true : false,
                    agent_active_id: queue.ai_agent_id || null  // ✅ SALVAR ID DO AGENTE
                  })
                  .eq('id', conversationId);

                if (updateError) {
                  console.error(`❌ Erro ao atribuir conversa:`, updateError);
                } else {
                  console.log(`✅ Conversa ACEITA automaticamente para usuário ${selectedUserId}`);

                  // Registrar atribuição em conversation_assignments
                  await supabase
                    .from('conversation_assignments')
                    .insert({
                      conversation_id: conversationId,
                      to_assigned_user_id: selectedUserId,
                      from_assigned_user_id: null,
                      changed_by: selectedUserId,
                      action: 'assign'
                    });

                  console.log(`📝 Atribuição registrada: fila ${queue.name} → usuário ${selectedUserId}`);
                }
              }
            } else {
              console.log(`⚠️ Fila ${queue.name} não possui usuários ativos`);
            }
          } else {
            console.log(`ℹ️ Fila ${defaultQueueId} não está ativa`);
          }
        } else {
          console.log(`ℹ️ Nenhuma fila padrão configurada para o workspace`);
        }
      } catch (error) {
        console.error(`❌ Erro ao processar distribuição de fila (não-bloqueante):`, error);
      }
    } else {
      console.log(`Using existing conversation with ID: ${conversationId}`)
    }

    // 🧩 Criar card no pipeline (apenas quando a conversa foi criada agora)
    if (createdNewConversation && conversationId) {
      try {
        const pipelineId = targetConnection?.default_pipeline_id || null;
        const connectionPhone = targetConnection?.phone_number || null;

        const { data: cardData, error: cardError } = await supabase.functions.invoke(
          'smart-pipeline-card-manager',
          {
            body: {
              contactId,
              conversationId,
              workspaceId,
              pipelineId,
              connectionPhone,
              connectionId: targetConnection?.id || null,
            },
          }
        );

        if (cardError) {
          console.error('⚠️ Erro ao criar card (não-bloqueante):', cardError);
        } else {
          console.log('✅ Card criado/gerenciado:', cardData?.action || 'ok');
        }
      } catch (cardErr) {
        console.error('⚠️ Exceção ao criar card (não-bloqueante):', cardErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        conversationId, 
        contactId,
        phoneNumber: normalizedPhone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-quick-conversation:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})