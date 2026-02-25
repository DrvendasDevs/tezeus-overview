import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { selectMessageVariation, replaceMessageVariables } from "../_shared/message-utils.ts";
import { getLocalTimeInfo } from "../_shared/time-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📅 [Seasonal Automations] Iniciando verificação...');
    console.log('📅 [Seasonal Automations] Timestamp:', new Date().toISOString());

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const timeZone = 'America/Sao_Paulo';
    const { hours, minutes, monthNum, dayNum, yearNum } = getLocalTimeInfo(now, timeZone);

    console.log(`📅 [Seasonal Automations] Hora atual (${timeZone}): ${hours}:${String(minutes).padStart(2, '0')}, Data: ${dayNum}/${monthNum}/${yearNum}`);

    // 1. Buscar datas sazonais ativas que correspondem ao dia/mês atual
    const { data: seasonalDates, error: seasonalError } = await supabase
      .from('workspace_seasonal_dates')
      .select('*')
      .eq('is_enabled', true)
      .eq('month', monthNum)
      .eq('day', dayNum);

    if (seasonalError) {
      console.error('❌ [Seasonal Automations] Erro ao buscar datas sazonais:', seasonalError);
      throw seasonalError;
    }

    if (!seasonalDates || seasonalDates.length === 0) {
      console.log('ℹ️ [Seasonal Automations] Nenhuma data sazonal ativa para hoje');
      return new Response(
        JSON.stringify({ message: 'No active seasonal dates for today', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📅 [Seasonal Automations] ${seasonalDates.length} data(s) sazonal(is) encontrada(s) para hoje`);

    let totalProcessed = 0;

    for (const seasonalDate of seasonalDates) {
      try {
        // 2. Verificar se o horário atual corresponde ao send_time configurado
        const sendTimeParts = (seasonalDate.send_time || '09:00').split(':');
        const sendHour = parseInt(sendTimeParts[0], 10);
        const sendMinute = parseInt(sendTimeParts[1], 10);

        if (hours !== sendHour || minutes !== sendMinute) {
          continue; // Não é hora de enviar
        }

        console.log(`📅 [Seasonal Automations] Hora de envio atingida para "${seasonalDate.name}" no workspace ${seasonalDate.workspace_id}`);

        // 3. Buscar TODOS os contatos do workspace (com telefone)
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, name, phone, email')
          .eq('workspace_id', seasonalDate.workspace_id)
          .not('phone', 'is', null);

        if (contactsError) {
          console.error(`❌ [Seasonal Automations] Erro ao buscar contatos:`, contactsError);
          continue;
        }

        if (!contacts || contacts.length === 0) {
          console.log(`ℹ️ [Seasonal Automations] Nenhum contato no workspace ${seasonalDate.workspace_id}`);
          continue;
        }

        console.log(`📅 [Seasonal Automations] ${contacts.length} contato(s) encontrado(s) para "${seasonalDate.name}"`);

        // 4. Para cada contato, verificar se já enviou e enviar mensagem
        let messagesSentInBatch = 0;
        for (const contact of contacts) {
          try {
            // Verificar se já enviou para este contato nesta data sazonal este ano
            const { data: existingExecution } = await supabase
              .from('seasonal_automation_executions')
              .select('id')
              .eq('seasonal_date_id', seasonalDate.id)
              .eq('contact_id', contact.id)
              .eq('year', yearNum)
              .maybeSingle();

            if (existingExecution) {
              continue; // Já enviou
            }

            // Anti-spam: delay aleatório de 27-40s entre envios (exceto o primeiro)
            if (messagesSentInBatch > 0) {
              const randomDelay = (Math.floor(Math.random() * (40 - 27 + 1)) + 27) * 1000;
              console.log(`⏳ [Seasonal Automations] Aguardando ${Math.round(randomDelay / 1000)}s (delay anti-spam) antes do próximo envio...`);
              await new Promise(resolve => setTimeout(resolve, randomDelay));
            }

            // 5. Selecionar mensagem e substituir variáveis
            const rawMessage = selectMessageVariation(
              seasonalDate.message_template,
              seasonalDate.message_variations || []
            );
            const messageText = replaceMessageVariables(rawMessage, contact, { seasonalDateName: seasonalDate.name });

            // 6. Buscar conversa ativa do contato neste workspace
            const { data: conversation, error: convError } = await supabase
              .from('conversations')
              .select(`
                id,
                workspace_id,
                connection_id,
                connection:connections!conversations_connection_id_fkey(id, instance_name, status)
              `)
              .eq('workspace_id', seasonalDate.workspace_id)
              .eq('contact_id', contact.id)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (convError || !conversation) {
              continue; // Sem conversa, pula
            }

            let connection = Array.isArray(conversation.connection)
              ? conversation.connection[0]
              : conversation.connection;

            // Se data sazonal tem connection_id específico, usar essa conexão
            if (seasonalDate.connection_id) {
              const { data: specificConnection } = await supabase
                .from('connections')
                .select('id, instance_name, status')
                .eq('id', seasonalDate.connection_id)
                .eq('status', 'connected')
                .maybeSingle();

              if (specificConnection) {
                connection = specificConnection;
              }
            }

            if (!connection || connection.status !== 'connected') {
              continue; // Conexão não disponível
            }

            // 7. Criar registro da mensagem no banco
            const requestId = `seasonal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const { data: message, error: messageError } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversation.id,
                workspace_id: conversation.workspace_id,
                content: messageText,
                message_type: 'text',
                sender_type: 'system',
                sender_id: '00000000-0000-0000-0000-000000000001',
                status: 'sending',
                external_id: requestId,
                metadata: {
                  requestId,
                  source: 'seasonal_automation',
                  seasonal_date_name: seasonalDate.name,
                  contact_name: contact.name,
                  created_at: new Date().toISOString()
                }
              })
              .select()
              .single();

            if (messageError || !message) {
              console.error(`❌ [Seasonal Automations] Erro ao criar mensagem:`, messageError);
              continue;
            }

            // 8. Chamar message-sender
            const senderPayload = {
              messageId: message.id,
              phoneNumber: contact.phone,
              content: messageText,
              messageType: 'text',
              evolutionInstance: connection.instance_name,
              conversationId: conversation.id,
              workspaceId: conversation.workspace_id,
              external_id: message.external_id
            };

            const { data: senderResult, error: senderError } = await supabase.functions.invoke('message-sender', {
              body: senderPayload
            });

            if (senderError) {
              console.error(`❌ [Seasonal Automations] Erro no message-sender para ${contact.name}:`, senderError);
              await supabase
                .from('messages')
                .update({
                  status: 'failed',
                  metadata: {
                    ...message.metadata,
                    error: senderError.message,
                    sent_via: 'sender_error',
                    timestamp: new Date().toISOString()
                  }
                })
                .eq('id', message.id);
            } else {
              await supabase
                .from('messages')
                .update({
                  status: 'sent',
                  metadata: {
                    ...message.metadata,
                    sent_via: senderResult?.method || 'message-sender',
                    timestamp: new Date().toISOString(),
                    external_response: senderResult?.result
                  }
                })
                .eq('id', message.id);
            }

            // 9. Registrar execução
            await supabase
              .from('seasonal_automation_executions')
              .insert({
                seasonal_date_id: seasonalDate.id,
                contact_id: contact.id,
                year: yearNum,
                status: senderError ? 'failed' : 'sent'
              });

            if (!senderError) {
              totalProcessed++;
            }

            messagesSentInBatch++;

          } catch (contactError) {
            console.error(`❌ [Seasonal Automations] Erro ao processar contato ${contact.id}:`, contactError);
          }
        }

        console.log(`📅 [Seasonal Automations] "${seasonalDate.name}" processada no workspace ${seasonalDate.workspace_id}`);

      } catch (dateError) {
        console.error(`❌ [Seasonal Automations] Erro ao processar data sazonal ${seasonalDate.id}:`, dateError);
      }
    }

    console.log(`✅ [Seasonal Automations] Verificação concluída. ${totalProcessed} mensagem(ns) enviada(s)`);

    return new Response(
      JSON.stringify({
        message: 'Seasonal automations processed',
        processed: totalProcessed,
        seasonal_dates_checked: seasonalDates.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Seasonal Automations] Fatal error:', error);
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message + (error.stack ? '\n' + error.stack : '');
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      try { errorMessage = JSON.stringify(error); } catch { errorMessage = String(error); }
    }
    console.error('❌ [Seasonal Automations] Error details:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
