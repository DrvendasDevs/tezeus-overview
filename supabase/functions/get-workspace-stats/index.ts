import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Permitimos todos os headers para evitar bloqueio por preflight (inclui x-workspace-id)
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this is a single workspace request
    const { workspaceId } = await req.json().catch(() => ({}));

    if (workspaceId) {
      // Single workspace stats request
      console.log('📊 Getting stats for workspace:', workspaceId);

      // Count users (excluding masters)
      const { count: usersCount, error: usersError } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('role', 'master');

      if (usersError) {
        console.error('Error counting users:', usersError);
        throw usersError;
      }

      console.log('📊 Users count:', usersCount);

      // Get pipelines for this workspace
      const { data: pipelines, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspaceId);

      if (pipelinesError) {
        console.error('Error fetching pipelines:', pipelinesError);
        throw pipelinesError;
      }

      // Count active deals
      let activeDealsCount = 0;
      if (pipelines && pipelines.length > 0) {
        const pipelineIds = pipelines.map(p => p.id);
        
        const { count, error: dealsError } = await supabase
          .from('pipeline_cards')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'aberto')
          .in('pipeline_id', pipelineIds);

        if (dealsError) {
          console.error('Error counting deals:', dealsError);
          throw dealsError;
        }
        
        activeDealsCount = count || 0;
      }

      console.log('📊 Active deals count:', activeDealsCount);

      return new Response(
        JSON.stringify({
          usersCount: usersCount || 0,
          activeDealsCount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original code for all workspaces
    // Get user info from headers
    const userId = req.headers.get('x-system-user-id');
    const userEmail = req.headers.get('x-system-user-email');

    if (!userId || !userEmail) {
      throw new Error('User authentication required');
    }

    console.log('📊 Getting workspace stats for user:', userId);

    // Get user profile to check if master
    const { data: userProfile } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', userId)
      .single();

    const isMaster = userProfile?.profile === 'master';

    // Get workspaces
    let workspacesQuery = supabase.from('workspaces').select('id, name');
    
    if (!isMaster) {
      // Non-master users only see their workspaces
      const { data: memberWorkspaces } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);
      
      const workspaceIds = memberWorkspaces?.map(w => w.workspace_id) || [];
      workspacesQuery = workspacesQuery.in('id', workspaceIds);
    }

    const { data: workspaces, error: workspacesError } = await workspacesQuery;

    if (workspacesError) {
      throw workspacesError;
    }

    console.log(`✅ Found ${workspaces?.length || 0} workspaces`);

    // Get stats for each workspace using more efficient queries
    const stats = await Promise.all(
      (workspaces || []).map(async (workspace) => {
        // Use a single query for each table to get the count
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const [
          { count: connectionsCount },
          { count: conversationsCount },
          { count: messagesCount },
          { count: activeConversations }
        ] = await Promise.all([
          supabase.from('connections').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('messages').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
          supabase.from('conversations').select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspace.id)
            .or(`status.eq.open,last_activity_at.gte.${last24h}`) // Use status open OR activity in last 24h
        ]);

        return {
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          connections_count: connectionsCount || 0,
          conversations_count: conversationsCount || 0,
          messages_count: messagesCount || 0,
          active_conversations: activeConversations || 0,
        };
      })
    );

    console.log('✅ Stats collected successfully');

    return new Response(
      JSON.stringify({ stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})