import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    console.log('🎨 Getting system customization settings...')

    // Get the customization settings (should only be one record)
    const { data: customization, error } = await supabase
      .from('system_customization')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('❌ Error fetching system customization:', error)
      // Return defaults on any error
      return new Response(
        JSON.stringify({
          logo_url: null,
          background_color: '#f5f5f5',
          primary_color: '#eab308',
          header_color: '#ffffff',
          sidebar_color: '#fafafa'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If no customization exists, return defaults
    if (!customization) {
      console.log('📋 No customization found, returning defaults')
      return new Response(
        JSON.stringify({
          logo_url: null,
          background_color: '#f5f5f5',
          primary_color: '#eab308',
          header_color: '#ffffff',
          sidebar_color: '#fafafa'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ System customization retrieved successfully')

    return new Response(
      JSON.stringify(customization),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in get-system-customization:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})