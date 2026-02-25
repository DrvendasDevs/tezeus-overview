import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      logo_url,
      favicon_url,
      background_color,
      primary_color,
      header_color,
      sidebar_color 
    } = await req.json()

    // Get user context from headers
    const userIdHeader = req.headers.get('x-system-user-id')
    const userEmailHeader = req.headers.get('x-system-user-email')

    if (!userIdHeader) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Set user context for RLS
    await supabase.rpc('set_current_user_context', {
      user_id: userIdHeader,
      user_email: userEmailHeader
    })

    console.log('🎨 Updating system customization...')
    console.log('📝 Data:', { logo_url, favicon_url, background_color, primary_color, header_color, sidebar_color })

    // Check if a record exists
    const { data: existing, error: selectError } = await supabase
      .from('system_customization')
      .select('id')
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ Error checking existing customization:', selectError)
      throw selectError
    }

    let result
    
    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('system_customization')
        .update({
          logo_url,
          background_color,
          favicon_url,
          primary_color,
          header_color,
          sidebar_color,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      result = { data, error }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('system_customization')
        .insert({
          logo_url,
          background_color,
          favicon_url,
          primary_color,
          header_color,
          sidebar_color
        })
        .select()
        .single()

      result = { data, error }
    }

    if (result.error) {
      console.error('❌ Error updating system customization:', result.error)
      throw result.error
    }

    console.log('✅ System customization updated successfully')

    return new Response(
      JSON.stringify(result.data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in update-system-customization:', error)
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