// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch update of profile images');
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all contacts without profile images or with old images (more than 7 days)
    const { data: contacts, error: fetchError } = await supabaseClient
      .from('contacts')
      .select('id, phone, name, profile_image_url, profile_image_updated_at')
      .or('profile_image_url.is.null,profile_image_updated_at.lt.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('Error fetching contacts:', fetchError);
      throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
    }

    console.log(`Found ${contacts?.length || 0} contacts to update`);

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No contacts need profile image updates',
        updated: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let successCount = 0;
    let errorCount = 0;

    // Process contacts in batches to avoid overwhelming the API
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      if (!contact.phone) {
        console.log(`Skipping contact ${contact.name} - no phone number`);
        continue;
      }

      try {
        console.log(`Processing contact ${i + 1}/${contacts.length}: ${contact.name} (${contact.phone})`);
        
        // Call the fetch-whatsapp-profile function
        const { data, error } = await supabaseClient.functions.invoke('fetch-whatsapp-profile', {
          body: { phone: contact.phone }
        });

        if (error) {
          console.error(`Error updating profile for ${contact.phone}:`, error);
          errorCount++;
        } else {
          console.log(`Successfully processed ${contact.phone}`);
          successCount++;
        }

        // Add delay between requests to avoid rate limiting
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`Exception updating profile for ${contact.phone}:`, error);
        errorCount++;
      }
    }

    console.log(`Batch update completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({
      message: 'Batch update completed',
      totalProcessed: contacts.length,
      successful: successCount,
      errors: errorCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Batch update error:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});