import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      contactId, 
      conversationId, 
      workspaceId,
      pipelineId,
      connectionPhone = null,
      connectionId = null
    } = await req.json();

    console.log('🎯 Smart Pipeline Card Manager - Início', { 
      contactId, 
      conversationId, 
      workspaceId,
      pipelineId 
    });

    // 1. Buscar informações do contato
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('❌ Contato não encontrado:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validar identificador do contato (phone > email)
    const identifier = contact.phone || contact.email;
    if (!identifier) {
      console.warn('⚠️ Contato sem identificador válido (phone ou email)');
      return new Response(
        JSON.stringify({ 
          error: 'Contato sem identificador válido',
          message: 'Por favor, adicione telefone ou email ao contato'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Determinar o pipeline a usar
    let targetPipelineId = pipelineId;
    
    if (!targetPipelineId) {
      // Buscar o primeiro pipeline ativo do workspace
      const { data: pipelines, error: pipelineError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at')
        .limit(1);

      if (pipelineError || !pipelines || pipelines.length === 0) {
        console.error('❌ Nenhum pipeline ativo encontrado:', pipelineError);
        return new Response(
          JSON.stringify({ error: 'Nenhum pipeline ativo encontrado no workspace' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      targetPipelineId = pipelines[0].id;
    }

    console.log('📋 Pipeline alvo:', targetPipelineId);

    // Resolver connection_id (prioridade: body.connectionId > conversation.connection_id)
    let effectiveConnectionId: string | null = connectionId;
    if (!effectiveConnectionId && conversationId) {
      const { data: conversationInfo } = await supabase
        .from('conversations')
        .select('connection_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversationInfo?.connection_id) {
        effectiveConnectionId = conversationInfo.connection_id;
      }
    }

    // 4. VERIFICAR SE JÁ EXISTE UM CARD ABERTO PARA ESTE CONTATO NESTE PIPELINE
    const { data: existingCards, error: searchError } = await supabase
      .from('pipeline_cards')
      .select(`
        id,
        title,
        description,
        responsible_user_id,
        updated_at,
        connection_id,
        conversation:conversation_id (
          id,
          connection_phone
        )
      `)
      .eq('contact_id', contactId)
      .eq('pipeline_id', targetPipelineId)
      .eq('status', 'aberto');

    if (searchError) {
      console.error('❌ Erro ao buscar cards existentes:', searchError);
    }

    // REGRA: Apenas UM card aberto por contato por pipeline
    // Se já existe, RETORNAR ERRO amigável
    let filteredCards = existingCards || [];

    if (effectiveConnectionId) {
      filteredCards = filteredCards.filter(card => card.connection_id === effectiveConnectionId);
    } else if (connectionPhone) {
      filteredCards = filteredCards.filter(card => {
        const cardPhone = card.conversation?.[0]?.connection_phone;
        return !cardPhone || cardPhone === connectionPhone;
      });
    }

    if (filteredCards.length > 0) {
      const existingCard = filteredCards[0];
      console.log('⚠️ Já existe um card aberto para este contato neste pipeline:', existingCard.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'duplicate_open_card',
          message: 'Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.',
          existingCard: {
            id: existingCard.id,
            title: existingCard.title
          }
        }),
        { 
          status: 409, // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 5. Se não existe card neste pipeline, criar um novo
    console.log('📝 Criando novo card para este pipeline...');

    // Buscar primeira coluna do pipeline
    const { data: columns, error: columnsError } = await supabase
      .from('pipeline_columns')
      .select('id')
      .eq('pipeline_id', targetPipelineId)
      .order('order_position')
      .limit(1);

    if (columnsError || !columns || columns.length === 0) {
      console.error('❌ Nenhuma coluna encontrada:', columnsError);
      return new Response(
        JSON.stringify({ error: 'Pipeline sem colunas configuradas' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar responsável da conversa
    let responsibleUserId = null;
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('assigned_user_id, connection_id')
        .eq('id', conversationId)
        .single();

      if (conversation?.assigned_user_id) {
        responsibleUserId = conversation.assigned_user_id;
      }
      if (!effectiveConnectionId && conversation?.connection_id) {
        effectiveConnectionId = conversation.connection_id;
      }
    }

    // Criar card
    const cardTitle = contact.name || contact.phone || contact.email || 'Contato sem nome';
    const timestamp = new Date().toLocaleString('pt-BR');
    
    const { data: newCard, error: createError } = await supabase
      .from('pipeline_cards')
      .insert({
        pipeline_id: targetPipelineId,
        column_id: columns[0].id,
        contact_id: contactId,
        conversation_id: conversationId,
        connection_id: effectiveConnectionId,
        responsible_user_id: responsibleUserId,
        title: cardTitle,
        description: `[${timestamp}] Card criado automaticamente`,
        value: 0,
        status: 'aberto',
        tags: []
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar card:', createError);
      
      // Verificar se é erro do trigger de validação
      if (createError.message?.includes('Já existe um card aberto')) {
        return new Response(
          JSON.stringify({ 
            error: 'duplicate_open_card',
            message: 'Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.'
          }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao criar novo card', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Card criado com sucesso:', newCard);

    return new Response(
      JSON.stringify({ 
        card: newCard,
        action: 'created',
        message: 'Novo card criado no pipeline'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
