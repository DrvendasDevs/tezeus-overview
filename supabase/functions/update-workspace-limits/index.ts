import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { workspaceId, connectionLimit } = await req.json();

    if (!workspaceId || typeof connectionLimit !== 'number') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Workspace ID e connection limit são obrigatórios' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('💾 Updating workspace limits for workspace:', workspaceId);
    console.log('🔢 New connection limit:', connectionLimit);

    // Update workspace limits
    const { data, error } = await supabase
      .from('workspace_limits')
      .upsert({
        workspace_id: workspaceId,
        connection_limit: connectionLimit
      })
      .select();

    if (error) {
      console.error('❌ Database error updating workspace limits:', error);
      throw error;
    }

    console.log('✅ Workspace limits updated successfully:', data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Limite de conexões atualizado com sucesso',
      data: data 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error updating workspace limits:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})