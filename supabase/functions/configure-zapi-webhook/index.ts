import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id",
};

// Função para normalizar status do Z-API
function normalizeZapiStatus(zapiStatus: string): string {
  const statusMap: Record<string, string> = {
    'SENT': 'sent',
    'DELIVERED': 'delivered', 
    'READ': 'read',
    'FAILED': 'failed',
    'PENDING': 'sending'
  };
  
  return statusMap[zapiStatus] || zapiStatus.toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      instanceName, 
      connectionId, 
      webhookType = "all", 
      customUrl 
    } = await req.json();

    console.log('📡 [configure-zapi-webhook] Configurando webhooks Z-API', {
      instanceName,
      connectionId,
      webhookType,
      customUrl
    });

    // 1. Buscar dados da conexão
    let query = supabase
      .from("connections")
      .select(`
        id,
        instance_name,
        metadata,
        provider:whatsapp_providers!connections_provider_id_fkey(
          id,
          provider,
          zapi_url,
          zapi_token,
          zapi_client_token
        )
      `);

    if (connectionId) {
      query = query.eq('id', connectionId);
    } else if (instanceName) {
      query = query.or(`instance_name.eq.${instanceName},metadata->>instanceId.eq.${instanceName}`);
    } else {
      throw new Error('Forneça instanceName ou connectionId');
    }

    const { data: connection, error: connError } = await query.maybeSingle();

    if (connError || !connection) {
      console.error('❌ Erro ao buscar conexão:', connError);
      throw new Error('Conexão não encontrada');
    }

    // 2. Validar se é Z-API
    const provider = Array.isArray(connection.provider) ? connection.provider[0] : connection.provider;
    
    if (!provider || provider.provider !== 'zapi') {
      throw new Error('Esta conexão não usa Z-API como provedor');
    }

    // 3. Extrair credenciais
    const instanceId = connection.metadata?.instanceId || 
                       connection.metadata?.instance_id ||
                       connection.instance_name;
    
    const instanceToken = connection.metadata?.token || 
                         connection.metadata?.instanceToken;
    
    const clientToken = provider.zapi_client_token;
    const zapiUrl = provider.zapi_url || 'https://api.z-api.io';

    if (!instanceId || !instanceToken || !clientToken) {
      console.error('❌ Credenciais faltando:', { instanceId, instanceToken, clientToken });
      throw new Error('Credenciais Z-API incompletas');
    }

    console.log('✅ Credenciais encontradas:', {
      instanceId,
      zapiUrl,
      hasToken: !!instanceToken,
      hasClientToken: !!clientToken
    });

    // 4. Definir URL do webhook (padrão ou custom)
    const webhookUrl = customUrl || `${supabaseUrl}/functions/v1/zapi-webhook`;

    // 5. Endpoints do Z-API para configurar
    const webhookEndpoints: Record<string, string> = {
      'status': 'update-webhook-status',
      'received': 'update-webhook-received', 
      'delivery': 'update-webhook-delivery',
      'disconnected': 'update-webhook-disconnected',
      'connected': 'update-webhook-connected',
      'chatPresence': 'update-webhook-chat-presence'
    };

    // 6. Configurar webhooks
    const results: any[] = [];
    const endpointsToConfig = webhookType === 'all' 
      ? Object.entries(webhookEndpoints)
      : [[webhookType, webhookEndpoints[webhookType]]];

    for (const [type, endpoint] of endpointsToConfig) {
      try {
        const url = `${zapiUrl}/instances/${instanceId}/token/${instanceToken}/${endpoint}`;
        
        console.log(`📡 Configurando webhook ${type}:`, url);

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': clientToken
          },
          body: JSON.stringify({
            value: webhookUrl
          })
        });

        const result = await response.json();
        
        results.push({
          type,
          endpoint,
          success: response.ok,
          status: response.status,
          data: result
        });

        if (!response.ok) {
          console.error(`❌ Erro ao configurar webhook ${type}:`, result);
        } else {
          console.log(`✅ Webhook ${type} configurado com sucesso`);
        }
      } catch (error) {
        console.error(`❌ Exceção ao configurar webhook ${type}:`, error);
        results.push({
          type,
          endpoint,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 7. Atualizar metadata da conexão
    const successCount = results.filter(r => r.success).length;
    
    if (successCount > 0) {
      const { error: updateError } = await supabase
        .from('connections')
        .update({
          metadata: {
            ...connection.metadata,
            webhook_configured: true,
            webhook_configured_at: new Date().toISOString(),
            webhook_url: webhookUrl,
            webhook_results: results
          }
        })
        .eq('id', connection.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar metadata:', updateError);
      }
    }

    // 8. Retornar resultado
    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `${successCount} de ${results.length} webhooks configurados com sucesso`,
        webhookUrl,
        results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: successCount > 0 ? 200 : 500
      }
    );

  } catch (error) {
    console.error('❌ Erro na configuração de webhooks:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
