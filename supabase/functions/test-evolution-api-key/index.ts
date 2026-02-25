import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { evolutionUrl, apiKey } = await req.json()
    
    console.log('🧪 Testing Evolution API key...')
    console.log('🔗 URL:', evolutionUrl)
    console.log('🔑 API Key length:', apiKey?.length)

    // Test the API key with fetchInstances
    const testUrl = `${evolutionUrl.endsWith('/') ? evolutionUrl.slice(0, -1) : evolutionUrl}/instance/fetchInstances`
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    })

    console.log('📊 Response status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ API Key is valid')
      console.log('📋 Instances found:', data?.length || 0)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'API Key is valid',
          instancesCount: data?.length || 0,
          instances: data || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const errorText = await response.text()
      console.error('❌ API Key test failed:', response.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `API Key inválida ou sem permissões (Status ${response.status})`,
          details: errorText,
          suggestions: [
            'Verifique se a API Key está correta',
            'Confirme se a API Key tem permissões para acessar instâncias',
            'Verifique se a URL da Evolution API está correta'
          ]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Test error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro ao testar conexão com Evolution API',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})