import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('🔄 [Z-API Status] Payload recebido:', JSON.stringify(payload, null, 2));

    const { 
      workspace_id: workspaceId, 
      status: rawStatus, 
      phone,
      connection_id: connectionId,
      conversation_id: conversationId,  // ← ID da conversa (já vem no webhook N8N)
      external_id: externalIdFromBody,
      webhook_data: webhookData
    } = payload;

    // Validações
    if (!workspaceId || !rawStatus) {
      return new Response(JSON.stringify({ 
        error: 'workspace_id e status são obrigatórios' 
      }), {
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalizar status
    const normalizedStatus = rawStatus === 'received' ? 'delivered' : rawStatus.toLowerCase();
    console.log('📊 Status:', rawStatus, '->', normalizedStatus);

    // ============================================================
    // ✅ ESTRATÉGIA 0 (DETERMINÍSTICA): buscar por provider message id (Z-API ids[0])
    // ============================================================
    const providerExternalId: string | null =
      externalIdFromBody ||
      (Array.isArray(webhookData?.ids) ? webhookData.ids?.[0] : null) ||
      webhookData?.messageId ||
      payload?.messageId ||
      null;

    // 🎯 ESTRATÉGIA DE BUSCA POR TIMESTAMP
    console.log('🔍 Buscando mensagem para atualizar:', { 
      conversationId, 
      phone, 
      connectionId, 
      workspaceId, 
      status: normalizedStatus,
      providerExternalId
    });
    
    let message = null;
    let searchError = null;

    // ✅ Strategy 0: provider id saved at send-time (preferred)
    if (providerExternalId) {
      console.log('🔍 Strategy 0: Buscando por provider message id (external_id / evolution_key_id / metadata.provider_msg_id):', providerExternalId);

      // 0.1) Busca determinística principal: messages.external_id
      const { data: byExternalId, error: byExternalIdErr } = await supabase
        .from('messages')
        .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
        .eq('workspace_id', workspaceId)
        .eq('external_id', providerExternalId)
        .maybeSingle();

      if (byExternalIdErr) {
        searchError = byExternalIdErr;
      } else if (byExternalId) {
        message = byExternalId;
        searchError = null;
        console.log('✅ Mensagem encontrada por external_id (provider id):', message.id);
      }

      // 0.2) Compatibilidade: evolution_key_id
      if (!message) {
        const { data: byEvolutionKey, error: byEvolutionKeyErr } = await supabase
          .from('messages')
          .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
          .eq('workspace_id', workspaceId)
          .eq('evolution_key_id', providerExternalId)
          .maybeSingle();

        if (byEvolutionKeyErr) {
          searchError = byEvolutionKeyErr;
        } else if (byEvolutionKey) {
          message = byEvolutionKey;
          searchError = null;
          console.log('✅ Mensagem encontrada por evolution_key_id (provider id):', message.id);
        }
      }

      // 0.3) Compatibilidade: metadata.provider_msg_id
      if (!message) {
        const { data: byMetadataProviderId, error: byMetaErr } = await supabase
          .from('messages')
          .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
          .eq('workspace_id', workspaceId)
          // @ts-ignore - PostgREST JSON path filter
          .eq('metadata->>provider_msg_id', providerExternalId)
          .maybeSingle();

        if (byMetaErr) {
          searchError = byMetaErr;
        } else if (byMetadataProviderId) {
          message = byMetadataProviderId;
          searchError = null;
          console.log('✅ Mensagem encontrada por metadata.provider_msg_id (provider id):', message.id);
        }
      }
    }
    
    // ✅ ESTRATÉGIA 1: Buscar por conversation_id + timestamp (últimos 60 segundos)
    if (!message && conversationId) {
      console.log('🔍 Buscando por conversation_id + timestamp:', conversationId);
      
      // Determinar qual status buscar baseado no callback recebido
      let searchStatus: string | null = null;
      if (normalizedStatus === 'delivered') {
        searchStatus = 'sent';
      } else if (normalizedStatus === 'read') {
        searchStatus = 'delivered';
      } else if (normalizedStatus === 'sent') {
        searchStatus = 'sending';
      }
      
      console.log('🎯 Buscando mensagem com status:', searchStatus || 'qualquer');
      
      // Buscar em uma janela maior para suportar callbacks atrasados do provider.
      const lookback24h = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
      
      let query = supabase
        .from('messages')
        .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
        .eq('conversation_id', conversationId)
        .eq('workspace_id', workspaceId)
        .in('sender_type', ['user', 'agent', 'system'])
        .gte('created_at', lookback24h); // Últimas 24h
      
      // Filtrar pelo status anterior se definido
      if (searchStatus) {
        query = query.eq('status', searchStatus);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false }) // MAIS RECENTE PRIMEIRO
        .limit(1)
        .maybeSingle();
      
      message = data;
      searchError = error;
      
      if (message) {
        searchError = null;
        console.log('✅ Mensagem encontrada por conversation_id (fallback):', message.id);
      }
    }
    
    // ✅ FALLBACK 2: Buscar por phone + connection (legado)
    if (!message && phone && connectionId) {
      console.log('🔄 Fallback: Buscando por phone + connection');
      
      // Primeiro, buscar a conversa desse telefone nessa conexão
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('connection_id', connectionId)
        .eq('contact_id', (await supabase
          .from('contacts')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('phone', phone)
          .single()
        ).data?.id)
        .single();
      
      if (conversation) {
        // Determinar qual status buscar
        let searchStatus: string | null = null;
        if (normalizedStatus === 'delivered') {
          searchStatus = 'sent';
        } else if (normalizedStatus === 'read') {
          searchStatus = 'delivered';
        } else if (normalizedStatus === 'sent') {
          searchStatus = 'sending';
        }
        
        const lookback24h = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
        
        let query = supabase
          .from('messages')
          .select('id, external_id, status, delivered_at, read_at, content, created_at, sender_type, conversation_id')
          .eq('conversation_id', conversation.id)
          .eq('workspace_id', workspaceId)
          .in('sender_type', ['user', 'agent', 'system'])
          .gte('created_at', lookback24h);
        
        if (searchStatus) {
          query = query.eq('status', searchStatus);
        }
        
        const { data, error } = await query
          .order('created_at', { ascending: false }) // MAIS RECENTE PRIMEIRO
          .limit(1)
          .maybeSingle();
        
        message = data;
        searchError = error;
        
        if (message) {
          searchError = null;
          console.log('✅ Mensagem encontrada por phone + connection (fallback legado):', message.id);
        }
      }
    }

    if (searchError) {
      console.error('❌ Erro na busca:', searchError);
      return new Response(JSON.stringify({
        success: false,
        error: searchError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!message) {
      console.warn('⚠️ Nenhuma mensagem encontrada');
      
      // Debug completo: mostrar últimas 10 mensagens
      const { data: debugAll } = await supabase
        .from('messages')
        .select('id, status, sender_type, created_at, external_id, content, conversation_id')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      console.log('🔍 Últimas 10 mensagens do workspace:', JSON.stringify(debugAll, null, 2));
      console.log('🔍 Critérios de busca:', {
        conversationId,
        phone,
        connectionId,
        workspaceId,
        providerExternalId,
        strategy: 'provider_id (external_id/evolution_key_id/metadata.provider_msg_id) → conversation_id (24h) → phone+connection (24h)',
        sender_types: ['user', 'agent', 'system']
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada',
        debug: {
          search_criteria: {
            conversation_id: conversationId,
            phone,
            connection_id: connectionId,
            workspace_id: workspaceId,
            strategy: 'provider_id (external_id/evolution_key_id/metadata.provider_msg_id) → conversation_id (24h) → phone+connection (24h)',
            sender_types: ['user', 'agent', 'system']
          },
          last_messages: debugAll
        }
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Log detalhado da mensagem encontrada
    const ageSeconds = Math.floor((Date.now() - new Date(message.created_at).getTime()) / 1000);
    console.log('✅ Mensagem encontrada:', {
      id: message.id,
      external_id: message.external_id,
      current_status: message.status,
      sender_type: message.sender_type,
      created_at: message.created_at,
      age_seconds: ageSeconds,
      will_update_to: normalizedStatus
    });

    // Hierarquia de status: sending < sent < delivered < read
    const statusHierarchy: Record<string, number> = {
      'sending': 1,
      'sent': 2,
      'delivered': 3,
      'read': 4
    };

    const currentLevel = statusHierarchy[message.status] || 0;
    const newLevel = statusHierarchy[normalizedStatus] || 0;

    if (newLevel <= currentLevel) {
      console.log('⏩ Status não precisa ser atualizado:', {
        current: message.status,
        new: normalizedStatus,
        currentLevel,
        newLevel,
        reason: 'Status atual é igual ou superior'
      });
      
      return new Response(JSON.stringify({
        success: true,
        action: 'skipped',
        reason: 'Status já está atualizado ou superior',
        data: {
          id: message.id,
          status: message.status,
          delivered_at: message.delivered_at,
          read_at: message.read_at
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Preparar update
    const updateData: any = { status: normalizedStatus };

    if (normalizedStatus === 'delivered' && !message.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }
    
    if (normalizedStatus === 'read' && !message.read_at) {
      updateData.read_at = new Date().toISOString();
      // Se ainda não tem delivered_at, preencher também
      if (!message.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }
    }

    console.log('📝 Atualizando mensagem:', {
      id: message.id,
      updates: updateData
    });

    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', message.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: updateError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Mensagem atualizada com sucesso:', {
      id: updatedMessage.id,
      old_status: message.status,
      new_status: updatedMessage.status,
      delivered_at: updatedMessage.delivered_at,
      read_at: updatedMessage.read_at
    });

    return new Response(JSON.stringify({
      success: true,
      action: 'updated',
      data: {
        id: updatedMessage.id,
        status: updatedMessage.status,
        delivered_at: updatedMessage.delivered_at,
        read_at: updatedMessage.read_at
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
