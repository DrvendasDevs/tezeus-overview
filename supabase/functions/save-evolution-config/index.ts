import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workspaceId, evolutionUrl, evolutionApiKey } = await req.json()

    if (!workspaceId || !evolutionUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: workspaceId, evolutionUrl, and evolutionApiKey are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔧 Saving Evolution config for workspace:', workspaceId)
    console.log('🔗 URL:', evolutionUrl)

    // Upsert the configuration
    const { data, error } = await supabase
      .from('evolution_instance_tokens')
      .upsert(
        {
          workspace_id: workspaceId,
          instance_name: '_master_config',
          evolution_url: evolutionUrl.trim(),
          token: evolutionApiKey.trim(),
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'workspace_id,instance_name'
        }
      )
      .select()

    if (error) {
      console.error('Error saving evolution config:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Evolution config saved successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Evolution API configuration saved successfully',
        data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error saving evolution config:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})