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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Debug: Checking contacts with recent activity');
    
    // Check contacts that have been updated recently
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, name, phone, profile_image_url, profile_image_updated_at, workspace_id')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching contacts:', error);
      return new Response(JSON.stringify({ error }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📊 Recent contacts:', contacts);

    // Check recent messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, content, sender_type, created_at, conversation_id')
      .order('created_at', { ascending: false })
      .limit(5);

    if (msgError) {
      console.error('Error fetching messages:', msgError);
    }

    console.log('📨 Recent messages:', messages);

    // Check recent webhooks logs
    const { data: webhooks, error: webhookError } = await supabase
      .from('webhook_logs')
      .select('id, event_type, instance_id, created_at, payload_json')
      .order('created_at', { ascending: false })
      .limit(5);

    if (webhookError) {
      console.error('Error fetching webhook logs:', webhookError);
    }

    console.log('🔗 Recent webhook logs:', webhooks);

    // Test the process-profile-image function with a sample contact
    if (contacts && contacts.length > 0) {
      const testContact = contacts[0];
      console.log(`🧪 Testing profile image processing for contact: ${testContact.phone}`);
      
      const testImageUrl = 'https://picsum.photos/200/200'; // Test image
      
      const { data: testResult, error: testError } = await supabase.functions.invoke('process-profile-image', {
        body: {
          phone: testContact.phone,
          profileImageUrl: testImageUrl,
          contactId: testContact.id,
          workspaceId: testContact.workspace_id,
          instanceName: 'debug-test'
        }
      });

      console.log('🧪 Test result:', { testResult, testError });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Debug information logged to console',
        contacts: contacts?.length || 0,
        messages: messages?.length || 0,
        webhooks: webhooks?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Debug error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Debug error', 
        details: (error as Error).message || 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})