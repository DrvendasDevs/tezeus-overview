import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { action } = await req.json();
    
    if (action === 'preview') {
      // Preview what would be fixed
      console.log('🔍 Previewing phone number fixes...');
      
      const { data: preview, error: previewError } = await supabase
        .rpc('fix_phone_numbers_from_remote_jid');
      
      if (previewError) {
        console.error('❌ Error previewing fixes:', previewError);
        throw previewError;
      }
      
      console.log(`📊 Found ${preview?.length || 0} contacts to fix`);
      
      return new Response(JSON.stringify({
        success: true,
        action: 'preview',
        contacts_to_fix: preview?.length || 0,
        preview_data: preview || []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else if (action === 'fix') {
      // Actually fix the phone numbers
      console.log('🔧 Starting phone number fixes...');
      
      const { data: updatedCount, error: fixError } = await supabase
        .rpc('update_fixed_phone_numbers');
      
      if (fixError) {
        console.error('❌ Error fixing phone numbers:', fixError);
        throw fixError;
      }
      
      console.log(`✅ Updated ${updatedCount} contacts`);
      
      return new Response(JSON.stringify({
        success: true,
        action: 'fix',
        contacts_updated: updatedCount,
        message: `Successfully updated ${updatedCount} contacts with corrected phone numbers`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } else {
      return new Response(JSON.stringify({
        error: 'Invalid action. Use "preview" or "fix"'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in fix-phone-numbers function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});