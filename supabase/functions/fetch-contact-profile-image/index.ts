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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let existingContact: any = null;

  try {
    const { phone, contactId, workspaceId } = await req.json();
    
    console.log(`📥 Fetch profile image request:`, { phone, contactId, workspaceId });
    
    // Verificar se o contato existe e pertence ao workspace correto
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, workspace_id, profile_fetch_attempts, profile_fetch_last_attempt')
      .eq('id', contactId)
      .eq('workspace_id', workspaceId)
      .single();

    existingContact = contact;

    if (!existingContact) {
      console.log(`❌ Contact not found or doesn't belong to workspace: ${contactId}, ${workspaceId}`);
      return new Response(
        JSON.stringify({ error: 'Contact not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se deve tentar novamente (retry logic)
    const maxAttempts = 3;
    const retryDelays = [60 * 60 * 1000, 6 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]; // 1h, 6h, 24h
    
    if (existingContact.profile_fetch_attempts >= maxAttempts) {
      console.log(`⏭️ Max attempts reached for contact ${contactId}, skipping profile fetch`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Max fetch attempts reached' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingContact.profile_fetch_last_attempt) {
      const lastAttempt = new Date(existingContact.profile_fetch_last_attempt);
      const now = new Date();
      const timeSinceLastAttempt = now.getTime() - lastAttempt.getTime();
      const requiredDelay = retryDelays[existingContact.profile_fetch_attempts] || retryDelays[retryDelays.length - 1];
      
      if (timeSinceLastAttempt < requiredDelay) {
        console.log(`⏳ Too soon to retry profile fetch for contact ${contactId}. Last attempt: ${lastAttempt}, Required delay: ${requiredDelay}ms`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Retry too soon, waiting for delay' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    if (!phone || !contactId || !workspaceId) {
      console.log(`❌ Missing required parameters:`, { phone: !!phone, contactId: !!contactId, workspaceId: !!workspaceId });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: phone, contactId, workspaceId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const sanitizedPhone = phone.replace(/\D/g, '');
    console.log(`🔍 Processing profile image for contact: ${sanitizedPhone}`);
    
    // Get connection secrets for any instance in this workspace
    const { data: connectionData } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .limit(1)
      .single();

    if (!connectionData?.connection_secrets?.[0]) {
      console.log(`⚠️ No connection secrets found for workspace ${workspaceId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No connection found for workspace' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { token, evolution_url } = connectionData.connection_secrets[0];
    const instanceName = connectionData.instance_name;
    
    // Fetch profile image from Evolution API
    console.log(`🔗 Fetching profile from: ${evolution_url}/chat/findProfile/${instanceName}`);
    
    try {
      const profileResponse = await fetch(`${evolution_url}/chat/findProfile/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': token
        },
        body: JSON.stringify({
          number: sanitizedPhone
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!profileResponse.ok) {
        console.error(`❌ Failed to fetch profile from Evolution API:`, profileResponse.status, await profileResponse.text());
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to fetch profile from Evolution API' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const profileData = await profileResponse.json();
      console.log(`✅ Profile data received for ${sanitizedPhone}:`, profileData ? 'success' : 'empty');
      console.log(`🔍 Profile data structure:`, Object.keys(profileData || {}));
      if (profileData) {
        console.log(`📊 Available fields:`, {
          profilePictureUrl: !!profileData.profilePictureUrl,
          picture: !!profileData.picture,
          name: !!profileData.name,
          status: !!profileData.status
        });
      }
      
      const profileImageUrl = profileData?.profilePictureUrl || profileData?.picture;
      
      if (!profileImageUrl) {
        console.log(`ℹ️ No profile image URL found in Evolution API response`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'No profile image found' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`🖼️ Found profile image URL: ${profileImageUrl}`);
      
      // Call the fetch-whatsapp-profile function
      const { error: profileError } = await supabase.functions.invoke('fetch-whatsapp-profile', {
        body: {
          phone: sanitizedPhone,
          profileImageUrl: profileImageUrl,
          contactId: contactId
        }
      });

      if (profileError) {
        console.error(`❌ Failed to update profile image:`, profileError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Failed to save profile image',
            error: profileError
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`✅ Profile image update completed for ${sanitizedPhone}`);
      
      // Reset retry counter on success
      await supabase
        .from('contacts')
        .update({ 
          profile_fetch_attempts: 0,
          profile_fetch_last_attempt: null
        })
        .eq('id', contactId);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Profile image updated successfully',
          phone: sanitizedPhone,
          profileImageUrl
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (fetchError) {
      console.error(`❌ Error during Evolution API call:`, fetchError);
      
      // Increment retry counter on failure
      await supabase
        .from('contacts')
        .update({ 
          profile_fetch_attempts: existingContact.profile_fetch_attempts + 1,
          profile_fetch_last_attempt: new Date().toISOString()
        })
        .eq('id', contactId);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error fetching profile from Evolution API',
          error: (fetchError as Error).message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Error processing request:', error);
    
    // Increment retry counter on general error (if we have existingContact)
    if (existingContact) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('profile_fetch_attempts')
          .eq('id', existingContact.id)
          .single();
          
        if (contact) {
          await supabase
            .from('contacts')
            .update({ 
              profile_fetch_attempts: contact.profile_fetch_attempts + 1,
              profile_fetch_last_attempt: new Date().toISOString()
            })
            .eq('id', existingContact.id);
        }
      } catch (updateError) {
        console.error('❌ Failed to update retry counter:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error', 
        error: (error as Error).message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})