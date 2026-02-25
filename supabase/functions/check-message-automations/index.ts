import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verifica se o horário atual está dentro do horário de funcionamento do workspace
 * 
 * @param workspaceId - ID do workspace
 * @param supabaseClient - Cliente Supabase
 * @param currentTime - Data/hora atual (opcional, usa Date.now() se não fornecido)
 * @returns true se estiver dentro do horário ou se não houver configuração, false caso contrário
 */
async function isWithinBusinessHours(
  workspaceId: string,
  supabaseClient: any,
  currentTime?: Date
): Promise<boolean> {
  try {
    // Buscar horários configurados para o workspace
    const { data: businessHours, error } = await supabaseClient
      .from('workspace_business_hours')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_enabled', true);

    if (error) {
      console.error('❌ Erro ao buscar horários de funcionamento:', error);
      // Em caso de erro, permitir envio (fail-safe)
      return true;
    }

    // Se não houver horários configurados, permitir envio (sem restrição)
    if (!businessHours || businessHours.length === 0) {
      console.log('✅ Nenhum horário de funcionamento configurado - permitindo envio');
      return true;
    }

    // Obter data/hora atual no fuso horário America/Sao_Paulo
    const now = currentTime || new Date();
    
    // Converter para fuso horário America/Sao_Paulo usando Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    // Obter partes da data formatada
    const parts = formatter.formatToParts(now);
    
    // Converter weekday string para número (0=Domingo, 1=Segunda, etc)
    const weekdayMap: Record<string, number> = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };
    
    const dayName = parts.find(p => p.type === 'weekday')?.value || '';
    const dayOfWeekNum = weekdayMap[dayName] ?? now.getDay();
    
    // Extrair hora e minuto
    const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const currentTimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    console.log(`🕐 Verificando horário de funcionamento:`, {
      workspaceId,
      dayOfWeek: dayOfWeekNum,
      dayName,
      currentTime: currentTimeString,
      timezone: 'America/Sao_Paulo'
    });

    // Buscar configuração para o dia da semana atual
    const todayConfig = businessHours.find((bh: any) => bh.day_of_week === dayOfWeekNum);

    // ✅ CORREÇÃO: Se não houver configuração para o dia atual, PERMITIR envio
    // Requisito: "Ao não definir horário de funcionamento, entende-se que é qualquer horário"
    // Se o dia não está configurado, significa que não há restrição para esse dia
    if (!todayConfig) {
      console.log(`✅ Dia da semana ${dayOfWeekNum} (${dayName}) não está configurado - permitindo envio (sem restrição para este dia)`);
      return true;
    }

    // Extrair hora e minuto do start_time e end_time
    const startTime = todayConfig.start_time;
    const endTime = todayConfig.end_time;

    // Converter strings TIME para minutos desde meia-noite para comparação
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;
    const currentMinutesTotal = hours * 60 + minutes;

    console.log(`📊 Comparando horários:`, {
      startTime: `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`,
      endTime: `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`,
      currentTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      startMinutesTotal,
      endMinutesTotal,
      currentMinutesTotal
    });

    // Verificar se está dentro do horário
    let isWithinHours = false;

    if (endMinutesTotal > startMinutesTotal) {
      // Horário normal (não cruza meia-noite)
      // Ex: 08:00 - 18:00
      isWithinHours = currentMinutesTotal >= startMinutesTotal && currentMinutesTotal <= endMinutesTotal;
    } else {
      // Horário que cruza meia-noite
      // Ex: 22:00 - 02:00 (22:00 até 23:59 e 00:00 até 02:00)
      isWithinHours = currentMinutesTotal >= startMinutesTotal || currentMinutesTotal <= endMinutesTotal;
    }

    if (isWithinHours) {
      console.log('✅ Dentro do horário de funcionamento - permitindo envio');
    } else {
      console.log('🚫 Fora do horário de funcionamento - bloqueando envio');
    }

    return isWithinHours;
  } catch (error) {
    console.error('❌ Erro ao verificar horário de funcionamento:', error);
    // Em caso de erro, permitir envio (fail-safe)
    return true;
  }
}

