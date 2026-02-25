import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const publicAppUrl = Deno.env.get('PUBLIC_APP_URL');

if (!supabaseUrl || !serviceRoleKey || !publicAppUrl) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function generateRequestId(): string {
  return `fix_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`🔧 [${requestId}] Starting webhook configuration fix...`);

    // Get all active connections with their secrets
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        workspace_id,
        status,
        metadata,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .neq('status', 'deleted');

    if (connectionsError) {
      console.error(`❌ [${requestId}] Error fetching connections:`, connectionsError);
      return new Response('Error fetching connections', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`📋 [${requestId}] Found ${connections.length} connections to fix`);

    // Our webhook URL (Supabase function that routes to N8N) - Use v2 for proper message routing
    const correctWebhookUrl = `${publicAppUrl}/functions/v1/evolution-webhook-v2`;
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const connection of connections) {
      const instanceId = `${connection.instance_name}_${Date.now()}`;
      console.log(`🔧 [${requestId}] Processing instance: ${connection.instance_name}`);
      
      // Check if we have the necessary credentials
      const secrets = connection.connection_secrets as any;
      if (!secrets?.token || !secrets?.evolution_url) {
        console.log(`⚠️ [${requestId}] Skipping ${connection.instance_name} - missing credentials`);
        results.push({
          instance: connection.instance_name,
          status: 'skipped',
          reason: 'Missing credentials or connection secrets'
        });
        skippedCount++;
        continue;
      }

      try {
        // Configure webhook in Evolution API to point to our Supabase function
        console.log(`🔧 [${requestId}] Setting webhook for ${connection.instance_name} to: ${correctWebhookUrl}`);
        
        const evolutionResponse = await fetch(
          `${secrets.evolution_url}/webhook/set/${connection.instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': secrets.token
            },
            body: JSON.stringify({
              url: correctWebhookUrl,
              webhook_by_events: false,
              events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE', 
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'SEND_MESSAGE'
              ]
            })
          }
        );

        if (evolutionResponse.ok) {
          const evolutionResult = await evolutionResponse.json();
          console.log(`✅ [${requestId}] Webhook configured for ${connection.instance_name}`);
          
          // Update connection metadata to track the fix
          const updatedMetadata = {
            ...connection.metadata,
            webhook_configured: true,
            webhook_url: correctWebhookUrl,
            webhook_fixed_at: new Date().toISOString(),
            webhook_configuration_source: 'fix-webhook-configuration'
          };

          await supabase
            .from('connections')
            .update({ 
              metadata: updatedMetadata,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          results.push({
            instance: connection.instance_name,
            workspace_id: connection.workspace_id,
            status: 'success',
            webhook_url: correctWebhookUrl,
            evolution_response: evolutionResult
          });
          successCount++;
        } else {
          const errorText = await evolutionResponse.text();
          console.error(`❌ [${requestId}] Failed to configure webhook for ${connection.instance_name}: ${errorText}`);
          results.push({
            instance: connection.instance_name,
            workspace_id: connection.workspace_id,
            status: 'error',
            error: `Evolution API error: ${evolutionResponse.status} - ${errorText}`
          });
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error configuring webhook for ${connection.instance_name}:`, error);
        results.push({
          instance: connection.instance_name,
          workspace_id: connection.workspace_id,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
        errorCount++;
      }

      // Small delay to avoid overwhelming the Evolution API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ [${requestId}] Webhook configuration fix completed`);
    console.log(`📊 [${requestId}] Summary: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook configuration fix completed',
      correct_webhook_url: correctWebhookUrl,
      results: results,
      summary: {
        total: connections.length,
        success: successCount,
        errors: errorCount,
        skipped: skippedCount
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error fixing webhook configuration:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});