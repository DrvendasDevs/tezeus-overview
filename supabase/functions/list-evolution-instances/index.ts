import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Try multiple secret name variants
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') || Deno.env.get('EVOLUTION_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY') || Deno.env.get('EVOLUTION_APIKEY');

    console.log('Listando instâncias da Evolution API:', {
      url: evolutionApiUrl,
      hasApiKey: !!evolutionApiKey
    });

    if (!evolutionApiUrl || !evolutionApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciais da Evolution API não configuradas. Verifique EVOLUTION_API_URL e EVOLUTION_API_KEY.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper function to try both authentication methods
    async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
      if (!evolutionApiKey) {
        throw new Error('Evolution API key not configured');
      }
      
      // First try with apikey header
      let response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
          ...options.headers,
        },
      });

      // If unauthorized, try with Bearer token
      if (response.status === 401 || response.status === 403) {
        console.log('Primeira tentativa falhou, tentando com Bearer token...');
        response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${evolutionApiKey}`,
            ...options.headers,
          },
        });
      }

      return response;
    }

    // Listar todas as instâncias
    if (!evolutionApiUrl) {
      throw new Error('Evolution API URL not configured');
    }
    
    const instancesResponse = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/fetchInstances`, {
      method: 'GET',
    });

    const instancesText = await instancesResponse.text();
    console.log('Resposta da API:', {
      status: instancesResponse.status,
      statusText: instancesResponse.statusText,
      response: instancesText
    });

    let instancesData;
    try {
      instancesData = JSON.parse(instancesText);
    } catch (e) {
      instancesData = instancesText;
    }

    if (!instancesResponse.ok) {
      const errorMessage = instancesData?.message || instancesData?.error || instancesText || instancesResponse.statusText;
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao listar instâncias (${instancesResponse.status}): ${errorMessage}`,
        response: instancesData,
        statusCode: instancesResponse.status,
        evolutionResponse: instancesText
      }), {
        status: 200, // Return 200 so frontend can handle the error properly
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para cada instância, verificar o status de conexão
    const instancesWithStatus = [];
    
    if (Array.isArray(instancesData)) {
      for (const instance of instancesData) {
        try {
          const statusResponse = await makeAuthenticatedRequest(`${evolutionApiUrl}/instance/connectionState/${instance.instanceName || instance.name}`, {
            method: 'GET',
          });

          const statusText = await statusResponse.text();
          let statusData;
          try {
            statusData = JSON.parse(statusText);
          } catch (e) {
            statusData = statusText;
          }

          instancesWithStatus.push({
            ...instance,
            connectionStatus: statusResponse.ok ? statusData : 'Error checking status',
            statusCode: statusResponse.status
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          instancesWithStatus.push({
            ...instance,
            connectionStatus: `Error: ${errorMessage}`,
            statusCode: 'N/A'
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      instances: instancesWithStatus.length > 0 ? instancesWithStatus : instancesData,
      total: Array.isArray(instancesData) ? instancesData.length : 'N/A',
      rawResponse: instancesData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro ao listar instâncias:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});