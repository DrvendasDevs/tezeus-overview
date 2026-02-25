import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function downloadAndSaveProfileImage(supabase: any, imageUrl: string, phone: string): Promise<string | null> {
  try {
    console.log(`📥 Downloading profile image for ${phone}: ${imageUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`❌ Failed to download image: ${response.status}`);
      return null;
    }

    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    
    // Validate image size (max 5MB)
    if (imageBytes.length > 5 * 1024 * 1024) {
      console.error(`❌ Image too large: ${imageBytes.length} bytes`);
      return null;
    }
    
    // Generate filename
    const timestamp = Date.now();
    const extension = imageUrl.includes('.png') ? 'png' : 
                     imageUrl.includes('.webp') ? 'webp' : 'jpg';
    const fileName = `profile_${phone}_${timestamp}.${extension}`;
    const filePath = `profiles/${fileName}`;
    
    console.log(`💾 Saving image to storage: ${filePath}`);
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, imageBytes, {
        contentType: extension === 'png' ? 'image/png' : 
                    extension === 'webp' ? 'image/webp' : 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`❌ Upload error:`, uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    console.log(`✅ Profile image saved: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    console.error(`❌ Error downloading profile image:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { phone, profileImageUrl, contactId, workspaceId, instanceName } = await req.json();
    
    console.log(`🖼️ Processing profile image request:`, { 
      phone, 
      hasUrl: !!profileImageUrl, 
      contactId, 
      workspaceId,
      instanceName 
    });
    
    if (!phone || !profileImageUrl || !workspaceId) {
      console.log(`❌ Missing required parameters`);
      return new Response(
        JSON.stringify({ error: 'Missing phone, profileImageUrl or workspaceId' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if contact already has recent profile image
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, profile_image_url, profile_image_updated_at')
      .eq('phone', phone)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (contactError) {
      console.error('❌ Error fetching contact:', contactError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: contactError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!contact) {
      console.log(`❌ Contact not found: ${phone}`);
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Skip if image was updated in the last 24 hours
    const lastUpdate = contact.profile_image_updated_at ? new Date(contact.profile_image_updated_at) : null;
    const now = new Date();
    const shouldSkip = lastUpdate && (now.getTime() - lastUpdate.getTime()) < 24 * 60 * 60 * 1000;
    
    if (shouldSkip) {
      console.log(`⏭️ Skipping - profile image updated recently for ${phone}`);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Profile image already updated recently',
          phone 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Download and save the profile image
    const savedImageUrl = await downloadAndSaveProfileImage(supabase, profileImageUrl, phone);
    
    if (!savedImageUrl) {
      console.log(`❌ Failed to save profile image for ${phone}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to download and save profile image',
          phone 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update contact with profile image
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        profile_image_url: savedImageUrl,
        profile_image_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contact.id);

    if (updateError) {
      console.error('❌ Error updating contact:', updateError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update contact with profile image',
          details: updateError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Profile image updated for contact ${phone}: ${savedImageUrl}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        phone,
        contactId: contact.id,
        profileImageUrl: savedImageUrl,
        message: 'Profile image updated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing profile image request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})