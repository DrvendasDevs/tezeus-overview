import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Auto Create Pipeline Card Function Started');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      conversationId, 
      contactId, 
      workspaceId, 
      pipelineId 
    } = await req.json();

    console.log('📋 Request data:', {
      conversationId,
      contactId,
      workspaceId,
      pipelineId
    });

    // Verificar se já existe um card para esta conversa
    const { data: existingCard } = await supabase
      .from('pipeline_cards')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingCard) {
      console.log('⚠️ Card já existe para esta conversa:', existingCard.id);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Card já existe para esta conversa',
          cardId: existingCard.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conexão da conversa (para vincular ao card)
    let connectionId: string | null = null;
    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id, connection_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversation?.connection_id) {
        connectionId = conversation.connection_id;
      }
    }

    // Buscar informações do contato
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('❌ Erro ao buscar contato:', contactError);
      throw new Error('Contato não encontrado');
    }

    // Buscar a primeira coluna do pipeline
    const { data: columns, error: columnsError } = await supabase
      .from('pipeline_columns')
      .select('id, name')
      .eq('pipeline_id', pipelineId)
      .order('order_position', { ascending: true })
      .limit(1);

    if (columnsError || !columns || columns.length === 0) {
      console.error('❌ Erro ao buscar colunas do pipeline:', columnsError);
      throw new Error('Pipeline não possui colunas configuradas');
    }

    const firstColumn = columns[0];
    console.log('📍 Primeira coluna encontrada:', firstColumn);

    // Criar o card automaticamente
    const { data: newCard, error: cardError } = await supabase
      .from('pipeline_cards')
      .insert({
        pipeline_id: pipelineId,
        column_id: firstColumn.id,
        conversation_id: conversationId,
        contact_id: contactId,
        connection_id: connectionId,
        title: contact.name || contact.phone || 'Contato sem nome',
        description: 'Card criado automaticamente via mensagem',
        value: 0,
        status: 'aberto',
        tags: []
      })
      .select('*')
      .single();

    if (cardError) {
      console.error('❌ Erro ao criar card:', cardError);
      throw new Error('Erro ao criar card no pipeline');
    }

    console.log('✅ Card criado com sucesso:', newCard);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Card criado automaticamente',
        card: newCard
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na função auto-create-pipeline-card:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});