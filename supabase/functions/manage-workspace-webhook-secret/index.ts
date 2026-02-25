import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { workspace_id, webhook_url, action } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({
        error: 'workspace_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const secretName = `N8N_WEBHOOK_URL_${workspace_id}`;
    
    if (action === 'save' && webhook_url) {
      // Salvar o webhook URL na tabela workspace_webhook_secrets
      console.log(`🔐 Saving webhook secret for workspace ${workspace_id}: ${secretName}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase environment variables');
      }
      
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      const { error: insertError } = await supabase
        .from('workspace_webhook_secrets')
        .upsert({
          workspace_id: workspace_id,
          secret_name: secretName,
          webhook_url: webhook_url,
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`❌ Failed to save webhook secret: ${insertError.message}`);
        
        return new Response(JSON.stringify({
          error: 'Failed to save webhook secret',
          details: insertError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Webhook secret saved successfully for workspace ${workspace_id}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Webhook URL saved for workspace ${workspace_id}`,
        secret_name: secretName
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'delete') {
      // Deletar o webhook da tabela workspace_webhook_secrets
      console.log(`🗑️ Deleting webhook secret for workspace ${workspace_id}: ${secretName}`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase environment variables');
      }
      
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      const { error: deleteError } = await supabase
        .from('workspace_webhook_secrets')
        .delete()
        .eq('workspace_id', workspace_id)
        .eq('secret_name', secretName);
      
      if (deleteError) {
        console.error(`❌ Failed to delete secret: ${deleteError.message}`);
      } else {
        console.log(`✅ Secret deleted successfully: ${secretName}`);
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Webhook secret deleted for workspace ${workspace_id}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({
        error: 'Invalid action or missing webhook_url'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Error managing webhook secret:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});