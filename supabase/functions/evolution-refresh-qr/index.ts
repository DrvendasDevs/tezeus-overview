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
    
    // Get workspace-specific configuration
    const { data: configData, error: configError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (configError) {
      console.log('⚠️ Error querying evolution_instance_tokens:', configError);
      throw new Error('Error getting workspace configuration');
    }

    if (!configData?.evolution_url || !configData?.token || configData.token === 'config_only') {
      console.error('❌ No valid workspace Evolution configuration found');
      throw new Error('Evolution API not configured for workspace. Please configure it in the Evolution settings.');
    }
    
    console.log('✅ Using workspace-specific Evolution config');
    return {
      url: configData.evolution_url,
      apiKey: configData.token
    }
  } catch (error) {
    console.error('Error getting Evolution config:', error)
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Evolution Refresh QR Function Started ===')
    const { connectionId } = await req.json()
    console.log('Connection ID:', connectionId)

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get connection details
    const { data: connection, error } = await supabase
      .from('connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (error || !connection) {
      console.error('Connection not found:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const evolutionConfig = await getEvolutionConfig(connection.workspace_id, supabase)

    console.log('Getting QR code for instance:', connection.instance_name)

    // Get QR code directly from the instance
    const qrResponse = await fetch(`${evolutionConfig.url}/instance/connect/${connection.instance_name}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionConfig.apiKey,
        'Content-Type': 'application/json'
      }
    })

    console.log('QR response status:', qrResponse.status)

    if (!qrResponse.ok) {
      const errorText = await qrResponse.text()
      console.error('Evolution QR API error:', errorText)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to get QR code: ${errorText}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const qrData = await qrResponse.json()
    console.log('QR response data:', qrData)

    // Extract QR code from response
    let extractedQRCode = null;
    
    if (qrData.base64) {
      extractedQRCode = qrData.base64;
    } else if (qrData.code) {
      extractedQRCode = qrData.code;
    } else if (qrData.qrcode) {
      if (typeof qrData.qrcode === 'string') {
        extractedQRCode = qrData.qrcode;
      } else if (qrData.qrcode.base64) {
        extractedQRCode = qrData.qrcode.base64;
      } else if (qrData.qrcode.code) {
        extractedQRCode = qrData.qrcode.code;
      }
    }
    
    if (!extractedQRCode) {
      console.error('No QR code found in response:', qrData)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'QR Code não encontrado na resposta da API' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure QR code is properly formatted as data URL
    if (!extractedQRCode.startsWith('data:image/')) {
      extractedQRCode = `data:image/png;base64,${extractedQRCode}`;
    }

    // Update connection with QR code
    await supabase
      .from('connections')
      .update({ 
        qr_code: extractedQRCode,
        status: 'qr',
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id)

    console.log('QR code refreshed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        qr_code: extractedQRCode
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error refreshing QR code:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})