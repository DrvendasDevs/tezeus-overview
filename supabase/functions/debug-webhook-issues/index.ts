import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const workspaceId = req.headers.get('x-workspace-id');
    
    if (!workspaceId) {
      return new Response('Workspace ID required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log('🔍 Debugging webhook issues for workspace:', workspaceId);

    // Check connections
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Check evolution config
    const { data: evolutionConfig, error: evolutionError } = await supabase
      .from('evolution_instance_tokens')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Check webhook settings
    const { data: webhookSettings, error: webhookError } = await supabase
      .from('workspace_webhook_settings')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Check environment variables
    const envConfig = {
      EVOLUTION_API_URL: Deno.env.get('EVOLUTION_API_URL'),
      EVOLUTION_URL: Deno.env.get('EVOLUTION_URL'),
      EVOLUTION_API_KEY: Deno.env.get('EVOLUTION_API_KEY') ? '***configured***' : 'missing',
      EVOLUTION_APIKEY: Deno.env.get('EVOLUTION_APIKEY') ? '***configured***' : 'missing',
      N8N_INBOUND_WEBHOOK_URL: Deno.env.get('N8N_INBOUND_WEBHOOK_URL') ? '***configured***' : 'missing'
    };

    const diagnosis = {
      workspace_id: workspaceId,
      connections: {
        count: connections?.length || 0,
        data: connections,
        error: connectionsError
      },
      evolution_config: {
        found: !!evolutionConfig,
        data: evolutionConfig,
        error: evolutionError
      },
      webhook_settings: {
        found: !!webhookSettings,
        data: webhookSettings,
        error: webhookError
      },
      environment: envConfig,
      timestamp: new Date().toISOString()
    };

    console.log('📋 Diagnosis results:', JSON.stringify(diagnosis, null, 2));

    return new Response(JSON.stringify(diagnosis, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error debugging webhook issues:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});