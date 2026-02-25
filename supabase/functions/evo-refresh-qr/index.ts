import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
const EVOLUTION_APIKEY = Deno.env.get('EVOLUTION_APIKEY');
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { instance } = await req.json();
    
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Instance parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Refreshing QR for instance: ${instance}`);

    // Call Evolution API connect endpoint to get fresh QR code
    const evolutionResponse = await fetch(`${EVOLUTION_URL}/instance/connect/${instance}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_APIKEY!,
        'Content-Type': 'application/json',
      },
    });

    if (!evolutionResponse.ok) {
      console.error(`Evolution API error: ${evolutionResponse.status} ${evolutionResponse.statusText}`);
      return new Response(JSON.stringify({ error: 'Evolution API error' }), {
        status: evolutionResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await evolutionResponse.json();
    console.log(`QR refresh response for ${instance}:`, { hasCode: !!data.code, hasPairingCode: !!data.pairingCode });

    return new Response(JSON.stringify({
      code: data.code,
      pairingCode: data.pairingCode,
      count: data.count
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
    });
  } catch (error) {
    console.error('Error in evo-refresh-qr function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});