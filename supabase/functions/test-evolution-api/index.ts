import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { testUrl, testApiKey } = await req.json()

    if (!testUrl || !testApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'testUrl and testApiKey are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🧪 Testing Evolution API connection...')
    console.log('🔗 URL:', testUrl)

    // Test connection to Evolution API
    const testResponse = await fetch(`${testUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': testApiKey
      }
    })

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.error('❌ Evolution API test failed:', testResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection failed: ${testResponse.status} - ${errorText}`,
          status: testResponse.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const responseData = await testResponse.json()
    console.log('✅ Evolution API test successful')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Connection successful',
        data: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error testing Evolution API:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})