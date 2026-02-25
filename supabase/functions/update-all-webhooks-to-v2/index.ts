import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting webhook update to v2 for all instances...');
    
    // Get all evolution instance tokens
    const { data: instances, error: instancesError } = await supabase
      .from('evolution_instance_tokens')
      .select('*');

    if (instancesError) {
      throw new Error(`Failed to fetch instances: ${instancesError.message}`);
    }

    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No instances found to update',
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📊 Found ${instances.length} instances to update`);

    // Usa a URL do Supabase das variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não está configurada nas variáveis de ambiente');
    }
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook-v2`;
    const results = [];

    for (const instance of instances) {
      console.log(`🔧 Updating webhook for instance: ${instance.instance_name}`);
      
      try {
        const response = await fetch(`${instance.evolution_url}/webhook/set/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': instance.token
          },
          body: JSON.stringify({
            url: webhookUrl,
            webhook_by_events: true,
            webhook_base64: true,
            events: [
              'QRCODE_UPDATED',
              'CONNECTION_UPDATE',
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'SEND_MESSAGE'
            ]
          })
        });

        const responseText = await response.text();
        
        results.push({
          instance_name: instance.instance_name,
          success: response.ok,
          status: response.status,
          response: responseText,
          evolution_url: instance.evolution_url
        });

        console.log(`${response.ok ? '✅' : '❌'} Instance ${instance.instance_name}: ${response.status}`);
        
      } catch (error) {
        console.error(`❌ Error updating ${instance.instance_name}:`, error);
        results.push({
          instance_name: instance.instance_name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    console.log(`🎉 Update completed: ${successCount}/${instances.length} instances updated successfully`);

    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${successCount} of ${instances.length} instances to use evolution-webhook-v2`,
      webhook_url: webhookUrl,
      summary: {
        total: instances.length,
        successful: successCount,
        failed: instances.length - successCount
      },
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error updating webhooks:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});