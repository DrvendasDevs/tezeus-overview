import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { instance_name } = await req.json();
    
    if (!instance_name) {
      return new Response('Missing instance_name', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Get connection details
    const { data: connectionData, error: connectionError } = await supabase
      .from('connections')
      .select('id, metadata')
      .eq('instance_name', instance_name)
      .maybeSingle();

    if (connectionError || !connectionData) {
      return new Response('Connection not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Get connection secret for API access
    const { data: secretData, error: secretError } = await supabase
      .from('connection_secrets')
      .select('token, evolution_url')
      .eq('connection_id', connectionData.id)
      .maybeSingle();

    if (secretError || !secretData) {
      return new Response('Connection secret not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Check webhook configuration in Evolution API
    const evolutionResponse = await fetch(`${secretData.evolution_url}/webhook/find/${instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': secretData.token
      }
    });

    let webhookConfig = null;
    if (evolutionResponse.ok) {
      webhookConfig = await evolutionResponse.json();
    }

    return new Response(JSON.stringify({
      instance_name,
      webhook_configured_in_db: !!connectionData.metadata?.webhook_configured,
      webhook_config_in_evolution: webhookConfig,
      evolution_url: secretData.evolution_url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking webhook config:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});