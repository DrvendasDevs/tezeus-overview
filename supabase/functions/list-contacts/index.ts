import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get search query from URL params
    const url = new URL(req.url)
    const searchQuery = url.searchParams.get('q')

    // Build contacts query
    let contactsQuery = supabase
      .from('contacts')
      .select(`
        id,
        name,
        phone,
        email,
        created_at,
        profile_image_url,
        extra_info
      `)
      .order('created_at', { ascending: false })

    // Add search filter if provided
    if (searchQuery) {
      contactsQuery = contactsQuery.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
    }

    const { data: contacts, error: contactsError } = await contactsQuery

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch contacts' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch tags for all contacts
    const contactIds = contacts?.map(c => c.id) || []
    
    let contactsWithTags = contacts || []
    
    if (contactIds.length > 0) {
      const { data: contactTags, error: tagsError } = await supabase
        .from('contact_tags')
        .select(`
          contact_id,
          tags (
            id,
            name,
            color
          )
        `)
        .in('contact_id', contactIds)

      if (!tagsError && contactTags) {
        // Map tags to contacts
        contactsWithTags = contacts.map(contact => {
          const tags = contactTags
            .filter(ct => ct.contact_id === contact.id)
            .map(ct => ct.tags)
            .filter(Boolean)
          
          return {
            ...contact,
            tags
          }
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        contacts: contactsWithTags 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})