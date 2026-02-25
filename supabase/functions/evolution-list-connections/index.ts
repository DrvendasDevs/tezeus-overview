import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

// Get Evolution API configuration from workspace settings
async function getEvolutionConfig(workspaceId: string, supabase: any) {
  try {
    console.log('🔧 Getting Evolution config for workspace:', workspaceId);
    
    // Get workspace-specific configuration
    const { data: configData, error: configError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('workspace_id', workspaceId)
      .eq('instance_name', '_master_config')
      .maybeSingle();

    if (configError) {
      console.log('⚠️ Error querying evolution_instance_tokens:', configError);
    }

    // If no config found, try to create one with default values
    if (!configData) {
      console.log('🔧 No config found, creating default configuration...');
      
      // Get default values from environment
      const defaultUrl = Deno.env.get('EVOLUTION_URL') || 'https://evolution-evolution.upvzfg.easypanel.host';
      const defaultApiKey = Deno.env.get('EVOLUTION_API_KEY');
      
      if (!defaultApiKey) {
        console.error('❌ No default Evolution API key available');
        throw new Error('Evolution API não está configurado para este workspace. Configure URL e API key nas configurações da Evolution.');
      }
      
      // Create default configuration
      const { error: insertError } = await supabase
        .from('evolution_instance_tokens')
        .insert({
          workspace_id: workspaceId,
          instance_name: '_master_config',
          evolution_url: defaultUrl,
          token: defaultApiKey
        });
        
      if (insertError) {
        console.error('❌ Failed to create default config:', insertError);
        throw new Error('Falha ao criar configuração padrão da Evolution API.');
      }
      
      console.log('✅ Created default configuration for workspace');
      return { url: defaultUrl, apiKey: defaultApiKey };
    }

    if (!configData?.evolution_url || !configData?.token || configData.token === 'config_only') {
      console.log('❌ No valid workspace Evolution configuration found');
      throw new Error('Evolution API não está configurado para este workspace. Configure URL e API key nas configurações da Evolution.');
    }
    
    console.log('✅ Using workspace-specific Evolution config');
    return {
      url: configData.evolution_url,
      apiKey: configData.token
    };
  } catch (error) {
    console.error('Error getting Evolution config:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get workspace ID from header or body
    const workspaceIdHeader = req.headers.get('x-workspace-id');
    const systemUserId = req.headers.get('x-system-user-id');
    
    let workspaceId = workspaceIdHeader;
    if (!workspaceId) {
      const body = await req.json();
      workspaceId = body.workspaceId;
    }
    
    console.log('🔗 Evolution list connections - User:', systemUserId, 'Workspace:', workspaceId);
    
    if (!workspaceId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Workspace ID is required (x-workspace-id header or workspaceId in body)' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!systemUserId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User authentication required (x-system-user-id header missing)' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const evolutionConfig = await getEvolutionConfig(workspaceId, supabase)

    // Get workspace connection limit
    const { data: limitData } = await supabase
      .from('workspace_limits')
      .select('connection_limit')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    const connectionLimit = limitData?.connection_limit || 1

    // Get user's default channel
    const { data: userData } = await supabase
      .from('system_users')
      .select('default_channel')
      .eq('id', systemUserId)
      .single()
    
    const defaultChannelId = userData?.default_channel

    // Get all connections for the workspace with provider info
    const { data: connections, error } = await supabase
      .from('connections')
      .select(`
        *,
        provider:whatsapp_providers(
          id,
          provider,
          evolution_url,
          zapi_url
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`)
    }

    // Get current status for each connection from Evolution API
    const connectionsWithStatus = await Promise.all(
      (connections || []).map(async (connection) => {
        try {
          if (!evolutionConfig.apiKey) {
            console.log(`⚠️ No API key available for ${connection.instance_name}, skipping status check`);
            return connection;
          }
          
          console.log(`🔍 Checking status for ${connection.instance_name} on ${evolutionConfig.url}`);
          
          // Check current status from Evolution API
          const statusResponse = await fetch(`${evolutionConfig.url}/instance/connectionState/${connection.instance_name}`, {
            headers: { 'apikey': evolutionConfig.apiKey }
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            console.log(`📊 Status response for ${connection.instance_name}:`, statusData);
            
            const currentStatus = statusData.instance?.state;
            let newStatus = connection.status;
            let phoneNumber = connection.phone_number;

            // Update status based on Evolution API response
            // Don't override 'disconnected' if it was set recently (within 30 seconds)
            const thirtySecondsAgo = new Date(Date.now() - 30000);
            const wasRecentlyDisconnected = 
              connection.status === 'disconnected' &&
              connection.updated_at &&
              new Date(connection.updated_at) > thirtySecondsAgo;
            
            if (currentStatus === 'open' && connection.status !== 'connected' && !wasRecentlyDisconnected) {
              newStatus = 'connected';
              // Extract phone number if available
              if (statusData.instance?.owner) {
                phoneNumber = statusData.instance.owner;
              }
              
              console.log(`✅ Updating ${connection.instance_name} to connected`);
              await supabase
                .from('connections')
                .update({ 
                  status: 'connected',
                  phone_number: phoneNumber,
                  updated_at: new Date().toISOString(),
                  last_activity_at: new Date().toISOString()
                })
                .eq('id', connection.id);
                
            } else if (currentStatus === 'close') {
              // Only update to disconnected if Evolution confirms it's closed
              // Don't update to connected if we recently set it to disconnected
              const thirtySecondsAgo = new Date(Date.now() - 30000);
              const wasRecentlyDisconnected = 
                connection.status === 'disconnected' &&
                connection.updated_at &&
                new Date(connection.updated_at) > thirtySecondsAgo;
              
              if (!wasRecentlyDisconnected || connection.status !== 'disconnected') {
                newStatus = 'disconnected';
                
                console.log(`❌ Updating ${connection.instance_name} to disconnected`);
                await supabase
                  .from('connections')
                  .update({ 
                    status: 'disconnected',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', connection.id);
              } else {
                console.log(`ℹ️ Keeping ${connection.instance_name} as disconnected (recently set)`);
                newStatus = 'disconnected';
              }
            }

            return { 
              ...connection, 
              status: newStatus, 
              phone_number: phoneNumber,
              is_default: connection.id === defaultChannelId 
            };
          } else {
            console.log(`⚠️ Failed to check status for ${connection.instance_name}: ${statusResponse.status}`);
          }
        } catch (error) {
          console.error(`❌ Error checking status for ${connection.instance_name}:`, error);
        }

        return { ...connection, is_default: connection.id === defaultChannelId };
      })
    );

    const quota = {
      used: connections?.length || 0,
      limit: connectionLimit
    }

    return new Response(
      JSON.stringify({
        success: true,
        connections: connectionsWithStatus,
        quota
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error listing connections:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: (error as Error).message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})