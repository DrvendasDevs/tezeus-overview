import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Criar cliente Supabase no escopo global da função
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { instanceName, workspaceId, historyDays, historyRecovery } = await req.json();
    
    console.log('🔄 Triggering history sync:', { instanceName, workspaceId, historyDays, historyRecovery });
    
    // Buscar config da Evolution
    const { data: evolutionToken, error: tokenError } = await supabase
      .from('evolution_instance_tokens')
      .select('token, evolution_url')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .single();
    
    if (tokenError || !evolutionToken) {
      throw new Error(`Evolution token not found: ${tokenError?.message}`);
    }
    
    console.log('📡 Evolution config found:', { url: evolutionToken.evolution_url });
    
    // ✅ Evolution API usa /chat/findMessages para buscar histórico completo
    // historyDays/historyRecovery são APENAS para metadata no banco (uso no frontend)
    const findMessagesUrl = `${evolutionToken.evolution_url}/chat/findMessages/${instanceName}`;
    
    console.log('🌐 Calling Evolution API (findMessages):', findMessagesUrl);
    console.log('📋 Note: historyDays is stored in DB for UI filtering only');
    
    // Buscar TODAS as mensagens (sem filtro de data)
    const response = await fetch(findMessagesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionToken.token
      },
      body: JSON.stringify({
        where: {}  // ✅ Sem filtro = retorna tudo
      })
    });
    
    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status} - ${response.statusText}`);
    }
    
    const responseData = await response.json();
    console.log('📥 Evolution API response:', { 
      status: response.status,
      hasMessages: responseData?.messages ? true : false,
      messageCount: responseData?.messages?.records ? responseData.messages.records.length : 0,
      totalPages: responseData?.messages?.pages || 0
    });
    
    // ✅ Evolution retorna formato: { messages: { total, pages, records: [...] } }
    const messages = responseData?.messages?.records || [];
    
    if (messages.length > 0) {
      console.log(`📊 Found ${messages.length} historical messages to process`);
      
      // ✅ Atualizar status para 'syncing'
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'syncing',
          history_sync_started_at: new Date().toISOString()
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
    } else {
      // Se não há mensagens, marcar como completo imediatamente
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'completed',
          history_sync_completed_at: new Date().toISOString(),
          history_messages_synced: 0
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No historical messages found',
        processed: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Processar cada mensagem retornada
    let processedCount = 0;
    let errorCount = 0;
    
    for (const msg of messages) {
      try {
        // Enviar para o webhook v2 processar
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook-v2`;
        
        const webhookPayload = {
          event: 'messages.upsert',
          instance: instanceName,
          data: {
            key: msg.key,
            pushName: msg.pushName,
            message: msg.message,
            messageType: msg.messageType,
            messageTimestamp: msg.messageTimestamp,
            status: msg.status || 'SENT'
          },
          destination: msg.key?.remoteJid,
          date_time: new Date(msg.messageTimestamp * 1000).toISOString(),
          sender: msg.key?.fromMe ? instanceName : msg.key?.remoteJid,
          server_url: evolutionToken.evolution_url,
          apikey: evolutionToken.token
        };
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? ''
          },
          body: JSON.stringify(webhookPayload)
        });
        
        processedCount++;
        
        // Log progresso a cada 100 mensagens
        if (processedCount % 100 === 0) {
          console.log(`⏳ Progress: ${processedCount}/${messages.length} messages processed`);
        }
      } catch (error) {
        console.error(`❌ Error processing historical message:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ History sync completed: ${processedCount} processed, ${errorCount} errors`);
    
    // Atualizar status final
    await supabase
      .from('connections')
      .update({
        history_sync_status: 'completed',
        history_sync_completed_at: new Date().toISOString(),
        history_messages_synced: processedCount
      })
      .eq('instance_name', instanceName)
      .eq('workspace_id', workspaceId);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'History sync completed',
      processed: processedCount,
      errors: errorCount,
      total: messages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error triggering history sync:', error);
    
    // Marcar sync como falho no banco
    try {
      const { instanceName, workspaceId } = await req.json();
      await supabase
        .from('connections')
        .update({
          history_sync_status: 'failed',
          history_sync_completed_at: new Date().toISOString()
        })
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId);
  } catch (updateError) {
    console.error('Failed to update error status:', updateError);
  }
  
  return new Response(JSON.stringify({ 
    error: error instanceof Error ? error.message : 'Unknown error',
    success: false
  }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
});
