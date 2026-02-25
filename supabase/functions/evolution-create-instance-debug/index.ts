import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

console.log('🚀 DEBUG Function loaded')

serve(async (req) => {
  console.log('🔥 DEBUG FUNCTION CALLED');
  console.log('🔥 Method:', req.method);
  console.log('🔥 URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('⚡ CORS preflight in debug');
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('✅ Starting debug process...');
    
    // Test basic JSON parsing
    let body;
    try {
      body = await req.json();
      console.log('✅ JSON parsed successfully:', body);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'JSON parse failed', details: (parseError as Error).message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Test Supabase client initialization
    console.log('🔧 Testing Supabase client...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('📝 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client created');

    // Test database connection
    try {
      const { data: testData, error: testError } = await supabase
        .from('workspaces')
        .select('id')
        .limit(1);
      
      console.log('📊 Database test result:', { 
        hasData: !!testData, 
        hasError: !!testError,
        errorMessage: testError?.message
      });
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Debug function working correctly',
        receivedBody: body,
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!supabaseUrl,
          hasSupabaseKey: !!supabaseServiceKey
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Debug function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Debug function failed',
        message: (error as Error).message,
        stack: (error as Error).stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})