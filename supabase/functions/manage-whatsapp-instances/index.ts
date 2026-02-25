import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, instanceName, orgId, historyRecovery } = await req.json();
    console.log(`Action: ${action}, Instance: ${instanceName}, Org: ${orgId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Evolution API configuration - require from request parameters
    const { evolutionUrl, evolutionApiKey } = await req.json();
    
    if (!evolutionUrl || !evolutionApiKey) {
      return new Response(
        JSON.stringify({ error: 'Evolution URL and API Key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Using Evolution API Key: ${evolutionApiKey ? 'Available' : 'Missing'}`);

    switch (action) {
      case 'create':
        return await handleCreate(supabase, evolutionUrl, evolutionApiKey, instanceName, orgId, historyRecovery);
      case 'connect':
        return await handleConnect(supabase, evolutionUrl, evolutionApiKey, instanceName, orgId);
      case 'remove':
        return await handleRemove(supabase, evolutionUrl, evolutionApiKey, instanceName, orgId);
      case 'list':
        return await handleList(supabase, evolutionUrl, evolutionApiKey, orgId);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in manage-whatsapp-instances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCreate(supabase: any, evolutionUrl: string, evolutionApiKey: string, instanceName: string, orgId: string, historyRecovery: string = 'none') {
  console.log(`Creating instance: ${instanceName} for org: ${orgId}, history: ${historyRecovery}`);

  try {
    // Fetch workspace webhook configuration
    console.log('Fetching workspace webhook configuration for org:', orgId)
    const { data: webhookConfig, error: webhookError } = await supabase
      .from('workspace_webhook_settings')
      .select('webhook_url, webhook_secret')
      .eq('workspace_id', orgId)
      .maybeSingle()

    if (webhookError) {
      console.error('Error fetching webhook config:', webhookError)
    }

    // Build Evolution payload
    const evolutionPayload: any = {
      instanceName: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    }

    // Add webhook configuration if available
    if (webhookConfig?.webhook_url) {
      console.log('Using workspace webhook configuration:', webhookConfig.webhook_url)
      evolutionPayload.webhook = {
        url: webhookConfig.webhook_url,
        byEvents: true,
        base64: true,
        headers: {
          "X-Secret": webhookConfig.webhook_secret,
          'Content-Type': 'application/json'
        },
        events: [
          "MESSAGES_UPSERT",
          "QRCODE_UPDATED"
        ]
      }
    } else {
      console.log('No webhook configuration found for workspace, creating instance without webhook')
    }

    // Create instance in Evolution API
    const response = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify(evolutionPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      throw new Error(`Failed to create instance: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('Evolution API response:', result);

    // Save instance token to secure table
    if (result.hash) {
      const { error: tokenError } = await supabase
        .from('evolution_instance_tokens')
        .insert({
          instance_name: instanceName,
          token: result.hash,
          workspace_id: orgId,
          evolution_url: evolutionUrl,
        });

      if (tokenError) {
        console.error('Error saving token:', tokenError);
      }
    }

    // Save connection to public table
    const { error: connectionError } = await supabase
      .from('connections')
      .insert({
        instance_name: instanceName,
        workspace_id: orgId,
        status: result.qrcode ? 'qr' : 'creating',
        qr_code: result.qrcode ? `data:image/png;base64,${result.qrcode.base64}` : null,
        history_recovery: historyRecovery,
        use_workspace_default: webhookConfig?.webhook_url ? true : false,
      });

    if (connectionError) {
      console.error('Error saving connection:', connectionError);
      throw new Error('Failed to save connection');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        instance: result,
        qrCode: result.qrcode ? `data:image/png;base64,${result.qrcode.base64}` : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handleCreate:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleConnect(supabase: any, evolutionUrl: string, evolutionApiKey: string, instanceName: string, orgId: string) {
  console.log(`Connecting instance: ${instanceName}`);

  try {
    // Get instance token
    const { data: tokenData, error: tokenError } = await supabase
      .from('evolution_instance_tokens')
      .select('token')
      .eq('instance_name', instanceName)
      .eq('workspace_id', orgId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Instance token not found');
    }

    // Fetch QR code from Evolution API
    const response = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': tokenData.token,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get QR code: ${response.status}`);
    }

    const result = await response.json();
    
    const qrCodeData = result.base64 ? `data:image/png;base64,${result.base64}` : null;

    // Update connection with QR code
    const { error: updateError } = await supabase
      .from('connections')
      .update({
        qr_code: qrCodeData,
        status: 'qr',
        updated_at: new Date().toISOString(),
      })
      .eq('instance_name', instanceName)
      .eq('workspace_id', orgId);

    if (updateError) {
      console.error('Error updating connection:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        qrCode: qrCodeData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handleConnect:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleRemove(supabase: any, evolutionUrl: string, evolutionApiKey: string, instanceName: string, orgId: string) {
  console.log(`Removing instance: ${instanceName}`);

  try {
    // Get instance details
    const { data: tokenData, error: tokenError } = await supabase
      .from('evolution_instance_tokens')
      .select('token')
      .eq('instance_name', instanceName)
      .eq('workspace_id', orgId)
      .single();

    // Try to delete from Evolution API using instance token first
    let deleteSuccess = false;
    
    if (tokenData?.token) {
      try {
        const response = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': tokenData.token,
          },
        });
        deleteSuccess = response.ok;
      } catch (error) {
        console.log('Failed with instance token, trying admin key...');
      }
    }

    // If instance token failed, try with admin API key
    if (!deleteSuccess) {
      try {
        const response = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
        });
        deleteSuccess = response.ok;
      } catch (error) {
        console.log('Failed with admin key too, proceeding with database cleanup...');
      }
    }

    // Remove from database regardless of Evolution API result
    const { error: tokenDeleteError } = await supabase
      .from('evolution_instance_tokens')
      .delete()
      .eq('instance_name', instanceName)
      .eq('workspace_id', orgId);

    const { error: connectionDeleteError } = await supabase
      .from('connections')
      .delete()
      .eq('instance_name', instanceName)
      .eq('workspace_id', orgId);

    if (tokenDeleteError) {
      console.error('Error deleting token:', tokenDeleteError);
    }

    if (connectionDeleteError) {
      console.error('Error deleting connection:', connectionDeleteError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: deleteSuccess ? 'Instance removed successfully' : 'Instance removed from database (Evolution API deletion may have failed)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handleRemove:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleList(supabase: any, evolutionUrl: string, evolutionApiKey: string, orgId: string) {
  console.log(`Listing instances for org: ${orgId}`);

  try {
    // Get connections from database
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select('*')
      .eq('workspace_id', orgId)
      .order('created_at', { ascending: false });

    if (connectionsError) {
      throw new Error('Failed to fetch connections');
    }

    // Check status for each connection by calling Evolution API
    const connectionsWithStatus = await Promise.all(
      (connections || []).map(async (connection: any) => {
        try {
          // Get token for this instance
          const { data: tokenData } = await supabase
            .from('evolution_instance_tokens')
            .select('token')
            .eq('instance_name', connection.instance_name)
            .eq('workspace_id', orgId)
            .single();

          if (tokenData?.token) {
            // Check instance status
            const response = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': tokenData.token,
              },
            });

            if (response.ok) {
              const instances = await response.json();
              const instance = instances.find((inst: any) => inst.instance.instanceName === connection.instance_name);
              
              if (instance) {
                const status = instance.instance.state === 'open' ? 'connected' : 'disconnected';
                
                // Update status in database
                await supabase
                  .from('connections')
                  .update({ status })
                  .eq('id', connection.id);

                return {
                  ...connection,
                  status,
                };
              }
            }
          }
        } catch (error) {
          console.error(`Error checking status for ${connection.instance_name}:`, error);
        }

        return connection;
      })
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        connections: connectionsWithStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handleList:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}