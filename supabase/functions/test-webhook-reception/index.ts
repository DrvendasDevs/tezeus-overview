import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhook_url, webhook_secret, workspace_id } = await req.json();
    
    if (!webhook_url) {
      throw new Error('webhook_url is required');
    }
    
    console.log('🧪 Testing webhook URL:', webhook_url);
    console.log('🔑 Using secret:', webhook_secret ? 'Yes' : 'No');
    
    const testPayload = {
      type: 'test',
      timestamp: new Date().toISOString(),
      workspace_id: workspace_id,
      test: true,
      message: 'Test webhook from Tezeus CRM'
    };

    console.log('📤 Sending test payload:', JSON.stringify(testPayload));

    const startTime = Date.now();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (webhook_secret) {
      headers['X-Secret'] = webhook_secret;
    }
    
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload)
    });
    
    const endTime = Date.now();
    const latency = endTime - startTime;

    const responseText = await response.text().catch(() => '');
    console.log('📨 Response status:', response.status);
    console.log('📨 Response body:', responseText);

    // Initialize Supabase client to log the test
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log the test result to webhook_logs
    if (workspace_id) {
      await supabase.from('webhook_logs').insert({
        workspace_id: workspace_id,
        event_type: 'test',
        status: response.ok ? 'success' : 'error',
        payload_json: testPayload,
        response_status: response.status,
        response_body: responseText
      });
    }

    return new Response(JSON.stringify({
      success: response.ok,
      status: response.status,
      latency,
      response: responseText,
      url: webhook_url
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Test webhook error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});