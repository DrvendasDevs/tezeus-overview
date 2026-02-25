import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fetchContactProfileImage(contactId: string, phone: string, workspaceId: string) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    contactId,
    phone,
    workspaceId,
    steps: [] as string[],
    success: false,
    profileImageUrl: null,
    errors: [] as string[]
  };

  try {
    // Step 1: Check if contact exists
    debugInfo.steps.push("1. Checking if contact exists");
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, phone, profile_image_url, profile_image_updated_at')
      .eq('id', contactId)
      .single();

    if (contactError) {
      debugInfo.errors.push(`Contact not found: ${contactError.message}`);
      return debugInfo;
    }

    debugInfo.steps.push(`✅ Contact found: ${contact.name} (${contact.phone})`);
    if (contact.profile_image_url) {
      debugInfo.steps.push(`📸 Current profile image: ${contact.profile_image_url}`);
      debugInfo.steps.push(`🕒 Last updated: ${contact.profile_image_updated_at}`);
    } else {
      debugInfo.steps.push("📸 No current profile image");
    }

    // Step 2: Get workspace connection data
    debugInfo.steps.push("2. Getting workspace connection data");
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        status,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'connected');

    if (connectionsError || !connections || connections.length === 0) {
      debugInfo.errors.push(`No connected instances found for workspace: ${connectionsError?.message || 'No connections'}`);
      return debugInfo;
    }

    debugInfo.steps.push(`✅ Found ${connections.length} connected instances`);

    // Step 3: Try to fetch profile from each connection
    for (const connection of connections) {
      if (!connection.connection_secrets?.[0]) {
        debugInfo.steps.push(`⚠️ No secrets for instance ${connection.instance_name}`);
        continue;
      }

      const { token, evolution_url } = connection.connection_secrets[0];
      debugInfo.steps.push(`3. Trying to fetch profile from ${connection.instance_name} (${evolution_url})`);

      try {
        const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${connection.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': token
          },
          body: JSON.stringify({
            number: phone.replace(/\D/g, '')
          })
        });

        debugInfo.steps.push(`📡 API response status: ${profileResponse.status}`);

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          debugInfo.steps.push(`✅ Profile data received: ${JSON.stringify(profileData, null, 2)}`);
          
          const profileImageUrl = profileData?.profilePictureUrl || profileData?.picture;
          
          if (profileImageUrl) {
            debugInfo.steps.push(`🖼️ Found profile image URL: ${profileImageUrl}`);
            debugInfo.profileImageUrl = profileImageUrl;

            // Step 4: Try to download and save the image
            debugInfo.steps.push("4. Downloading and saving image");
            const { data: updateResult, error: updateError } = await supabase.functions.invoke('fetch-whatsapp-profile', {
              body: {
                phone: phone,
                profileImageUrl: profileImageUrl,
                contactId: contactId
              }
            });

            if (updateError) {
              debugInfo.errors.push(`Failed to update profile image: ${updateError.message}`);
            } else {
              debugInfo.steps.push(`✅ Profile image updated successfully`);
              debugInfo.success = true;
              return debugInfo;
            }
          } else {
            debugInfo.steps.push(`ℹ️ No profile image URL found in API response`);
          }
        } else {
          const errorText = await profileResponse.text();
          debugInfo.errors.push(`API error ${profileResponse.status}: ${errorText}`);
        }
      } catch (error) {
        debugInfo.errors.push(`Network error: ${(error as Error).message || 'Unknown error'}`);
      }
    }

  } catch (error) {
    debugInfo.errors.push(`General error: ${(error as Error).message || 'Unknown error'}`);
  }

  return debugInfo;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactId, phone, workspaceId, action } = await req.json();
    
    if (!contactId || !phone || !workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: contactId, phone, workspaceId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let result;

    switch (action) {
      case 'fetch_profile':
        result = await fetchContactProfileImage(contactId, phone, workspaceId);
        break;
      
      case 'check_status':
        // Just return contact current status
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, name, phone, profile_image_url, profile_image_updated_at')
          .eq('id', contactId)
          .single();
        
        result = {
          contact,
          hasImage: !!contact?.profile_image_url,
          lastUpdated: contact?.profile_image_updated_at
        };
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: fetch_profile, check_status' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in debug-profile-images:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: (error as Error).message || 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})