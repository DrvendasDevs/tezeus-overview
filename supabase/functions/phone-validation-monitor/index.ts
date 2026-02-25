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

function validatePhoneNumber(phone: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for WhatsApp suffixes that shouldn't be in phone numbers
  if (phone.includes('@')) {
    issues.push(`Contains WhatsApp suffix: ${phone}`);
  }
  
  // Check if it's all digits
  if (!/^\d+$/.test(phone)) {
    issues.push(`Contains non-digit characters: ${phone}`);
  }
  
  // Check length (Brazilian numbers should be 10-13 digits with country code)
  if (phone.length < 8 || phone.length > 15) {
    issues.push(`Invalid length (${phone.length} digits): ${phone}`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({
      error: 'Only GET method is allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log('🔍 Starting phone number validation monitoring...');
    
    // Get all contacts with their phone numbers
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, phone, name, workspace_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000); // Limit to recent contacts
    
    if (contactsError) {
      console.error('❌ Error fetching contacts:', contactsError);
      throw contactsError;
    }
    
    const validationResults = {
      total_contacts: contacts?.length || 0,
      valid_phones: 0,
      invalid_phones: 0,
      issues_found: [] as any[],
      summary: {
        with_whatsapp_suffix: 0,
        non_digit_characters: 0,
        invalid_length: 0,
        recent_invalid: 0 // Last 24 hours
      }
    };
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    contacts?.forEach(contact => {
      const validation = validatePhoneNumber(contact.phone || '');
      
      if (validation.isValid) {
        validationResults.valid_phones++;
      } else {
        validationResults.invalid_phones++;
        
        const isRecent = new Date(contact.created_at) > yesterday;
        if (isRecent) {
          validationResults.summary.recent_invalid++;
        }
        
        // Count specific issue types
        validation.issues.forEach(issue => {
          if (issue.includes('WhatsApp suffix')) {
            validationResults.summary.with_whatsapp_suffix++;
          }
          if (issue.includes('non-digit characters')) {
            validationResults.summary.non_digit_characters++;
          }
          if (issue.includes('Invalid length')) {
            validationResults.summary.invalid_length++;
          }
        });
        
        validationResults.issues_found.push({
          contact_id: contact.id,
          phone: contact.phone,
          name: contact.name,
          workspace_id: contact.workspace_id,
          created_at: contact.created_at,
          issues: validation.issues,
          is_recent: isRecent
        });
      }
    });
    
    console.log(`📊 Validation complete: ${validationResults.valid_phones} valid, ${validationResults.invalid_phones} invalid`);
    
    return new Response(JSON.stringify({
      success: true,
      validation_results: validationResults,
      recommendations: [
        'Run fix-phone-numbers function to correct WhatsApp suffixes',
        'Investigate Evolution API configuration differences between environments',
        'Monitor recent contacts for recurring issues',
        'Consider adding phone validation in the webhook processing'
      ]
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Error in phone validation monitor:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});