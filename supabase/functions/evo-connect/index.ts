import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL');
const EVOLUTION_APIKEY = Deno.env.get('EVOLUTION_APIKEY');
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL');

const corsHeaders = {
  'Access-Control-Allow-Origin': PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Simple rate limiting in memory
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `${ip}`;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const limit = rateLimitMap.get(key);
  if (now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  limit.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const instance = url.searchParams.get('instance');
    
    if (!instance) {
      return new Response(JSON.stringify({ error: 'Instance parameter required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Connecting instance: ${instance}`);

    // Proxy to Evolution API
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
    console.log(`Connect response for ${instance}:`, { hasCode: !!data.code, hasPairingCode: !!data.pairingCode });

    return new Response(JSON.stringify(data), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
    });
  } catch (error) {
    console.error('Error in evo-connect function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});