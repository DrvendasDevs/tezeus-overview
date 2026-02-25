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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔧 Starting webhook setup for all instances...');

    // Get all connections with their secrets
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        workspace_id,
        metadata,
        connection_secrets (
          token,
          evolution_url
        )
      `);

    if (connectionsError) {
      console.error('Error fetching connections:', connectionsError);
      return new Response('Error fetching connections', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const webhookUrl = `${publicAppUrl}/functions/v1/evolution-webhook-v2`;
    const results = [];

    for (const connection of connections) {
      console.log(`🔧 Setting up webhook for instance: ${connection.instance_name}`);
      
      // Normalize joined data (Supabase may return arrays for joins)
      const secrets = Array.isArray(connection.connection_secrets) 
        ? connection.connection_secrets[0] 
        : connection.connection_secrets;
      
      if (!secrets?.token || !secrets?.evolution_url) {
        console.log(`⚠️ Skipping ${connection.instance_name} - missing credentials`);
        results.push({
          instance: connection.instance_name,
          status: 'skipped',
          reason: 'Missing credentials'
        });
        continue;
      }

      try {
        // Configure webhook in Evolution API
        const evolutionResponse = await fetch(
          `${secrets.evolution_url}/webhook/set/${connection.instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': secrets.token
            },
            body: JSON.stringify({
              url: webhookUrl,
              webhook_by_events: true,
              webhook_base64: true,
              // CRITICAL: Evolution API usa eventos em minúsculas com pontos quando configurados via /webhook/set
              events: [
                'qrcode.updated',      // QR Code atualizado
                'connection.update',   // Status da conexão
                'messages.upsert',     // ← CRÍTICO: Mensagens recebidas do WhatsApp
                'messages.update',     // Status de mensagens (lido, entregue)
                'send.message'         // Mensagens enviadas
              ]
            })
          }
        );

        if (evolutionResponse.ok) {
          const evolutionResult = await evolutionResponse.json();
          console.log(`✅ Webhook configured for ${connection.instance_name}`);
          
          // Update metadata in database
          const updatedMetadata = {
            ...connection.metadata,
            webhook_configured: true,
            webhook_url: webhookUrl,
            webhook_configured_at: new Date().toISOString()
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
            status: 'success',
            webhook_url: webhookUrl,
            evolution_response: evolutionResult
          });
        } else {
          const errorText = await evolutionResponse.text();
          console.error(`❌ Failed to configure webhook for ${connection.instance_name}: ${errorText}`);
          results.push({
            instance: connection.instance_name,
            status: 'error',
            error: `Evolution API error: ${evolutionResponse.status} - ${errorText}`
          });
        }
      } catch (error) {
        console.error(`❌ Error configuring webhook for ${connection.instance_name}:`, error);
        results.push({
          instance: connection.instance_name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log('✅ Webhook setup completed');

    return new Response(JSON.stringify({
      success: true,
      webhook_url: webhookUrl,
      results: results,
      summary: {
        total: connections.length,
        success: results.filter(r => r.status === 'success').length,
        errors: results.filter(r => r.status === 'error').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error setting up webhooks:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});