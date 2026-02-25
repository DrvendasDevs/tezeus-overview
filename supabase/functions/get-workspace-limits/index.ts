import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workspaceId } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId is required');
    }

    console.log('📊 Getting limits for workspace:', workspaceId);

    // Get workspace limits configuration
    const { data: limitsData, error: limitsError } = await supabase
      .from('workspace_limits')
      .select('connection_limit, user_limit, disparador_enabled')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (limitsError && limitsError.code !== 'PGRST116') {
      console.error('Error fetching limits config:', limitsError);
      throw limitsError;
    }

    console.log('📊 Limits config:', limitsData);

    // Count connections
    const { count: connectionsCount, error: connectionsError } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);

    if (connectionsError) {
      console.error('Error counting connections:', connectionsError);
      throw connectionsError;
    }

    console.log('📊 Connections count:', connectionsCount);

    // Count users (excluding masters)
    const { count: usersCount, error: usersError } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .neq('role', 'master');

    if (usersError) {
      console.error('Error counting users:', usersError);
      throw usersError;
    }

    console.log('📊 Users count:', usersCount);

    return new Response(
      JSON.stringify({
        connectionLimit: limitsData?.connection_limit ?? 0,
        userLimit: limitsData?.user_limit ?? 0,
        disparadorEnabled: limitsData?.disparador_enabled ?? true,
        connectionsCount: connectionsCount || 0,
        usersCount: usersCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})