import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { selectMessageVariation as sharedSelectMessageVariation, replaceMessageVariables as sharedReplaceMessageVariables } from "../_shared/message-utils.ts";
import { getLocalTimeInfo as sharedGetLocalTimeInfo } from "../_shared/time-utils.ts";
import { isWithinBusinessHours as sharedIsWithinBusinessHours } from "../_shared/business-hours.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// isWithinBusinessHours importado de _shared/business-hours.ts
const isWithinBusinessHours = sharedIsWithinBusinessHours;

// Função helper para converter qualquer unidade de tempo para minutos
function convertToMinutes(value: number, unit: string): number {
  switch (unit) {
    case 'seconds':
      return value / 60;
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 1440;
    default:
      console.warn(`⚠️ Unknown time unit: ${unit}, treating as minutes`);
      return value;
  }
}

function parseScheduledTime(value?: string) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const [hoursStr, minutesStr] = value.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

// selectMessageVariation, replaceMessageVariables e getLocalTimeInfo importados de _shared/
// Wrappers locais para manter compatibilidade com chamadas existentes
function selectMessageVariation(actionConfig: any): string {
  return sharedSelectMessageVariation(actionConfig);
}

function replaceMessageVariables(
  message: string,
  contact?: { name?: string; phone?: string; email?: string } | null,
  columnName?: string,
  pipelineName?: string
): string {
  return sharedReplaceMessageVariables(message, contact, { columnName, pipelineName });
}

function getLocalTimeInfo(now: Date, timeZone: string) {
  return sharedGetLocalTimeInfo(now, timeZone);
}

