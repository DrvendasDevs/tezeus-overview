import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function generateRequestId(): string {
  return `sync_instances_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

serve(async (req) => {
  const requestId = generateRequestId();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`🔄 [${requestId}] Starting instance synchronization...`);
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Get all connections with their secrets
    const { data: connections, error: connectionsError } = await supabase
      .from('connections')
      .select(`
        id,
        instance_name,
        workspace_id,
        status,
        phone_number,
        qr_code,
        metadata,
        updated_at,
        connection_secrets (
          token,
          evolution_url
        )
      `)
      .neq('status', 'deleted');

    if (connectionsError) {
      console.error(`❌ [${requestId}] Error fetching connections:`, connectionsError);
      return new Response('Error fetching connections', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`📋 [${requestId}] Found ${connections.length} connections to sync`);

    const results = [];
    let syncedCount = 0;
    let errorCount = 0;
    let deletedCount = 0;

    for (const connection of connections) {
      console.log(`🔍 [${requestId}] Checking instance: ${connection.instance_name}`);
      
      // Normalize joined data (Supabase may return arrays for joins)
      const secrets = Array.isArray(connection.connection_secrets) 
        ? connection.connection_secrets[0] 
        : connection.connection_secrets;
      
      // Skip if no credentials
      if (!secrets?.token || !secrets?.evolution_url) {
        console.log(`⚠️ [${requestId}] Skipping ${connection.instance_name} - missing credentials`);
        results.push({
          instance: connection.instance_name,
          status: 'skipped',
          reason: 'Missing credentials'
        });
        continue;
      }

      try {
        // Check if instance exists in Evolution API
        const instanceResponse = await fetch(
          `${secrets.evolution_url}/instance/fetchInstances`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': secrets.token
            }
          }
        );

        if (instanceResponse.ok) {
          const instances = await instanceResponse.json();
          const foundInstance = instances.find((inst: any) => 
            inst.instanceName === connection.instance_name || 
            inst.instance?.instanceName === connection.instance_name
          );

          if (foundInstance) {
            // Instance exists, check its status
            const evolutionStatus = foundInstance.instance?.state || foundInstance.state;
            const evolutionOwner = foundInstance.instance?.owner || foundInstance.owner;
            
            let newStatus = 'disconnected';
            let newPhoneNumber = null;
            let shouldClearQr = false;

            if (evolutionStatus === 'open') {
              newStatus = 'connected';
              newPhoneNumber = evolutionOwner;
              shouldClearQr = true;
            } else if (evolutionStatus === 'connecting') {
              newStatus = 'connecting';
            } else if (evolutionStatus === 'close') {
              newStatus = 'disconnected';
              shouldClearQr = true;
            }

            // Don't override 'disconnected' status if it was set recently (within last 30 seconds)
            // This prevents sync from overriding manual disconnect actions
            const thirtySecondsAgo = new Date(Date.now() - 30000);
            const wasRecentlyDisconnected = 
              connection.status === 'disconnected' &&
              connection.updated_at &&
              new Date(connection.updated_at) > thirtySecondsAgo;
            
            // Skip status update if was recently disconnected and Evolution still shows 'open'
            if (wasRecentlyDisconnected && evolutionStatus === 'open') {
              console.log(`⚠️ [${requestId}] ${connection.instance_name} was manually disconnected recently, skipping status sync`);
              newStatus = 'disconnected'; // Keep as disconnected
            }
            
            // Update connection in database if status changed
            if (newStatus !== connection.status || 
                newPhoneNumber !== connection.phone_number ||
                (shouldClearQr && connection.qr_code)) {
              
              const updateData: any = {
                status: newStatus,
                phone_number: newPhoneNumber,
                updated_at: new Date().toISOString(),
                last_activity_at: new Date().toISOString(),
                metadata: {
                  ...connection.metadata,
                  last_sync_at: new Date().toISOString(),
                  evolution_state: evolutionStatus
                }
              };

              if (shouldClearQr) {
                updateData.qr_code = null;
              }

              await supabase
                .from('connections')
                .update(updateData)
                .eq('id', connection.id);

              console.log(`✅ [${requestId}] Updated ${connection.instance_name}: ${connection.status} → ${newStatus}`);
              results.push({
                instance: connection.instance_name,
                status: 'updated',
                oldStatus: connection.status,
                newStatus: newStatus,
                evolutionState: evolutionStatus
              });
              syncedCount++;
            } else {
              console.log(`✓ [${requestId}] ${connection.instance_name} already in sync (${newStatus})`);
              results.push({
                instance: connection.instance_name,
                status: 'in_sync',
                currentStatus: newStatus
              });
            }
          } else {
            // Instance not found in Evolution API - mark as deleted
            console.log(`🗑️ [${requestId}] Instance ${connection.instance_name} not found in Evolution API - marking as deleted`);
            
            await supabase
              .from('connections')
              .update({
                status: 'deleted',
                updated_at: new Date().toISOString(),
                metadata: {
                  ...connection.metadata,
                  deleted_at: new Date().toISOString(),
                  deletion_reason: 'Not found in Evolution API during sync'
                }
              })
              .eq('id', connection.id);

            results.push({
              instance: connection.instance_name,
              status: 'deleted',
              reason: 'Not found in Evolution API'
            });
            deletedCount++;
          }
        } else {
          console.error(`❌ [${requestId}] Failed to fetch instances from Evolution API for ${connection.instance_name}`);
          results.push({
            instance: connection.instance_name,
            status: 'error',
            error: `Evolution API error: ${instanceResponse.status}`
          });
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error checking instance ${connection.instance_name}:`, error);
        results.push({
          instance: connection.instance_name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
        errorCount++;
      }

      // Small delay to avoid overwhelming the Evolution API
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`✅ [${requestId}] Instance synchronization completed`);
    console.log(`📊 [${requestId}] Summary: ${syncedCount} synced, ${deletedCount} deleted, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Instance synchronization completed',
      results: results,
      summary: {
        total: connections.length,
        synced: syncedCount,
        deleted: deletedCount,
        errors: errorCount,
        in_sync: results.filter(r => r.status === 'in_sync').length,
        skipped: results.filter(r => r.status === 'skipped').length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error synchronizing instances:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});