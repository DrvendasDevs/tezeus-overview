import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const systemUserId = req.headers.get('x-system-user-id');
    const body = await req.json();
    const { connectionId } = body;
    
    console.log('🔄 Setting default connection for user:', systemUserId, 'connection:', connectionId);
    
    if (!systemUserId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User authentication required (x-system-user-id header missing)' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!connectionId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Connection ID is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify connection exists and get instance name
    const { data: connectionData, error: connectionError } = await supabase
      .from('connections')
      .select('instance_name, workspace_id')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connectionData) {
      console.error('Connection not found:', connectionError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Connection not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Instead of updating a single user, we'll store this as the workspace default
    // This will be used for users who don't have a specific connection assigned
    // For now, we'll update the current user as requested, but this could be expanded
    // to a workspace-level default connection setting
    
    // Update user's default channel
    const { error: updateError } = await supabase
      .from('system_users')
      .update({ default_channel: connectionId })
      .eq('id', systemUserId);

    if (updateError) {
      console.error('Error updating default channel:', updateError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update default connection' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Default connection set successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `${connectionData.instance_name} defined as default connection`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error setting default connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})