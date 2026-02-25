import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')?.replace(/\/+$/, '');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const supabaseFunctionsWebhook = Deno.env.get('SUPABASE_FUNCTIONS_WEBHOOK');
    const evolutionWebhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');

    const tests = [];

    // Test 1: Check environment variables
    tests.push({
      test: 'Environment Variables',
      passed: !!(evolutionApiUrl && evolutionApiKey),
      details: {
        evolutionApiUrl: evolutionApiUrl ? `${evolutionApiUrl.substring(0, 20)}...` : 'NOT SET',
        evolutionApiKey: evolutionApiKey ? 'SET' : 'NOT SET',
        supabaseFunctionsWebhook: supabaseFunctionsWebhook ? 'SET' : 'NOT SET',
        evolutionWebhookSecret: evolutionWebhookSecret ? 'SET' : 'NOT SET'
      }
    });

    // Test 2: Evolution API connectivity
    let evolutionConnectivity = false;
    let evolutionError = null;
    
    if (evolutionApiUrl && evolutionApiKey) {
      try {
        const response = await fetch(`${evolutionApiUrl}/instance/fetchInstances`, {
          method: 'GET',
          headers: {
            'apikey': evolutionApiKey,
          },
        });
        
        evolutionConnectivity = response.ok;
        if (!response.ok) {
          const errorData = await response.text();
          evolutionError = `HTTP ${response.status}: ${errorData}`;
        }
      } catch (error) {
        evolutionError = error instanceof Error ? error.message : String(error);
      }
    } else {
      evolutionError = 'Missing API URL or Key';
    }

    tests.push({
      test: 'Evolution API Connectivity',
      passed: evolutionConnectivity,
      details: {
        url: evolutionApiUrl,
        error: evolutionError
      }
    });

    // Test 3: Webhook URL validation
    let webhookValid = false;
    let webhookError = null;

    if (supabaseFunctionsWebhook) {
      try {
        const webhookUrl = new URL(supabaseFunctionsWebhook);
        webhookValid = webhookUrl.protocol === 'https:' && webhookUrl.hostname.includes('supabase.co');
        if (!webhookValid) {
          webhookError = 'Webhook URL must be HTTPS and from supabase.co domain';
        }
      } catch (error) {
        webhookError = `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`;
      }
    } else {
      webhookError = 'Webhook URL not configured';
    }

    tests.push({
      test: 'Webhook URL Validation',
      passed: webhookValid,
      details: {
        url: supabaseFunctionsWebhook,
        error: webhookError
      }
    });

    const allTestsPassed = tests.every(test => test.passed);

    return new Response(JSON.stringify({
      success: allTestsPassed,
      timestamp: new Date().toISOString(),
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Test execution failed',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});