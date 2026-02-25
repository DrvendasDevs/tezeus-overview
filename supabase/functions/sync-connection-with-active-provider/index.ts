import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, workspaceId } = await req.json();
    
    console.log(`🔄 Syncing connection ${connectionId} with active provider`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get active provider for workspace
    const { data: provider, error: providerError } = await supabase
      .from('whatsapp_providers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (providerError || !provider) {
      throw new Error(`No active provider found: ${providerError?.message}`);
    }

    console.log(`✅ Found active provider: ${provider.provider}`);

    // Update connection with provider_id
    const { error: updateError } = await supabase
      .from('connections')
      .update({ 
        provider_id: provider.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    if (updateError) {
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    console.log(`✅ Connection updated with provider_id: ${provider.id}`);

    // If Z-API, configure webhooks
    if (provider.provider === 'zapi' && provider.zapi_url && provider.zapi_token) {
      console.log(`📡 Configuring Z-API webhooks...`);
      
      const { data: connection } = await supabase
        .from('connections')
        .select('instance_name')
        .eq('id', connectionId)
        .single();

      if (!connection) {
        throw new Error('Connection not found');
      }

      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/zapi-webhook`;
      const zapiBaseUrl = provider.zapi_url;
      const instanceId = connection.instance_name;

      // Configure all Z-API webhooks
      const webhooks = [
        { event: 'status', endpoint: '/update-webhook-status' },
        { event: 'received', endpoint: '/update-webhook-received' },
        { event: 'delivery', endpoint: '/update-webhook-delivery' },
        { event: 'disconnected', endpoint: '/update-webhook-disconnected' },
        { event: 'connected', endpoint: '/update-webhook-connected' },
        { event: 'chatPresence', endpoint: '/update-webhook-chat-presence' }
      ];

      const results = [];
      for (const webhook of webhooks) {
        try {
          const response = await fetch(`${zapiBaseUrl}/${instanceId}${webhook.endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': provider.zapi_client_token!
            },
            body: JSON.stringify({
              value: webhookUrl
            })
          });

          const result = await response.json();
          results.push({ event: webhook.event, success: response.ok, result });
          console.log(`${response.ok ? '✅' : '❌'} ${webhook.event}: ${JSON.stringify(result)}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`❌ Failed to configure ${webhook.event}:`, error);
          results.push({ event: webhook.event, success: false, error: errorMsg });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Connection synced and Z-API webhooks configured',
        provider: provider.provider,
        webhooks: results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Connection synced with provider',
      provider: provider.provider
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
