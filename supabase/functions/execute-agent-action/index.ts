import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      params, 
      contactId, 
      conversationId,
      workspaceId 
    } = await req.json();

    console.log('⚡ Executando ação:', action, params);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let result: any = { success: false };
    const effectiveConversationId = params?.conversation_id || conversationId || null;
    let effectiveConnectionId: string | null = params?.connection_id || null;

    if (!effectiveConnectionId && effectiveConversationId) {
      const { data: convInfo } = await supabase
        .from('conversations')
        .select('connection_id')
        .eq('id', effectiveConversationId)
        .maybeSingle();

      if (convInfo?.connection_id) {
        effectiveConnectionId = convInfo.connection_id;
      }
    }

    switch (action) {
      case 'add-tag': {
        // Adicionar tag usando o ID direto
        const { error: tagError } = await supabase
          .from('contact_tags')
          .insert({
            contact_id: params.contact_id,
            tag_id: params.tag_id
          });

        if (tagError && !tagError.message.includes('duplicate')) {
          throw tagError;
        }

        result = { 
          success: true, 
          message: `Tag "${params.tag_name}" adicionada ao contato`,
          tagId: params.tag_id
        };
        console.log('✅ Tag adicionada:', params.tag_name);
        break;
      }

      case 'transfer-queue': {
        // Chamar função de atribuição que aplica todas as regras da fila
        const { data: assignmentResult, error: assignError } = await supabase.functions.invoke(
          'assign-conversation-to-queue',
          {
            body: {
              conversation_id: params.conversation_id,
              queue_id: params.fila_id
            }
          }
        );

        if (assignError) throw assignError;
        
        if (!assignmentResult?.success) {
          throw new Error(assignmentResult?.error || 'Erro ao transferir para fila');
        }

        result = { 
          success: true, 
          message: `Conversa transferida para fila com regras aplicadas`,
          queueId: params.fila_id,
          assignmentDetails: assignmentResult
        };
        
        console.log('✅ Transferido para fila com regras aplicadas:', assignmentResult);
        break;
      }

      case 'transfer-connection': {
        // Atualizar conversa para transferir para conexão
        const { error: convError } = await supabase
          .from('conversations')
          .update({ 
            connection_id: params.conection_id,
            assigned_user_id: null,
            status: 'open'
          })
          .eq('id', params.contact_id);

        if (convError) throw convError;

        result = { 
          success: true, 
          message: `Conversa transferida para conexão "${params.conection_name}"`,
          connectionId: params.conection_id
        };
        console.log('✅ Transferido para conexão:', params.conection_name);
        break;
      }

      case 'create-card': {
        // Verificar se já existe card aberto para este contato neste pipeline
        let existingCardQuery = supabase
          .from('pipeline_cards')
          .select('id')
          .eq('contact_id', params.contact_id)
          .eq('pipeline_id', params.pipeline_id)
          .eq('status', 'aberto');

        if (effectiveConnectionId) {
          existingCardQuery = existingCardQuery.eq('connection_id', effectiveConnectionId);
        }

        const { data: existingCard } = await existingCardQuery.maybeSingle();

        if (existingCard) {
          result = {
            success: true,
            message: 'Card já existe para este contato',
            cardId: existingCard.id,
            alreadyExists: true
          };
          console.log('ℹ️ Card já existe');
          break;
        }

        // Buscar nome do contato
        const { data: contact } = await supabase
          .from('contacts')
          .select('name')
          .eq('id', params.contact_id)
          .single();

        // Criar card
        const { data: newCard, error: cardError } = await supabase
          .from('pipeline_cards')
          .insert({
            pipeline_id: params.pipeline_id,
            column_id: params.coluna_id,
            contact_id: params.contact_id,
            conversation_id: effectiveConversationId,
            connection_id: effectiveConnectionId,
            title: `Card - ${contact?.name || 'Cliente'}`,
            status: 'aberto'
          })
          .select()
          .single();

        if (cardError) throw cardError;

        result = { 
          success: true, 
          message: `Card CRM criado`,
          cardId: newCard.id
        };
        console.log('✅ Card CRM criado:', newCard.id);
        break;
      }

      case 'transfer-column': {
        // Buscar o card do contato neste pipeline
        let cardQuery = supabase
          .from('pipeline_cards')
          .select('id')
          .eq('contact_id', params.contact_id)
          .eq('pipeline_id', params.pipeline_id)
          .eq('status', 'aberto');

        if (effectiveConnectionId) {
          cardQuery = cardQuery.eq('connection_id', effectiveConnectionId);
        }

        const { data: card } = await cardQuery.maybeSingle();

        if (!card) {
          throw new Error('Card não encontrado para este contato no pipeline');
        }

        // Atualizar coluna do card
        const { error: updateError } = await supabase
          .from('pipeline_cards')
          .update({ 
            column_id: params.coluna_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', card.id);

        if (updateError) throw updateError;

        result = { 
          success: true, 
          message: `Card transferido para nova coluna`,
          cardId: card.id
        };
        console.log('✅ Card transferido para coluna:', params.coluna_id);
        break;
      }

      case 'save-info': {
        // Salvar/atualizar informação adicional do contato
        const { error: infoError } = await supabase
          .from('contact_extra_info')
          .upsert({
            contact_id: params.contact_id,
            workspace_id: params.workspace_id,
            field_name: params.field_name,
            field_value: params.field_value
          }, {
            onConflict: 'contact_id,workspace_id,field_name'
          });

        if (infoError) throw infoError;

        result = { 
          success: true, 
          message: `Informação "${params.field_name}" salva com valor "${params.field_value}"`,
          key: params.field_name,
          value: params.field_value
        };
        console.log('✅ Info salva:', params.field_name, '=', params.field_value);
        break;
      }

      default:
        throw new Error(`Ação "${action}" não suportada`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro execute-agent-action:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