async function executeAutomationActions(
  automation: any,
  card: any,
  supabase: any,
  supabaseKey: string
): Promise<boolean> {
  let actionSuccess = true;
  const shouldIgnoreBusinessHours =
    automation?.ignore_business_hours === true ||
    automation?.ignore_business_hours === 'true' ||
    automation?.ignore_business_hours === 1 ||
    automation?.ignore_business_hours === '1' ||
    automation?.ignore_business_hours === 't' ||
    automation?.ignore_business_hours === 'yes' ||
    automation?.ignore_business_hours === 'y';

  if (!automation?.actions || automation.actions.length === 0) {
    return true;
  }

  // Ordenar ações por action_order
  const sortedActions = automation.actions.sort((a: any, b: any) =>
    (a.action_order || 0) - (b.action_order || 0)
  );

  // Executar cada ação
  for (const action of sortedActions) {
    try {
      const actionConfig = typeof action.action_config === 'string'
        ? JSON.parse(action.action_config)
        : action.action_config;

      console.log(`🎬 [Time Automations] Executando ação: ${action.action_type}`, actionConfig);

      switch (action.action_type) {
        case 'mover_coluna':
        case 'move_to_column': {
          const targetColumnId = actionConfig?.column_id || actionConfig?.target_column_id;
          const targetPipelineId = actionConfig?.pipeline_id || actionConfig?.target_pipeline_id;

          console.log(`🔍 [Time Automations] Move action config:`, actionConfig);
          console.log(`🔍 [Time Automations] Target column ID: ${targetColumnId}, Target Pipeline ID: ${targetPipelineId}`);

          if (targetColumnId) {
            const updateData: any = {
              column_id: targetColumnId,
              moved_to_column_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (targetPipelineId) {
              updateData.pipeline_id = targetPipelineId;
            }

            // Usar update direto para suportar pipeline_id
            const { data: updateResult, error: updateError } = await supabase
              .from('pipeline_cards')
              .update(updateData)
              .eq('id', card.id)
              .select()
              .single();

            if (updateError) {
              console.error(`❌ [Time Automations] Erro ao mover card:`, updateError);
            } else {
              console.log(`✅ [Time Automations] Card ${card.id} movido para coluna ${targetColumnId} no pipeline ${targetPipelineId || card.pipeline_id}`, updateResult);

              // Enviar broadcast manual para garantir que o frontend receba a atualização
              const channel = supabase.channel(`pipeline-${card.pipeline_id}`);
              await channel.send({
                type: 'broadcast',
                event: 'pipeline-card-moved',
                payload: {
                  card_id: card.id,
                  old_column_id: card.column_id,
                  new_column_id: targetColumnId,
                  pipeline_id: targetPipelineId || card.pipeline_id
                }
              });
              console.log(`📡 [Time Automations] Broadcast enviado para pipeline-${card.pipeline_id}`);
            }
          } else {
            console.error(`❌ [Time Automations] column_id não encontrado no actionConfig`);
          }
          break;
        }

        case 'add_tag':
        case 'adicionar_tag': {
          const tagId = actionConfig?.tag_id;
          if (tagId && card.contact_id) {
            // Verificar se a tag já existe
            const { data: existingTag } = await supabase
              .from('contact_tags')
              .select('id')
              .eq('contact_id', card.contact_id)
              .eq('tag_id', tagId)
              .maybeSingle();

            if (!existingTag) {
              await supabase
                .from('contact_tags')
                .insert({
                  contact_id: card.contact_id,
                  tag_id: tagId
                });
              console.log(`✅ [Time Automations] Tag ${tagId} adicionada ao contato`);
            }
          }
          break;
        }

        case 'remove_tag':
        case 'remover_tag': {
          const tagId = actionConfig?.tag_id;
          if (tagId && card.contact_id) {
            await supabase
              .from('contact_tags')
              .delete()
              .eq('contact_id', card.contact_id)
              .eq('tag_id', tagId);
            console.log(`✅ [Time Automations] Tag ${tagId} removida do contato`);
          }
          break;
        }

        case 'assign_responsible':
        case 'atribuir_responsavel': {
          const userId = actionConfig?.user_id;
          if (userId) {
            await supabase
              .from('pipeline_cards')
              .update({ responsible_user_id: userId })
              .eq('id', card.id);
            console.log(`✅ [Time Automations] Responsável ${userId} atribuído ao card`);
          }
          break;
        }

        case 'add_agent': {
          if (card.conversation_id) {
            const agentId = actionConfig?.agent_id;
            if (agentId) {
              await supabase
                .from('conversations')
                .update({
                  agente_ativo: true,
                  agent_active_id: agentId,
                  status: 'open'
                })
                .eq('id', card.conversation_id);
              console.log(`✅ [Time Automations] Agente ${agentId} ativado na conversa`);
            }
          }
          break;
        }

        case 'remove_agent':
        case 'remover_agente': {
          if (!card.conversation_id) {
            console.warn('⚠️ [Time Automations] Card sem conversation_id para remove_agent');
            actionSuccess = false;
            break;
          }

          console.log(`🚫 [Time Automations] Desativando agente IA na conversa ${card.conversation_id}`);

          const { error: agentError } = await supabase
            .from('conversations')
            .update({
              agente_ativo: false,
              agent_active_id: null
            })
            .eq('id', card.conversation_id);

          if (agentError) {
            console.error('❌ [Time Automations] Erro ao desativar agente:', agentError);
            actionSuccess = false;
          } else {
            console.log('✅ [Time Automations] Agente desativado com sucesso');
          }
          break;
        }

        case 'send_message':
        case 'enviar_mensagem': {
          // ✅ Selecionar variação aleatória (se houver variações configuradas)
          const rawMessageText = selectMessageVariation(actionConfig);
          if (!rawMessageText) {
            console.warn('⚠️ [Time Automations] send_message sem mensagem configurada');
            actionSuccess = false;
            break;
          }

          if (!card.conversation_id) {
            console.error('❌ [Time Automations] Conversa não encontrada no card');
            actionSuccess = false;
            break;
          }

          // ✅ Verificar horário de funcionamento antes de enviar (a menos que ignore_business_hours esteja ativo)
          const workspaceId = (card as any).pipelines?.workspace_id;

          console.log('🕒 [Time Automations] Config horário de funcionamento:', {
            automation_id: automation?.id,
            ignore_business_hours: automation?.ignore_business_hours,
            shouldIgnoreBusinessHours
          });

          if (workspaceId && !shouldIgnoreBusinessHours) {
            const withinBusinessHours = await isWithinBusinessHours(workspaceId, supabase);
            if (!withinBusinessHours) {
              console.log(`🚫 [Time Automations] Mensagem bloqueada: fora do horário de funcionamento`);
              console.log(`   Workspace ID: ${workspaceId}`);
              console.log(`   Card ID: ${card.id}`);
              console.log(`   Mensagem não será enviada para evitar violação legal`);
              actionSuccess = false;
              break; // Sair do switch sem enviar
            }
            console.log(`✅ [Time Automations] Dentro do horário de funcionamento - prosseguindo com envio`);
          } else if (shouldIgnoreBusinessHours) {
            console.log(`⏰ [Time Automations] Automação configurada para ignorar horário de funcionamento - prosseguindo com envio`);
          } else {
            console.warn(`⚠️ [Time Automations] Workspace ID não encontrado - não é possível verificar horário de funcionamento`);
          }

          // ========== ENVIO DIRETO (BYPASS send-message para evitar 401 JWT) ==========
          // 1. Buscar dados da conversa (usando relacionamento explícito para evitar erro PGRST201)
          const { data: conversation, error: conversationError } = await supabase
            .from('conversations')
            .select(`
              id,
              workspace_id,
              connection_id,
              contact:contacts(id, phone, name, email),
              connection:connections!conversations_connection_id_fkey(id, instance_name, status)
            `)
            .eq('id', card.conversation_id)
            .single();

          if (conversationError || !conversation) {
            console.error('❌ [Time Automations] Conversa não encontrada:', conversationError);
            actionSuccess = false;
            break;
          }

          // Normalizar dados de join (Supabase pode retornar arrays)
          const connection = Array.isArray(conversation.connection) 
            ? conversation.connection[0] 
            : conversation.connection;
          const contact = Array.isArray(conversation.contact) 
            ? conversation.contact[0] 
            : conversation.contact;

          // ✅ Buscar nome da coluna e pipeline para substituição de variáveis
          let columnName = '';
          let pipelineName = '';
          try {
            if (card.column_id) {
              const { data: colData } = await supabase.from('pipeline_columns').select('name').eq('id', card.column_id).maybeSingle();
              columnName = colData?.name || '';
            }
            if (card.pipeline_id) {
              const { data: pipData } = await supabase.from('pipelines').select('name').eq('id', card.pipeline_id).maybeSingle();
              pipelineName = pipData?.name || '';
            }
          } catch (varErr) {
            console.warn('⚠️ [Time Automations] Erro ao buscar dados para variáveis de template:', varErr);
          }

          // ✅ Substituir variáveis de template
          const messageText = replaceMessageVariables(rawMessageText, contact, columnName, pipelineName);

          console.log(`📤 [Time Automations] Enviando mensagem para conversa ${card.conversation_id}`);
          console.log(`📤 [Time Automations] Conteúdo da mensagem: "${messageText}"`);

          // Validar conexão
          if (!connection || connection.status !== 'connected') {
            console.error('❌ [Time Automations] Conexão WhatsApp não está pronta:', {
              hasConnection: !!connection,
              status: connection?.status
            });
            actionSuccess = false;
            break;
          }

          // 2. Criar registro da mensagem no banco
          const requestId = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
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
                automation_id: automation?.id,
                created_at: new Date().toISOString(),
                source: 'time_automation'
              }
            })
            .select()
            .single();

          if (messageError || !message) {
            console.error('❌ [Time Automations] Erro ao criar mensagem:', messageError);
            actionSuccess = false;
            break;
          }

          console.log(`💾 [Time Automations] Mensagem criada no banco: ${message.id}`);

          // 3. Chamar message-sender diretamente (tem verify_jwt = false)
          const senderPayload = {
            messageId: message.id,
            phoneNumber: contact?.phone,
            content: messageText,
            messageType: 'text',
            evolutionInstance: connection.instance_name,
            conversationId: conversation.id,
            workspaceId: conversation.workspace_id,
            external_id: message.external_id
          };

          console.log(`🚀 [Time Automations] Chamando message-sender diretamente...`);

          const { data: senderResult, error: senderError } = await supabase.functions.invoke('message-sender', {
            body: senderPayload
          });

          if (senderError) {
            console.error('❌ [Time Automations] Erro no message-sender:', senderError);
            
            // Atualizar status da mensagem para erro
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

            actionSuccess = false;
          } else {
            // Sucesso - atualizar metadata da mensagem
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

            console.log(`✅ [Time Automations] Mensagem enviada com sucesso via ${senderResult?.method || 'message-sender'}`);
          }
          break;
        }

        case 'send_funnel': {
          console.log(`🎯 [Time Automations] ========== EXECUTANDO AÇÃO: ENVIAR FUNIL ==========`);

          const funnelId = actionConfig?.funnel_id;

          if (!funnelId) {
            console.warn(`⚠️ [Time Automations] Ação send_funnel não tem funnel_id configurado.`);
            actionSuccess = false;
            break;
          }

          // Buscar conversa do card
          let conversationId = card.conversation_id;

          // Se não tem conversa, tentar buscar por contact_id
          if (!conversationId && card.contact_id) {
            const workspaceId = (card as any).pipelines?.workspace_id;

            if (workspaceId) {
              const { data: existingConversation } = await supabase
                .from('conversations')
                .select('id, connection_id, workspace_id')
                .eq('contact_id', card.contact_id)
                .eq('workspace_id', workspaceId)
                .not('connection_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (existingConversation) {
                conversationId = existingConversation.id;
              }
            }
          }

          if (!conversationId) {
            console.warn(`⚠️ [Time Automations] Card não tem conversa associada. Não é possível enviar funil. Card ID: ${card.id}, Contact ID: ${card.contact_id}`);
            actionSuccess = false;
            break;
          }

          // Buscar o funil
          console.log(`🔍 [Time Automations] Buscando funil: ${funnelId}`);
          const { data: funnel, error: funnelError } = await supabase
            .from('quick_funnels')
            .select('*')
            .eq('id', funnelId)
            .single();

          if (funnelError || !funnel) {
            console.error(`❌ [Time Automations] Erro ao buscar funil:`, funnelError);
            actionSuccess = false;
            break;
          }

          console.log(`✅ [Time Automations] Funil encontrado: "${funnel.title}" com ${funnel.steps?.length || 0} steps`);

          if (!funnel.steps || funnel.steps.length === 0) {
            console.warn(`⚠️ [Time Automations] Funil ${funnelId} não tem steps configurados.`);
            actionSuccess = false;
            break;
          }

          // Ordenar steps por order
          const sortedSteps = [...funnel.steps].sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

          console.log(`📤 [Time Automations] Iniciando envio de ${sortedSteps.length} mensagens do funil...`);

          // ✅ Verificar horário de funcionamento antes de enviar funil (a menos que ignore_business_hours esteja ativo)
          const funnelWorkspaceId = (card as any).pipelines?.workspace_id;

          if (funnelWorkspaceId && !shouldIgnoreBusinessHours) {
            const withinBusinessHours = await isWithinBusinessHours(funnelWorkspaceId, supabase);
            if (!withinBusinessHours) {
              console.log(`🚫 [Time Automations] Funil bloqueado: fora do horário de funcionamento`);
              console.log(`   Workspace ID: ${funnelWorkspaceId}`);
              console.log(`   Card ID: ${card.id}`);
              console.log(`   Funil não será enviado para evitar violação legal`);
              actionSuccess = false;
              break; // Sair do switch sem enviar
            }
            console.log(`✅ [Time Automations] Dentro do horário de funcionamento - prosseguindo com envio do funil`);
          } else if (shouldIgnoreBusinessHours) {
            console.log(`⏰ [Time Automations] Automação configurada para ignorar horário de funcionamento - prosseguindo com envio do funil`);
          } else {
            console.warn(`⚠️ [Time Automations] Workspace ID não encontrado - não é possível verificar horário de funcionamento`);
          }

          // Processar cada step
          for (let i = 0; i < sortedSteps.length; i++) {
            const step = sortedSteps[i];
            console.log(`\n📨 [Time Automations] Processando step ${i + 1}/${sortedSteps.length}:`, {
              type: step.type,
              item_id: step.item_id,
              delay_seconds: step.delay_seconds
            });

            try {
              let messagePayload: any = null;

              // Buscar item de acordo com o tipo
              const normalizedType = step.type.toLowerCase();

              switch (normalizedType) {
                case 'message':
                case 'messages':
                case 'mensagens': {
                  const { data: message } = await supabase
                    .from('quick_messages')
                    .select('*')
                    .eq('id', step.item_id)
                    .single();

                  if (message) {
                    messagePayload = {
                      conversation_id: conversationId,
                      content: message.content,
                      message_type: 'text'
                    };
                  }
                  break;
                }

                case 'audio':
                case 'audios': {
                  const { data: audio } = await supabase
                    .from('quick_audios')
                    .select('*')
                    .eq('id', step.item_id)
                    .single();

                  if (audio) {
                    messagePayload = {
                      conversation_id: conversationId,
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
                  const { data: media } = await supabase
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
                      conversation_id: conversationId,
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
                  const { data: document } = await supabase
                    .from('quick_documents')
                    .select('*')
                    .eq('id', step.item_id)
                    .single();

                  if (document) {
                    messagePayload = {
                      conversation_id: conversationId,
                      content: document.title || '',
                      message_type: 'document',
                      file_url: document.file_url,
                      file_name: document.file_name || document.title || 'document.pdf'
                    };
                  }
                  break;
                }

                default:
                  console.error(`❌ [Time Automations] Tipo de step não reconhecido: "${step.type}"`);
              }

              if (!messagePayload) {
                console.error(`❌ [Time Automations] Falha ao criar payload para step ${i + 1}`);
                continue;
              }

              console.log(`📦 [Time Automations] Enviando mensagem ${i + 1}/${sortedSteps.length}...`);

              // Enviar mensagem
              const { error: stepError } = await supabase.functions.invoke('test-send-msg', {
                body: messagePayload
              });

              if (stepError) {
                console.error(`❌ [Time Automations] Erro ao enviar step ${i + 1}:`, stepError);
                continue;
              }

              console.log(`✅ [Time Automations] Mensagem ${i + 1}/${sortedSteps.length} enviada com sucesso`);

              // Aguardar delay antes do próximo step (se houver)
              if (step.delay_seconds && step.delay_seconds > 0 && i < sortedSteps.length - 1) {
                console.log(`⏳ [Time Automations] Aguardando ${step.delay_seconds} segundos antes do próximo step...`);
                await new Promise(resolve => setTimeout(resolve, step.delay_seconds * 1000));
              }

            } catch (stepError) {
              console.error(`❌ [Time Automations] Erro ao processar step ${i + 1}:`, stepError);
            }
          }

          console.log(`✅ [Time Automations] ========== FUNIL ENVIADO COM SUCESSO ==========`);
          break;
        }

        default:
          console.log(`⚠️ [Time Automations] Ação ${action.action_type} não implementada em time-based automations`);
      }
    } catch (actionError) {
      console.error(`❌ [Time Automations] Erro ao executar ação ${action.action_type}:`, actionError);
      actionSuccess = false;
    }
  }

  return actionSuccess;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json().catch(() => ({}));
    console.log('⏰ [Time Automations] ========== INICIANDO VERIFICAÇÃO ==========');
    console.log('⏰ [Time Automations] Request body:', JSON.stringify(requestBody, null, 2));
    console.log('⏰ [Time Automations] Timestamp:', new Date().toISOString());
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('⏰ [Time Automations] Supabase client criado');

    // Buscar todas as automações ativas com trigger de tempo
    console.log('🔍 [Time Automations] Buscando automações ativas com trigger de tempo...');
    
    const { data: automations, error: automationsError } = await supabase
      .from('crm_column_automations')
      .select(`
        id,
        column_id,
        workspace_id,
        name,
        is_active,
        ignore_business_hours,
        triggers:crm_column_automation_triggers!inner(
          trigger_type,
          trigger_config
        ),
        actions:crm_column_automation_actions(
          action_type,
          action_config,
          action_order
        )
      `)
      .eq('is_active', true)
      .in('triggers.trigger_type', ['time_in_column', 'tempo_na_coluna', 'scheduled_time']);

    if (automationsError) {
      console.error('❌ [Time Automations] Error fetching automations:', automationsError);
      console.error('❌ [Time Automations] Error details:', JSON.stringify(automationsError, null, 2));
      throw automationsError;
    }

    console.log(`📊 [Time Automations] Query executada. Resultado: ${automations?.length || 0} automações encontradas`);

    if (!automations || automations.length === 0) {
      console.log('✅ [Time Automations] Nenhuma automação de tempo ativa encontrada');
      console.log('💡 [Time Automations] Verifique se há automações criadas e se estão ativas');
      return new Response(
        JSON.stringify({ 
          message: 'No automations to process', 
          processed: 0,
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [Time Automations] ========== ${automations.length} AUTOMAÇÃO(ÕES) ENCONTRADA(S) ==========`);
    automations.forEach((auto, idx) => {
      console.log(`   ${idx + 1}. "${auto.name}" (ID: ${auto.id}, Coluna: ${auto.column_id}, Workspace: ${auto.workspace_id})`);
    });

    let totalProcessed = 0;

    // Processar cada automação
    for (const automation of automations) {
      try {
        const trigger = automation.triggers[0];
        const triggerConfig = typeof trigger.trigger_config === 'string' 
          ? JSON.parse(trigger.trigger_config) 
          : trigger.trigger_config;
        const triggerType = trigger?.trigger_type;

        if (triggerType === 'scheduled_time') {
          const scheduledConfig = triggerConfig || {};
          const scheduledTime = scheduledConfig.scheduled_time;
          const parsedTime = parseScheduledTime(scheduledTime);
          const timeZone = scheduledConfig.timezone || 'America/Sao_Paulo';

          if (!parsedTime) {
            console.warn(`⚠️ [Time Automations] scheduled_time inválido para automação ${automation.id}:`, scheduledTime);
            continue;
          }

          const now = new Date();
          const localTime = getLocalTimeInfo(now, timeZone);

          if (Array.isArray(scheduledConfig.days_of_week) && scheduledConfig.days_of_week.length > 0) {
            if (!scheduledConfig.days_of_week.includes(localTime.dayOfWeek)) {
              continue;
            }
          }

          if (localTime.hours !== parsedTime.hours || localTime.minutes !== parsedTime.minutes) {
            continue;
          }

          console.log(`🕐 [Time Automations] Horário agendado atingido (${scheduledTime}) para automação "${automation.name}" no fuso ${timeZone}`);

          const { data: scheduledCards, error: scheduledCardsError } = await supabase
            .from('pipeline_cards')
            .select(`
              id,
              column_id,
              moved_to_column_at,
              pipeline_id,
              contact_id,
              conversation_id,
              pipelines!inner(workspace_id)
            `)
            .eq('column_id', automation.column_id);

          if (scheduledCardsError) {
            console.error(`❌ [Time Automations] Erro ao buscar cards para scheduled_time ${automation.id}:`, scheduledCardsError);
            continue;
          }

          if (!scheduledCards || scheduledCards.length === 0) {
            continue;
          }

          for (const card of scheduledCards) {
            const { data: existingExecution, error: existingExecutionError } = await supabase
              .from('crm_automation_executions')
              .select('id, metadata, executed_at')
              .eq('automation_id', automation.id)
              .eq('card_id', card.id)
              .eq('column_id', automation.column_id)
              .maybeSingle();

            if (existingExecutionError) {
              console.error(`❌ [Time Automations] Erro ao checar execução para card ${card.id}:`, existingExecutionError);
            }

            const existingMetadata = existingExecution?.metadata || {};
            if (
              existingExecution &&
              existingMetadata?.scheduled_date === localTime.date &&
              existingMetadata?.scheduled_time === scheduledTime
            ) {
              continue;
            }

            // ========== LOCK: Registrar execução ANTES de processar (evita duplicatas) ==========
            const lockMetadata = {
              scheduled_time: scheduledTime,
              scheduled_date: localTime.date,
              timezone: timeZone,
              day_of_week: localTime.dayOfWeek,
              status: 'processing',
              lock_timestamp: new Date().toISOString()
            };

            let lockRecordId: string | null = null;

            if (existingExecution?.id) {
              // Atualizar registro existente como lock
              const { error: updateLockError } = await supabase
                .from('crm_automation_executions')
                .update({
                  executed_at: new Date().toISOString(),
                  execution_type: 'scheduled_time',
                  metadata: lockMetadata
                })
                .eq('id', existingExecution.id);

              if (updateLockError) {
                console.log(`⏭️ [Time Automations] Falha ao adquirir lock para card ${card.id}:`, updateLockError.message);
                continue;
              }
              lockRecordId = existingExecution.id;
            } else {
              // Inserir novo registro como lock
              const { data: newLock, error: insertLockError } = await supabase
                .from('crm_automation_executions')
                .insert({
                  automation_id: automation.id,
                  card_id: card.id,
                  column_id: automation.column_id,
                  execution_type: 'scheduled_time',
                  metadata: lockMetadata
                })
                .select('id')
                .single();

              if (insertLockError || !newLock) {
                console.log(`⏭️ [Time Automations] Card ${card.id} já está sendo processado (lock falhou):`, insertLockError?.message);
                continue;
              }
              lockRecordId = newLock.id;
            }

            // Verificar se somos o primeiro registro (proteção contra race condition)
            const { data: allScheduledExecs } = await supabase
              .from('crm_automation_executions')
              .select('id, executed_at')
              .eq('automation_id', automation.id)
              .eq('card_id', card.id)
              .eq('column_id', automation.column_id)
              .order('executed_at', { ascending: true })
              .limit(2);

            if (allScheduledExecs && allScheduledExecs.length > 1 && allScheduledExecs[0].id !== lockRecordId) {
              console.log(`⏭️ [Time Automations] Outra instância já processou card ${card.id} (race condition detectada)`);
              // Se criamos um registro novo (não era update), remover
              if (!existingExecution?.id && lockRecordId) {
                await supabase
                  .from('crm_automation_executions')
                  .delete()
                  .eq('id', lockRecordId);
              }
              continue;
            }

            console.log(`🔒 [Time Automations] Lock adquirido para scheduled_time card ${card.id}`);

            const actionSuccess = await executeAutomationActions(automation, card, supabase, supabaseKey);

            // Atualizar status final
            const finalMetadata = {
              ...lockMetadata,
              status: actionSuccess ? 'completed' : 'failed'
            };

            await supabase
              .from('crm_automation_executions')
              .update({ metadata: finalMetadata })
              .eq('id', lockRecordId);

            if (actionSuccess) {
              totalProcessed++;
              console.log(`✅ [Time Automations] Scheduled automation executed for card ${card.id}`);
            }
          }

          continue;
        }

        // Suportar tanto configuração nova (time_unit + time_value) quanto antiga (time_in_minutes)
        let timeInMinutes: number;
        let originalValue: number;
        let originalUnit: string;

        if (triggerConfig?.time_unit && triggerConfig?.time_value) {
          // Nova configuração com unidade
          originalValue = parseFloat(triggerConfig.time_value);
          originalUnit = triggerConfig.time_unit;
          timeInMinutes = convertToMinutes(originalValue, originalUnit);
          
          console.log(`🔍 [Time Automations] Trigger type found: "${trigger.trigger_type}"`);
          console.log(`🔍 [Time Automations] Automation "${automation.name}": ${originalValue} ${originalUnit} = ${timeInMinutes.toFixed(4)} minutes`);
        } else if (triggerConfig?.time_value) {
          // Configuração com time_value apenas (assume minutos)
          originalValue = parseFloat(triggerConfig.time_value);
          originalUnit = 'minutes';
          timeInMinutes = originalValue;
          
          console.log(`🔍 [Time Automations] Trigger type found: "${trigger.trigger_type}"`);
          console.log(`🔍 [Time Automations] Automation "${automation.name}": ${originalValue} minutes (time_value only)`);
        } else if (triggerConfig?.time_in_minutes) {
          // Configuração antiga em minutos
          timeInMinutes = triggerConfig.time_in_minutes;
          originalValue = timeInMinutes;
          originalUnit = 'minutes';
          
          console.log(`🔍 [Time Automations] Automation "${automation.name}": ${timeInMinutes} minutes (legacy format)`);
        } else {
          console.warn(`⚠️ [Time Automations] Invalid time config for automation ${automation.id}:`, triggerConfig);
          continue;
        }
        
        if (timeInMinutes <= 0) {
          console.warn(`⚠️ [Time Automations] Invalid time value (${timeInMinutes} minutes) for automation ${automation.id}`);
          continue;
        }

        // Buscar cards que estão na coluna há mais tempo que o configurado
        // e que ainda não tiveram essa automação executada
        const now = new Date();
        const timeThreshold = new Date(now.getTime() - (timeInMinutes * 60 * 1000));

        console.log(`🔍 [Time Automations] Current time: ${now.toISOString()}`);
        console.log(`🔍 [Time Automations] Time threshold: ${timeThreshold.toISOString()} (NOW - ${timeInMinutes.toFixed(4)} min)`);
        console.log(`🔍 [Time Automations] Looking for cards in column ${automation.column_id} moved before ${timeThreshold.toISOString()}`);
        console.log(`🔍 [Time Automations] Automation config: ${originalValue} ${originalUnit} = ${timeInMinutes.toFixed(4)} minutes`);

        const { data: eligibleCards, error: cardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id,
            column_id,
            moved_to_column_at,
            pipeline_id,
            contact_id,
            conversation_id,
            pipelines!inner(workspace_id)
          `)
          .eq('column_id', automation.column_id)
          .not('moved_to_column_at', 'is', null) // Garantir que moved_to_column_at não é NULL
          .lt('moved_to_column_at', timeThreshold.toISOString());

        console.log(`🔍 [Time Automations] Query result: ${eligibleCards?.length || 0} cards found, error: ${cardsError ? JSON.stringify(cardsError) : 'none'}`);

        if (cardsError) {
          console.error(`❌ [Time Automations] Error fetching cards for automation ${automation.id}:`, cardsError);
          continue;
        }

        if (!eligibleCards || eligibleCards.length === 0) {
          console.log(`✅ [Time Automations] No eligible cards for automation "${automation.name}"`);
          continue;
        }

        console.log(`📦 [Time Automations] Found ${eligibleCards.length} eligible cards for "${automation.name}"`);

        // Processar cada card elegível
        for (const card of eligibleCards) {
          console.log(`🔍 [Time Automations] Checking card ${card.id}:`);
          console.log(`   - moved_to_column_at: ${card.moved_to_column_at}`);
          console.log(`   - column_id: ${card.column_id}`);
          
          // Calcular tempo decorrido
          const movedAt = new Date(card.moved_to_column_at);
          const now = new Date();
          const elapsedMinutes = (now.getTime() - movedAt.getTime()) / (1000 * 60);
          console.log(`   - Tempo decorrido: ${elapsedMinutes.toFixed(2)} minutos (requerido: ${timeInMinutes.toFixed(2)})`);
          
          // Verificar se já executou essa automação para esse card neste período
          const { data: existingExecution, error: executionCheckError } = await supabase
            .from('crm_automation_executions')
            .select('id, executed_at')
            .eq('automation_id', automation.id)
            .eq('card_id', card.id)
            .eq('column_id', automation.column_id)
            .gte('executed_at', card.moved_to_column_at)
            .maybeSingle();

          if (executionCheckError) {
            console.error(`❌ [Time Automations] Error checking executions for card ${card.id}:`, executionCheckError);
          }

          if (existingExecution) {
            console.log(`⏭️ [Time Automations] Automation already executed for card ${card.id} at ${existingExecution.executed_at}`);
            continue;
          }

          // ========== LOCK: Registrar execução ANTES de processar (evita duplicatas) ==========
          const executionMetadata = {
            time_in_minutes: timeInMinutes,
            original_value: originalValue,
            original_unit: originalUnit,
            moved_to_column_at: card.moved_to_column_at,
            status: 'processing',
            lock_timestamp: new Date().toISOString()
          };

          const { data: lockRecord, error: lockError } = await supabase
            .from('crm_automation_executions')
            .insert({
              automation_id: automation.id,
              card_id: card.id,
              column_id: automation.column_id,
              execution_type: 'tempo_na_coluna',
              metadata: executionMetadata
            })
            .select('id')
            .single();

          if (lockError) {
            // Se falhou ao inserir, provavelmente já está sendo processado por outra instância
            console.log(`⏭️ [Time Automations] Card ${card.id} já está sendo processado (lock falhou):`, lockError.message);
            continue;
          }

          // Verificar se somos o primeiro registro (proteção contra race condition)
          const { data: allExecutions } = await supabase
            .from('crm_automation_executions')
            .select('id, executed_at')
            .eq('automation_id', automation.id)
            .eq('card_id', card.id)
            .eq('column_id', automation.column_id)
            .gte('executed_at', card.moved_to_column_at)
            .order('executed_at', { ascending: true })
            .limit(2);

          // Se há mais de um registro ou não somos o primeiro, outra instância ganhou a corrida
          if (allExecutions && allExecutions.length > 1 && allExecutions[0].id !== lockRecord.id) {
            console.log(`⏭️ [Time Automations] Outra instância já processou card ${card.id} (race condition detectada)`);
            // Remover nosso registro duplicado
            await supabase
              .from('crm_automation_executions')
              .delete()
              .eq('id', lockRecord.id);
            continue;
          }

          console.log(`🔒 [Time Automations] Lock adquirido para card ${card.id} (exec_id: ${lockRecord.id})`);
          console.log(`🎬 [Time Automations] Executing automation "${automation.name}" for card ${card.id}`);

          let actionSuccess = false;
          try {
            actionSuccess = await executeAutomationActions(automation, card, supabase, supabaseKey);
          } catch (actionError) {
            console.error(`❌ [Time Automations] Erro ao executar ações para o card ${card.id}:`, actionError);
            actionSuccess = false;
          }

          // Atualizar registro de execução com resultado
          const finalStatus = actionSuccess ? 'completed' : 'failed';
          await supabase
            .from('crm_automation_executions')
            .update({
              metadata: { ...executionMetadata, status: finalStatus }
            })
            .eq('id', lockRecord.id);

          if (actionSuccess) {
            totalProcessed++;
            console.log(`✅ [Time Automations] Automation executed successfully for card ${card.id}`);
          } else {
            console.error(`❌ [Time Automations] Failed to execute automation for card ${card.id}`);
          }
        }
      } catch (automationError) {
        console.error(`❌ [Time Automations] Error processing automation ${automation.id}:`, automationError);
      }
    }

    console.log(`✅ [Time Automations] Check completed. Processed ${totalProcessed} cards`);

    return new Response(
      JSON.stringify({ 
        message: 'Time-based automations processed', 
        processed: totalProcessed,
        automations_checked: automations.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [Time Automations] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
