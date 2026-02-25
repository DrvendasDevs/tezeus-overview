import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
const publicAppUrl = Deno.env.get('PUBLIC_APP_URL');

if (!supabaseUrl || !serviceRoleKey || !evolutionApiUrl || !evolutionApiKey || !publicAppUrl) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function generateRequestId(): string {
  return `config_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log(`🔧 [${requestId}] Configure Evolution webhook started`);
    
    const data = await req.json();
    const { instance_name, workspace_id, webhookUrl: customWebhookUrl, events: customEvents } = data;
    
    if (!instance_name) {
      console.error(`❌ [${requestId}] Missing instance_name`);
      return new Response('Missing instance_name', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`🔧 [${requestId}] Configuring webhook for instance: ${instance_name}`);

    // Get instance connection details
    const { data: connectionData, error: connectionError } = await supabase
      .from('connections')
      .select('id, workspace_id, metadata')
      .eq('instance_name', instance_name)
      .maybeSingle();

    if (connectionError || !connectionData) {
      console.error(`❌ [${requestId}] Connection not found:`, connectionError);
      return new Response('Connection not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const workspaceToUse = workspace_id || connectionData.workspace_id;

    // Get Evolution API token for this connection
    const { data: tokenData, error: tokenError } = await supabase
      .from('connection_secrets')
      .select('token, evolution_url')
      .eq('connection_id', connectionData.id)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error(`❌ [${requestId}] Connection secret not found:`, tokenError);
      return new Response('Connection secret not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Configure webhook in Evolution API - Use v2 for proper message routing
    const webhookUrl = customWebhookUrl || `${publicAppUrl}/functions/v1/evolution-webhook-v2`;
    
    // CRITICAL: Evolution API usa eventos em minúsculas com pontos!
    const events = customEvents || [
      'qrcode.updated',
      'connection.update', 
      'messages.upsert',    // ← ESTE é o evento de mensagens recebidas!
      'messages.update'     // ← Este é só para status (lido, entregue)
    ];
    
    console.log(`🔧 [${requestId}] Setting webhook URL: ${webhookUrl}`);
    console.log(`🔧 [${requestId}] Setting events: ${events.join(', ')}`);
    
    const evolutionResponse = await fetch(`${tokenData.evolution_url}/webhook/set/${instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': tokenData.token
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        webhook_base64: true,
        events: events
      })
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error(`❌ [${requestId}] Evolution API error: ${evolutionResponse.status} - ${errorText}`);
      return new Response('Failed to configure webhook in Evolution API', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const evolutionResult = await evolutionResponse.json();
    console.log(`✅ [${requestId}] Webhook configured successfully:`, evolutionResult);

    // Update connection to mark webhook as configured
    await supabase
      .from('connections')
      .update({ 
        metadata: { 
          ...(connectionData.metadata || {}), 
          webhook_configured: true,
          webhook_url: webhookUrl,
          webhook_configured_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionData.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook configured successfully',
      webhook_url: webhookUrl,
      instance: instance_name,
      evolution_response: evolutionResult
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error configuring webhook:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});