async function generateDeterministicUUID(input: string) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Ajustar bits para UUID v5
  hashArray[6] = (hashArray[6] & 0x0f) | 0x50;
  hashArray[8] = (hashArray[8] & 0x3f) | 0x80;

  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 [Message Automations] Function invoked');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    let { contactId, conversationId, workspaceId, phoneNumber } = body;

    console.log('🔍 [Message Automations] Request recebido:', JSON.stringify(body, null, 2));

    // Se phoneNumber não foi fornecido, buscar do contato
    if (!phoneNumber && contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone')
        .eq('id', contactId)
        .maybeSingle();
      
      if (contact) {
        phoneNumber = contact.phone;
        console.log(`📞 [Message Automations] PhoneNumber buscado do contato: ${phoneNumber}`);
      }
    }

    // Se contactId não foi fornecido mas temos conversationId, buscar do conversation
    if (!contactId && conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (conversation?.contact_id) {
        contactId = conversation.contact_id;
        console.log(`👤 [Message Automations] ContactId buscado da conversa: ${contactId}`);
      }
    }

    // Se workspaceId não foi fornecido mas temos conversationId, buscar do conversation
    if (!workspaceId && conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('workspace_id')
        .eq('id', conversationId)
        .maybeSingle();
      
      if (conversation?.workspace_id) {
        workspaceId = conversation.workspace_id;
        console.log(`🏢 [Message Automations] WorkspaceId buscado da conversa: ${workspaceId}`);
      }
    }

    console.log('🔍 [Message Automations] Verificando automações de mensagens recebidas:', {
      contactId,
      conversationId,
      workspaceId,
      phoneNumber
    });

    // Validação: precisamos de pelo menos contactId ou conversationId
    if (!contactId && !conversationId) {
      console.error('❌ [Message Automations] Erro: contactId e conversationId não fornecidos');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'contactId or conversationId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Buscar card ativo do contato
    const { data: cards, error: cardsError } = await supabase
      .from('pipeline_cards')
      .select(`
        id, 
        column_id, 
        pipeline_id, 
        description, 
        conversation_id, 
        contact_id,
        moved_to_column_at,
        pipelines!inner(workspace_id)
      `)
      .eq('contact_id', contactId)
      .eq('pipelines.workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (cardsError) {
      console.error('❌ Erro ao buscar cards:', cardsError);
      return new Response(JSON.stringify({ error: cardsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!cards || cards.length === 0) {
      console.log('ℹ️ Nenhum card ativo encontrado para o contato');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active cards found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Encontrado(s) ${cards.length} card(s) ativo(s)`);

    // 2. Para cada card, verificar automações da coluna
    for (const card of cards) {
      console.log(`\n🔍 Verificando automações para card ${card.id} na coluna ${card.column_id}`);

      // Buscar automações da coluna
      const { data: automations, error: automationsError } = await supabase
        .rpc('get_column_automations', { p_column_id: card.column_id });

      if (automationsError) {
        console.error('❌ Erro ao buscar automações:', automationsError);
        continue;
      }

      if (!automations || automations.length === 0) {
        console.log('ℹ️ Nenhuma automação encontrada nesta coluna');
        continue;
      }

      console.log(`✅ ${automations.length} automação(ões) encontrada(s)`);

      // 3. Filtrar automações com trigger "message_received"
      // ✅ ANTI-SPAM: Rastrear última vez que enviamos mensagem para adicionar delay entre automações
      let lastAutomationMessageTime = 0;
      const MIN_DELAY_BETWEEN_AUTOMATIONS = 3000; // 3 segundos mínimo entre automações que enviam mensagens
      
      for (let automationIndex = 0; automationIndex < automations.length; automationIndex++) {
        const automation = automations[automationIndex];
        if (!automation.is_active) {
          console.log(`⏭️ Automação "${automation.name}" está inativa`);
          continue;
        }

        // Buscar triggers
        const { data: triggers } = await supabase
          .from('crm_column_automation_triggers')
          .select('*')
          .eq('automation_id', automation.id);

        // Buscar actions
        const { data: actions } = await supabase
          .from('crm_column_automation_actions')
          .select('*')
          .eq('automation_id', automation.id)
          .order('action_order', { ascending: true });

        // Verificar se tem trigger message_received
        const messageReceivedTrigger = triggers?.find(
          (t: any) => t.trigger_type === 'message_received'
        );

        if (!messageReceivedTrigger) {
          console.log(`⏭️ Automação "${automation.name}" não tem trigger message_received`);
          continue;
        }

        console.log(`✅ Automação "${automation.name}" com trigger message_received encontrada`);

        // Obter configuração do trigger
        const triggerConfig = messageReceivedTrigger.trigger_config || {};
        const requiredMessageCount = triggerConfig.message_count || 1;
        console.log(`📊 Mensagens necessárias: ${requiredMessageCount}`);

        // Usar moved_to_column_at como timestamp de entrada na coluna
        // Este campo é atualizado sempre que o card é movido, garantindo unicidade
        const columnEntryDate = card.moved_to_column_at || new Date().toISOString();
        console.log(`📅 Card entrou na coluna em: ${columnEntryDate}`);

        // Usar conversation_id do card ou o passado como parâmetro
        const conversationToCheck = card.conversation_id || conversationId;
        
        if (!conversationToCheck) {
          console.log('⚠️ Nenhuma conversa associada ao card - pulando');
          continue;
        }

        // Contar mensagens do contato desde que entrou na coluna
        const { count: messageCount, error: countError } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversationToCheck)
          .eq('sender_type', 'contact')
          .gte('created_at', columnEntryDate);

        if (countError) {
          console.error('❌ Erro ao contar mensagens:', countError);
          continue;
        }

        console.log(`📨 Mensagens recebidas desde entrada na coluna: ${messageCount}`);

        // Verificar se atingiu o número necessário de mensagens
        if (!messageCount || messageCount < requiredMessageCount) {
          console.log(`⏭️ Ainda não atingiu ${requiredMessageCount} mensagens (atual: ${messageCount || 0})`);
          continue;
        }

        const entryTimestamp = new Date(columnEntryDate).getTime();
        const executionKey = `msg_${card.id}_${card.column_id}_${automation.id}_${entryTimestamp}`;
        const deterministicId = await generateDeterministicUUID(executionKey);

        const { data: existingExecution, error: existingExecError } = await supabase
          .from('automation_executions')
          .select('id')
          .eq('id', deterministicId)
          .maybeSingle();

        if (existingExecError && existingExecError.code !== 'PGRST116') {
          console.error('❌ Erro ao verificar execuções existentes:', existingExecError);
          continue;
        }

        if (existingExecution) {
          console.log(`🚫 Automação "${automation.name}" já executada para esta entrada (chave ${executionKey})`);
          continue;
        }

        console.log(`✅ Condições atendidas! Executando automação "${automation.name}" pela primeira vez nesta entrada`);

        // ✅ Registrar execução ANTES de executar ações (evita duplicatas)
        const { error: execError } = await supabase
          .from('automation_executions')
          .insert({
            id: deterministicId,
            card_id: card.id,
            column_id: card.column_id,
            automation_id: automation.id,
            trigger_type: 'message_received',
            workspace_id: workspaceId
          });

        if (execError) {
          if (execError.code === '23505') {
            console.log(`🚫 Execução duplicada detectada (chave ${executionKey}), ignorando.`);
            continue;
          }
          console.error(`❌ Erro ao registrar execução:`, execError);
          continue; // Pula para próxima automação se não conseguir registrar
        }
        
        console.log(`📝 Execução registrada para automação "${automation.name}"`);
        console.log(`🎬 Executando ${actions?.length || 0} ação(ões)...`);

        // ✅ ANTI-SPAM: Verificar se esta automação envia mensagens
        const messageActions = ['send_message', 'send_funnel'];
        const automationHasMessageActions = actions?.some((a: any) => messageActions.includes(a.action_type)) || false;
        
        // Se esta automação envia mensagens e não é a primeira, aguardar delay
        if (automationHasMessageActions && automationIndex > 0 && lastAutomationMessageTime > 0) {
          const timeSinceLastMessage = Date.now() - lastAutomationMessageTime;
          if (timeSinceLastMessage < MIN_DELAY_BETWEEN_AUTOMATIONS) {
            const delayNeeded = MIN_DELAY_BETWEEN_AUTOMATIONS - timeSinceLastMessage;
            console.log(`⏳ Aguardando ${delayNeeded}ms antes de executar próxima automação com mensagens (anti-spam)...`);
            await new Promise(resolve => setTimeout(resolve, delayNeeded));
          }
        }

        // 4. Executar ações
        if (actions && actions.length > 0) {
          // ✅ ANTI-SPAM: Executar ações sequencialmente se houver envio de mensagens
          if (automationHasMessageActions) {
            console.log(`⏳ Executando ações sequencialmente (com delay anti-spam) devido a envio de mensagens`);
            
            let lastMessageActionTime = 0;
            const MIN_DELAY_BETWEEN_MESSAGES = 2000; // 2 segundos mínimo entre mensagens
            const messageActionTypes = ['send_message', 'send_funnel'];
            
            for (let i = 0; i < actions.length; i++) {
              const action = actions[i];
              const isMessageAction = messageActionTypes.includes(action.action_type);
              
              // Se é ação de mensagem e não é a primeira, aguardar delay
              if (isMessageAction && i > 0) {
                const timeSinceLastMessage = Date.now() - lastMessageActionTime;
                if (timeSinceLastMessage < MIN_DELAY_BETWEEN_MESSAGES) {
                  const delayNeeded = MIN_DELAY_BETWEEN_MESSAGES - timeSinceLastMessage;
                  console.log(`⏳ Aguardando ${delayNeeded}ms antes de enviar próxima mensagem (anti-spam)...`);
                  await new Promise(resolve => setTimeout(resolve, delayNeeded));
                }
              }
              
              try {
                await executeAction(action, card, supabase, workspaceId, automation.ignore_business_hours === true);
                
                // Atualizar timestamp se for ação de mensagem
                if (isMessageAction) {
                  lastMessageActionTime = Date.now();
                }
              } catch (actionError) {
                console.error(`❌ Erro ao executar ação:`, actionError);
              }
            }
            
            // Atualizar timestamp global se automação enviou mensagens
            if (automationHasMessageActions) {
              lastAutomationMessageTime = Date.now();
            }
          } else {
            // Para ações que não enviam mensagens, executar normalmente
            for (const action of actions) {
              try {
                await executeAction(action, card, supabase, workspaceId, automation.ignore_business_hours === true);
              } catch (actionError) {
                console.error(`❌ Erro ao executar ação:`, actionError);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed_cards: cards.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function executeAction(action: any, card: any, supabaseClient: any, workspaceId: string, ignoreBusinessHours: boolean = false) {
  console.log(`🎬 Executando ação: ${action.action_type}`);

  // Normalizar action_config
  let actionConfig = action.action_config || {};
  if (typeof actionConfig === 'string') {
    try {
      actionConfig = JSON.parse(actionConfig);
    } catch (e) {
      console.warn('⚠️ action_config inválido:', actionConfig);
      actionConfig = {};
    }
  }

  switch (action.action_type) {
    case 'send_message': {
      const messageText = actionConfig.message || '';
      if (!messageText) {
        console.warn('⚠️ send_message sem mensagem configurada');
        return;
      }

      if (!card.conversation_id) {
        console.error('❌ Card sem conversation_id');
        return;
      }

      // Buscar contato
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('phone')
        .eq('id', card.contact_id)
        .single();

      if (!contact) {
        console.error('❌ Contato não encontrado');
        return;
      }

      // Buscar dados da conversa (incluindo workspace)
      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('id, connection_id, workspace_id')
        .eq('id', card.conversation_id)
        .single();

      if (!conversation) {
        console.error('❌ Conversa não encontrada');
        return;
      }

      // ✅ Verificar horário de funcionamento antes de enviar (a menos que ignore_business_hours esteja ativo)
      const workspaceIdForCheck = conversation.workspace_id;
      
      if (workspaceId && !ignoreBusinessHours) {
        const withinBusinessHours = await isWithinBusinessHours(workspaceId, supabaseClient);
        if (!withinBusinessHours) {
          console.log(`🚫 Mensagem bloqueada: fora do horário de funcionamento`);
          console.log(`   Workspace ID: ${workspaceId}`);
          console.log(`   Card ID: ${card.id}`);
          console.log(`   Mensagem não será enviada para evitar violação legal`);
          return; // Retornar sem enviar
        }
        console.log(`✅ Dentro do horário de funcionamento - prosseguindo com envio`);
      } else if (ignoreBusinessHours) {
        console.log(`⏰ Automação configurada para ignorar horário de funcionamento - prosseguindo com envio`);
      } else {
        console.warn(`⚠️ Workspace ID não encontrado - não é possível verificar horário de funcionamento`);
      }

      const connectionMode = actionConfig.connection_mode || 'last';
      let finalConnectionId = conversation.connection_id || null;

      console.log('🔌 Resolvendo conexão para automação de mensagem recebida:', {
        cardId: card.id,
        conversationId: conversation.id,
        connectionMode,
        currentConnection: conversation.connection_id,
      });

      if (connectionMode === 'last' && card.contact_id) {
        const { data: lastMessage } = await supabaseClient
          .from('messages')
          .select('conversation_id, conversations!inner(connection_id)')
          .eq('conversations.contact_id', card.contact_id)
          .not('conversations.connection_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage?.conversations?.connection_id) {
          finalConnectionId = lastMessage.conversations.connection_id;
          console.log('✅ Conexão resolvida via última mensagem:', finalConnectionId);
        }
      } else if (connectionMode === 'default' && conversation.workspace_id) {
        const { data: defaultConnection } = await supabaseClient
          .from('connections')
          .select('id')
          .eq('workspace_id', conversation.workspace_id)
          .eq('status', 'connected')
          .eq('is_default', true)
          .single();

        if (defaultConnection?.id) {
          finalConnectionId = defaultConnection.id;
          console.log('✅ Conexão padrão do workspace utilizada:', finalConnectionId);
        }
      } else if (connectionMode === 'specific') {
        const specificConnectionId = actionConfig.connection_id;
        if (specificConnectionId) {
          const { data: specificConnection } = await supabaseClient
            .from('connections')
            .select('id, status')
            .eq('id', specificConnectionId)
            .single();

          if (specificConnection?.status === 'connected') {
            finalConnectionId = specificConnection.id;
            console.log('✅ Conexão específica validada:', finalConnectionId);
          } else {
            console.error('❌ Conexão específica inválida ou inativa');
            return;
          }
        } else {
          console.error('❌ connection_mode "specific" sem connection_id configurado');
          return;
        }
      }

      if (!finalConnectionId) {
        console.error('❌ Não foi possível resolver uma conexão válida para envio automático');
        return;
      }

      // Garantir que a conversa esteja vinculada à conexão encontrada
      if (!conversation.connection_id || conversation.connection_id !== finalConnectionId) {
        await supabaseClient
          .from('conversations')
          .update({ connection_id: finalConnectionId })
          .eq('id', conversation.id);
      }

      console.log(`📤 Enviando mensagem para ${contact.phone} via conexão ${finalConnectionId}`);

      const payload = {
        conversation_id: conversation.id,
        content: messageText,
        message_type: 'text',
        sender_type: 'system',
        sender_id: null,
        clientMessageId: `automation_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      };

      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const url = `${supabaseUrl}/functions/v1/test-send-msg`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('❌ Falha HTTP ao enviar mensagem:', response.status, errorBody);
          return;
        }

        const data = await response.json();
        if (data?.success) {
          console.log('✅ Mensagem enviada com sucesso via automação de mensagens recebidas');
        } else {
          console.error('❌ Erro no envio automático:', data);
        }
      } catch (error) {
        console.error('❌ Erro inesperado ao enviar mensagem automática:', error);
      }
      break;
    }

    case 'send_funnel': {
      const funnelId = actionConfig.funnel_id;
      if (!funnelId) {
        console.warn('⚠️ send_funnel sem funnel_id configurado');
        return;
      }

      if (!card.conversation_id) {
        console.error('❌ Card sem conversation_id');
        return;
      }

      // Buscar funil
      const { data: funnel } = await supabaseClient
        .from('quick_funnels')
        .select('*')
        .eq('id', funnelId)
        .single();

      if (!funnel) {
        console.error('❌ Funil não encontrado:', funnelId);
        return;
      }

      console.log(`📊 Enviando funil: ${funnel.title}`);

      // Buscar contato
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('phone')
        .eq('id', card.contact_id)
        .single();

      // Buscar connection_id da conversa
      const { data: conversation } = await supabaseClient
        .from('conversations')
        .select('connection_id')
        .eq('id', card.conversation_id)
        .single();

      if (!contact || !conversation?.connection_id) {
        console.error('❌ Dados insuficientes para enviar funil');
        return;
      }

      // ✅ Verificar horário de funcionamento antes de enviar funil (a menos que ignore_business_hours esteja ativo)
      const { data: conversationFull } = await supabaseClient
        .from('conversations')
        .select('workspace_id')
        .eq('id', card.conversation_id)
        .single();

      const funnelWorkspaceId = conversationFull?.workspace_id;
      
      if (funnelWorkspaceId && !ignoreBusinessHours) {
        const withinBusinessHours = await isWithinBusinessHours(funnelWorkspaceId, supabaseClient);
        if (!withinBusinessHours) {
          console.log(`🚫 Funil bloqueado: fora do horário de funcionamento`);
          console.log(`   Workspace ID: ${funnelWorkspaceId}`);
          console.log(`   Card ID: ${card.id}`);
          console.log(`   Funil não será enviado para evitar violação legal`);
          return; // Retornar sem enviar
        }
        console.log(`✅ Dentro do horário de funcionamento - prosseguindo com envio do funil`);
      } else if (ignoreBusinessHours) {
        console.log(`⏰ Automação configurada para ignorar horário de funcionamento - prosseguindo com envio do funil`);
      } else {
        console.warn(`⚠️ Workspace ID não encontrado - não é possível verificar horário de funcionamento`);
      }

      // Processar steps do funil
      const steps = funnel.steps || [];
      const sortedSteps = steps.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

      console.log(`📝 Funil tem ${sortedSteps.length} etapa(s)`);

      for (let i = 0; i < sortedSteps.length; i++) {
        const step = sortedSteps[i];
        
        // Aplicar delay se não for primeiro item
        if (i > 0 && step.delay > 0) {
          console.log(`⏳ Aguardando ${step.delay} segundo(s)...`);
          await new Promise(resolve => setTimeout(resolve, step.delay * 1000));
        }

        let messagePayload: any = null;

        // Normalizar tipo
        const stepType = (step.type || '').toLowerCase();

        switch (stepType) {
          case 'message':
          case 'messages': {
            const { data: message } = await supabaseClient
              .from('quick_messages')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (message) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: message.content,
                message_type: 'text'
              };
            }
            break;
          }

          case 'audio':
          case 'audios': {
            const { data: audio } = await supabaseClient
              .from('quick_audios')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (audio) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: '',
                message_type: 'audio',
                file_url: audio.file_url,
                file_name: audio.file_name || audio.title || 'audio.mp3'
              };
            }
            break;
          }

          case 'media':
          case 'midias': {
            const { data: media } = await supabaseClient
              .from('quick_media')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (media) {
              // Determinar tipo baseado no file_type ou URL
              let mediaType = 'image';
              if (media.file_type?.startsWith('video/')) {
                mediaType = 'video';
              } else if (media.file_url) {
                const url = media.file_url.toLowerCase();
                if (url.includes('.mp4') || url.includes('.mov') || url.includes('.avi')) {
                  mediaType = 'video';
                }
              }
              
              messagePayload = {
                conversation_id: card.conversation_id,
                content: media.title || '',
                message_type: mediaType,
                file_url: media.file_url,
                file_name: media.file_name || media.title || `media.${mediaType === 'video' ? 'mp4' : 'jpg'}`
              };
            }
            break;
          }

          case 'document':
          case 'documents':
          case 'documentos': {
            const { data: document } = await supabaseClient
              .from('quick_documents')
              .select('*')
              .eq('id', step.item_id)
              .single();

            if (document) {
              messagePayload = {
                conversation_id: card.conversation_id,
                content: document.title || '',
                message_type: 'document',
                file_url: document.file_url,
                file_name: document.file_name || document.title || 'document.pdf'
              };
            }
            break;
          }
        }

        if (messagePayload) {
          console.log(`📦 Enviando item ${i + 1}/${sortedSteps.length}...`);

          const { error: sendError } = await supabaseClient.functions.invoke('test-send-msg', {
            body: messagePayload
          });

          if (sendError) {
            console.error(`❌ Erro ao enviar item ${i + 1}:`, sendError);
          } else {
            console.log(`✅ Item ${i + 1} enviado`);
          }
        }
      }
      break;
    }

    case 'change_column': {
      const targetColumnId = actionConfig.column_id || actionConfig.target_column_id;
      const targetPipelineId = actionConfig.pipeline_id || actionConfig.target_pipeline_id;
      
      if (!targetColumnId) {
        console.warn('⚠️ change_column sem column_id configurado');
        return;
      }

      console.log(`🔀 Movendo card para coluna ${targetColumnId}`);

      const updateData: any = { 
        column_id: targetColumnId,
        updated_at: new Date().toISOString()
      };

      if (targetPipelineId) {
        updateData.pipeline_id = targetPipelineId;
      }

      const { error: moveError } = await supabaseClient
        .from('pipeline_cards')
        .update(updateData)
        .eq('id', card.id);

      if (moveError) {
        console.error('❌ Erro ao mover card:', moveError);
      } else {
        console.log('✅ Card movido com sucesso');
      }
      break;
    }

    case 'add_tag': {
      const tagId = actionConfig.tag_id;
      if (!tagId) {
        console.warn('⚠️ add_tag sem tag_id configurado');
        return;
      }

      console.log(`🏷️ Adicionando tag ${tagId} ao contato`);

      const { error: tagError } = await supabaseClient
        .from('contact_tags')
        .insert({
          contact_id: card.contact_id,
          tag_id: tagId
        });

      if (tagError) {
        if (tagError.code === '23505') {
          console.log('ℹ️ Tag já existe no contato');
        } else {
          console.error('❌ Erro ao adicionar tag:', tagError);
        }
      } else {
        console.log('✅ Tag adicionada com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          // O usePipelineRealtime escuta mudanças em contact_tags e atualiza os cards
          console.log('📡 [Broadcast] Tag adicionada, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'add_agent': {
      if (!card.conversation_id) {
        console.warn('⚠️ Card sem conversation_id');
        return;
      }

      const agentId = actionConfig.agent_id;
      if (!agentId) {
        console.warn('⚠️ add_agent sem agent_id configurado');
        return;
      }

      console.log(`🤖 Ativando agente ${agentId} na conversa ${card.conversation_id}`);

      const { error: agentError } = await supabaseClient
        .from('conversations')
        .update({
          agente_ativo: true,
          agent_active_id: agentId,
          status: 'open'
        })
        .eq('id', card.conversation_id);

      if (agentError) {
        console.error('❌ Erro ao ativar agente:', agentError);
      } else {
        console.log('✅ Agente ativado com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Agente ativado, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'remove_agent': {
      if (!card.conversation_id) {
        console.warn('⚠️ Card sem conversation_id');
        return;
      }

      console.log(`🚫 Desativando agente IA na conversa ${card.conversation_id}`);

      const { error: agentError } = await supabaseClient
        .from('conversations')
        .update({
          agente_ativo: false,
          agent_active_id: null
        })
        .eq('id', card.conversation_id);

      if (agentError) {
        console.error('❌ Erro ao desativar agente:', agentError);
      } else {
        console.log('✅ Agente desativado com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Agente desativado, realtime Postgres enviará o evento');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    case 'move_to_column': {
      const targetColumnId = actionConfig.column_id;
      if (!targetColumnId) {
        console.warn('⚠️ move_to_column sem column_id configurado');
        return;
      }

      console.log(`🔀 Movendo card para coluna ${targetColumnId}`);

      const { error: moveError } = await supabaseClient
        .from('pipeline_cards')
        .update({ 
          column_id: targetColumnId,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (moveError) {
        console.error('❌ Erro ao mover card:', moveError);
      } else {
        console.log('✅ Card movido com sucesso');
        
        // 📡 Emitir broadcast para atualizar cards em tempo real
        try {
          console.log('📡 [Broadcast] Card movido, realtime Postgres enviará o evento de UPDATE');
        } catch (err) {
          console.warn('⚠️ [Broadcast] Erro ao processar broadcast:', err);
        }
      }
      break;
    }

    default:
      console.warn(`⚠️ Tipo de ação desconhecido: ${action.action_type}`);
  }
}
