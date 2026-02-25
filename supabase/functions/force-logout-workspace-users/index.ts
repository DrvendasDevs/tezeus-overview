import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar todos os usuários não-masters do workspace
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        system_users!inner(profile)
      `)
      .eq('workspace_id', workspaceId);

    if (membersError) {
      console.error('Error fetching workspace members:', membersError);
      return new Response(
        JSON.stringify({ error: 'Falha ao buscar membros do workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nonMasterUsers = members?.filter((m: any) => 
      m.system_users?.profile !== 'master'
    ).map((m: any) => m.user_id) || [];

    console.log(`Found ${nonMasterUsers.length} non-master users to logout from workspace ${workspaceId}`);

    // Invalidar sessões dos usuários (usando auth admin)
    let loggedOutCount = 0;
    for (const userId of nonMasterUsers) {
      try {
        // Buscar a conta Supabase associada ao system_user
        const supabaseEmail = `${userId}@tezeus.app`;
        
        // Buscar o user_id do Supabase Auth pelo email
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          console.error(`Error listing auth users:`, authError);
          continue;
        }

        const authUser = authUsers?.users?.find(u => u.email === supabaseEmail);
        
        if (authUser) {
          await supabase.auth.admin.signOut(authUser.id);
          loggedOutCount++;
          console.log(`Logged out user ${userId} (${supabaseEmail})`);
        }
      } catch (error) {
        console.error(`Error logging out user ${userId}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Usuários deslogados com sucesso',
        totalUsers: nonMasterUsers.length,
        loggedOut: loggedOutCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error forcing logout:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
