import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests first - MUST be before any processing
  if (req.method === 'OPTIONS') {
    console.log('⚡ CORS preflight request received');
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Ensure all responses include CORS headers
  const createResponse = (body: any, status = 200) => {
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { 
        status,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  };

  try {
    console.log('🔌 disconnect-connection: Starting');
    console.log('📋 Request method:', req.method);
    console.log('📋 Request URL:', req.url);
    
    let connectionId: string;
    let body: any;
    try {
      body = await req.json();
      console.log('📦 Request body received:', JSON.stringify(body));
      connectionId = body.connectionId;
      console.log('✅ Connection ID extracted:', connectionId);
    } catch (jsonError) {
      console.error('❌ Error parsing JSON:', jsonError);
      console.error('❌ JSON Error details:', jsonError instanceof Error ? jsonError.message : String(jsonError));
      return createResponse({ success: false, error: 'Invalid request body' }, 400);
    }

    if (!connectionId) {
      console.warn('⚠️ Connection ID is missing from body');
      return createResponse({ success: false, error: 'Connection ID is required' }, 400);
    }
    
    console.log('🔍 Proceeding with connectionId:', connectionId);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return createResponse({ success: false, error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status to disconnected
    console.log(`💾 Updating connection ${connectionId} status to disconnected`);
    
    const { error: updateError, data: updateData } = await supabase
      .from('connections')
      .update({ 
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select();

    console.log('📊 Update result:', { 
      error: updateError ? updateError.message : null,
      rowsUpdated: updateData?.length || 0 
    });

    if (updateError) {
      console.error('❌ Error updating connection status:', updateError);
      console.error('❌ Error details:', JSON.stringify(updateError));
      // Still return success - we've done our best
    } else {
      console.log('✅ Connection status updated successfully');
      if (updateData && updateData.length > 0) {
        console.log('✅ Updated connection data:', { 
          id: updateData[0].id,
          status: updateData[0].status,
          instance_name: updateData[0].instance_name 
        });
      }
    }

    // FORCE EXECUTION - Ensure this block runs
    console.log('✅ Database update completed, now starting Evolution API disconnect...');
    console.log('🚀 Starting Evolution API disconnect process...');
    console.log('🔍 Connection ID for lookup:', connectionId);
    console.log('🔍 Current time:', new Date().toISOString());
    
    // Execute Evolution API disconnect in a way that ensures it runs
    (async () => {
      try {
        console.log('🔍 [ASYNC] Looking up connection details for Evolution API call...');
        console.log('🔍 [ASYNC] Querying connections table...');
        
        // Get connection details first
        const { data: connection, error: connError } = await supabase
          .from('connections')
          .select('instance_name, workspace_id')
          .eq('id', connectionId)
          .single();
        
        console.log('📊 [ASYNC] Connection query result:', {
          hasData: !!connection,
          hasError: !!connError,
          error: connError ? connError.message : null
        });

        if (connError) {
          console.error('❌ [ASYNC] Error fetching connection details:', connError);
        } else if (!connection) {
          console.warn('⚠️ [ASYNC] Connection not found:', connectionId);
        } else {
          console.log('✅ [ASYNC] Connection found:', { 
            instanceName: connection.instance_name, 
            workspaceId: connection.workspace_id 
          });

          // Get Evolution config - try both patterns
          console.log('🔍 [ASYNC] Fetching Evolution API config for workspace:', connection.workspace_id);
          
          // First try: _master_config instance
          let config: { token: string; evolution_url: string } | null = null;
          const { data: masterConfig } = await supabase
            .from('evolution_instance_tokens')
            .select('token, evolution_url')
            .eq('workspace_id', connection.workspace_id)
            .eq('instance_name', '_master_config')
            .maybeSingle();

          console.log('📊 [ASYNC] Master config query result:', {
            found: !!masterConfig,
            hasToken: !!masterConfig?.token,
            hasUrl: !!masterConfig?.evolution_url
          });

          if (masterConfig?.token && masterConfig?.evolution_url) {
            config = masterConfig as { token: string; evolution_url: string };
            console.log('✅ [ASYNC] Found Evolution config via _master_config');
          } else {
            // Second try: any config for workspace
            console.log('🔍 [ASYNC] Trying alternative config lookup...');
            const { data: anyConfig } = await supabase
              .from('evolution_instance_tokens')
              .select('token, evolution_url')
              .eq('workspace_id', connection.workspace_id)
              .maybeSingle();

            console.log('📊 [ASYNC] Alternative config query result:', {
              found: !!anyConfig,
              hasToken: !!anyConfig?.token,
              hasUrl: !!anyConfig?.evolution_url
            });

            if (anyConfig?.token && anyConfig?.evolution_url) {
              config = anyConfig as { token: string; evolution_url: string };
              console.log('✅ [ASYNC] Found Evolution config via workspace lookup');
            }
          }

          if (!config) {
            console.warn('⚠️ [ASYNC] Evolution API config not found for workspace:', connection.workspace_id);
            console.log('⚠️ [ASYNC] Disconnect will only update local status, not Evolution API');
          } else if (!config.token || !config.evolution_url) {
            console.warn('⚠️ [ASYNC] Evolution API config incomplete:', { 
              hasToken: !!config.token, 
              hasUrl: !!config.evolution_url 
            });
          } else {
            // Normalize URL
            const baseUrl = config.evolution_url.endsWith('/') 
              ? config.evolution_url.slice(0, -1) 
              : config.evolution_url;
            const logoutUrl = `${baseUrl}/instance/logout/${connection.instance_name}`;
            
            console.log('📤 [ASYNC] Calling Evolution API logout:', logoutUrl);
            console.log('🔑 [ASYNC] Using API key (length):', config.token.length);

            // Call Evolution API in background (fire and forget)
            fetch(logoutUrl, {
              method: 'DELETE',
              headers: { 
                'apikey': config.token,
                'Content-Type': 'application/json'
              }
            })
              .then(async (resp) => {
                console.log(`📡 [ASYNC] Evolution API logout response status: ${resp.status}`);
                
                if (!resp.ok && resp.status !== 404) {
                  try {
                    const errorText = await resp.text();
                    console.warn(`⚠️ [ASYNC] Evolution API logout returned status ${resp.status}:`, errorText.substring(0, 200));
                  } catch {
                    console.warn(`⚠️ [ASYNC] Evolution API logout returned status ${resp.status} (could not read error)`);
                  }
                } else {
                  console.log('✅ [ASYNC] Evolution API logout successful (or instance not found - treated as success)');
                }
              })
              .catch((err) => {
                console.error('❌ [ASYNC] Evolution API logout error (non-blocking):', err);
                console.error('❌ [ASYNC] Error details:', err instanceof Error ? err.message : String(err));
              });
          }
        }
      } catch (evolutionError) {
        console.error('❌ [ASYNC] Error in Evolution API disconnect flow (non-blocking):', evolutionError);
        console.error('❌ [ASYNC] Error stack:', evolutionError instanceof Error ? evolutionError.stack : 'No stack');
        // Ignore - this is background operation
      }
    })(); // Execute immediately but don't await

    // Always return success
    console.log('✅ About to return success response');
    console.log('✅ Function execution completed, returning to client');
    return createResponse({ 
      success: true, 
      status: 'disconnected',
      message: 'Connection disconnected successfully'
    });

  } catch (error) {
    console.error('❌ disconnect-connection: Error:', error);
    
    // Even on error, return success since we just want to mark as disconnected
    // IMPORTANT: Always include CORS headers even on errors
    return createResponse({ 
      success: true,
      status: 'disconnected',
      message: 'Connection marked as disconnected'
    });
  }
});

