import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Evolution API configuration from workspace settings
async function getEvolutionConfig(workspaceId: string, supabase: any) {
  try {
    console.log('🔧 Getting Evolution config for workspace:', workspaceId);
    
    const { data: configData, error: configError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (configError) {
      console.log('⚠️ Error querying evolution_instance_tokens:', configError);
      throw configError;
    }

    if (!configData?.evolution_url || !configData?.token || configData.token === 'config_only') {
      throw new Error('Evolution API not configured for workspace. Please configure URL and API key in Evolution settings.');
    }
    
    console.log('✅ Using workspace-specific Evolution config');
    return {
      url: configData.evolution_url,
      apiKey: configData.token
    };
  } catch (error) {
    console.error('Error getting Evolution config:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { connectionId, instanceName } = await req.json()

    if (!connectionId && !instanceName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID or instance name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get connection details
    let query = supabase.from('connections').select('*')
    
    if (connectionId) {
      query = query.eq('id', connectionId)
    } else {
      query = query.eq('instance_name', instanceName)
    }

    const { data: connection, error } = await query.single()

    if (error || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Evolution config for this connection's workspace
    const evolutionConfig = await getEvolutionConfig(connection.workspace_id, supabase)

    if (!evolutionConfig.apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution API key not configured for workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Evolution API to get QR code - try the connect endpoint first
    let qrResponse = await fetch(`${evolutionConfig.url}/instance/connect/${connection.instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionConfig.apiKey
      }
    })

    // If connect fails, try fetchInstance endpoint
    if (!qrResponse.ok) {
      console.log('Connect endpoint failed, trying fetchInstance...')
      qrResponse = await fetch(`${evolutionConfig.url}/instance/fetchInstance/${connection.instance_name}`, {
        method: 'GET',
        headers: {
          'apikey': evolutionConfig.apiKey
        }
      })
    }

    console.log('Evolution QR API response status:', qrResponse.status)

    if (!qrResponse.ok) {
      // Handle errors as text instead of JSON to prevent parsing issues
      const errorText = await qrResponse.text()
      console.error('Evolution API error response:', errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Evolution API error (${qrResponse.status}): ${errorText}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const qrData = await qrResponse.json()
    console.log('Evolution QR API response data:', qrData)
    
    // Extract QR code from response
    const extractedQRCode = qrData.qrcode?.base64 || qrData.qrcode?.code || qrData.qrcode || qrData.qr;
    
    if (!extractedQRCode) {
      console.error('No QR code found in Evolution API response:', qrData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'QR Code não encontrado na resposta da API Evolution' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Update connection with new QR code
    await supabase
      .from('connections')
      .update({ 
        qr_code: extractedQRCode,
        status: 'qr',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: extractedQRCode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error getting QR code:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})