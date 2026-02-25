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

// Helper function to download and save profile image with retry
async function downloadAndSaveProfileImage(imageUrl: string, phone: string, retries: number = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`📥 Downloading profile image for ${phone} (attempt ${attempt}/${retries}): ${imageUrl}`);
      
      // Download the image with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(imageUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`❌ Failed to download image (attempt ${attempt}): ${response.status} ${response.statusText}`);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }

      const imageBuffer = await response.arrayBuffer();
      const imageBytes = new Uint8Array(imageBuffer);
      
      // Validate image size (max 10MB)
      if (imageBytes.length > 10 * 1024 * 1024) {
        console.error(`❌ Image too large: ${imageBytes.length} bytes`);
        return null;
      }
      
      // Validate it's actually an image
      if (imageBytes.length < 100) {
        console.error(`❌ Image too small or invalid: ${imageBytes.length} bytes`);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      // Generate filename with proper extension
      const timestamp = Date.now();
      const extension = imageUrl.includes('.png') ? 'png' : 
                       imageUrl.includes('.webp') ? 'webp' : 'jpg';
      const fileName = `profile_${phone}_${timestamp}.${extension}`;
      const filePath = `profiles/${fileName}`;
      
      console.log(`💾 Saving image to storage: ${filePath} (${imageBytes.length} bytes)`);
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, imageBytes, {
          contentType: extension === 'png' ? 'image/png' : 
                      extension === 'webp' ? 'image/webp' : 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`❌ Upload error (attempt ${attempt}):`, uploadError);
        if (attempt === retries) return null;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log(`✅ Profile image saved: ${publicUrl}`);
      return publicUrl;
      
    } catch (error) {
      console.error(`❌ Error downloading/saving profile image (attempt ${attempt}):`, error);
      if (attempt === retries) return null;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Wait before retry
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, profileImageUrl, contactId } = await req.json();
    
    console.log(`📥 Received request:`, { phone, profileImageUrl, contactId });
    
    if (!phone || !profileImageUrl) {
      console.log(`❌ Missing required parameters:`, { phone: !!phone, profileImageUrl: !!profileImageUrl });
      return new Response(
        JSON.stringify({ error: 'Missing phone or profileImageUrl' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 Processing profile image for contact: ${phone} with URL: ${profileImageUrl}`);
    
    // Download and save the profile image
    const savedImageUrl = await downloadAndSaveProfileImage(profileImageUrl, phone);
    
    if (!savedImageUrl) {
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
      .eq(contactId ? 'id' : 'phone', contactId || phone);

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

    console.log(`✅ Profile image updated for contact ${phone}`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        phone,
        profileImageUrl: savedImageUrl,
        message: 'Profile image updated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})