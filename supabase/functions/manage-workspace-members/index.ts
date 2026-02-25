import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, workspaceId, userId, role, memberId, updates } = await req.json()

    if (!action || !workspaceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user identification - try multiple sources
    let systemUserId = req.headers.get('x-system-user-id')
    let userEmail = req.headers.get('x-system-user-email')
    
    console.log('Headers received:', {
      'x-system-user-id': systemUserId,
      'x-system-user-email': userEmail,
      'authorization': req.headers.get('Authorization') ? 'present' : 'missing'
    })

    // Fallback to auth if headers not provided
    if (!systemUserId || !userEmail) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        console.error('No authorization header and no fallback headers provided')
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication required. Please provide either authorization header or user identification headers.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get current user profile
      const supabaseAuth = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        {
          global: {
            headers: {
              Authorization: authHeader
            }
          }
        }
      )
      
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
      if (authError || !user) {
        console.error('Auth error:', authError)
        return new Response(
          JSON.stringify({ success: false, error: 'User not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get system_user_id from metadata or fallback to extracting from synthetic email
      systemUserId = user.user_metadata?.system_user_id;
      userEmail = user.email || null;
      
      if (!systemUserId && userEmail) {
        // Extract UUID from synthetic email format: ${uuid}@{domain}
        const emailMatch = userEmail.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@/);
        if (emailMatch) {
          systemUserId = emailMatch[1];
          console.log('Extracted system_user_id from email:', systemUserId);
        }
      }
    }

    if (!systemUserId) {
      console.error('Could not determine system user ID')
      return new Response(
        JSON.stringify({ success: false, error: 'User identification failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Using system_user_id:', systemUserId)

    const { data: systemUser, error: userError } = await supabase
      .from('system_users')
      .select('profile')
      .eq('id', systemUserId)
      .maybeSingle()
    
    if (userError) {
      console.error('Error fetching system user:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!systemUser) {
      console.error('System user not found:', systemUserId)
      return new Response(
        JSON.stringify({ success: false, error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Check if user can manage this workspace
    const isMaster = systemUser.profile === 'master'
    const isGlobalAdmin = systemUser.profile === 'admin'
    let canManageWorkspace = isMaster || isGlobalAdmin
    let isMemberOfWorkspace = false
    
    console.log('User profile:', systemUser.profile, 'isMaster:', isMaster, 'isGlobalAdmin:', isGlobalAdmin)
    
    if (!isMaster && !isGlobalAdmin) {
      // Check if user is admin or master in this workspace
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', systemUserId)
        .eq('workspace_id', workspaceId)
        .maybeSingle()
      
      if (membershipError) {
        console.error('Error checking workspace membership:', membershipError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to verify workspace permissions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Workspace membership:', membership)
      canManageWorkspace = membership?.role === 'admin' || membership?.role === 'master'
      isMemberOfWorkspace = !!membership
    } else {
      // Master and global admin are automatically considered members
      isMemberOfWorkspace = true
    }
    
    // For 'list' action, any workspace member can view
    // For other actions, need to be admin/master
    if (action !== 'list' && !canManageWorkspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions to manage this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // For 'list' action, verify user is at least a member
    if (action === 'list' && !isMaster && !isGlobalAdmin && !isMemberOfWorkspace) {
      return new Response(
        JSON.stringify({ success: false, error: 'You must be a member of this workspace to view members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`User authorized to manage workspace ${workspaceId}`)

    switch (action) {
      case 'list':
        // First get workspace members
        const { data: membersData, error: listError } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })

        if (listError) {
          return new Response(
            JSON.stringify({ success: false, error: listError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (!membersData || membersData.length === 0) {
          return new Response(
            JSON.stringify({ success: true, members: [] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get user IDs from members
        const userIds = membersData.map(member => member.user_id)

        // Fetch user details separately 
        const { data: users, error: usersError } = await supabase
          .from('system_users')
          .select('id, name, email, profile, phone, status, avatar')
          .in('id', userIds)

        if (usersError) {
          console.error('Error fetching users:', usersError)
          return new Response(
            JSON.stringify({ success: false, error: usersError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fetch user cargos
        const { data: userCargos } = await supabase
          .from('system_user_cargos')
          .select('user_id, cargo_id, cargos(id, nome)')
          .in('user_id', userIds)

        // Transform the data to match the expected format
        let members = membersData.map(member => {
          const user = users?.find(u => u.id === member.user_id)
          const cargos = userCargos?.filter(uc => uc.user_id === member.user_id) || []
          
          return {
            id: member.id,
            workspace_id: workspaceId,
            user_id: member.user_id,
            role: member.role,
            is_hidden: member.is_hidden,
            created_at: member.created_at,
            user: user ? {
              id: user.id,
              name: user.name,
              email: user.email,
              profile: user.profile,
              phone: user.phone,
              status: user.status,
              avatar: user.avatar,
              cargo_names: cargos.map(c => {
                const cargo = Array.isArray(c.cargos) ? c.cargos[0] : c.cargos;
                return cargo?.nome;
              }).filter(Boolean)
            } : null
          }
        })

        // Always filter out master users from workspace member list
        members = members.filter(member => member.user?.profile !== 'master')

        return new Response(
          JSON.stringify({ success: true, members }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'add':
        if (!userId || !role) {
          return new Response(
            JSON.stringify({ success: false, error: 'userId and role required for add action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check user limit before adding
        const { data: limits, error: limitsError } = await supabase
          .from('workspace_limits')
          .select('user_limit')
          .eq('workspace_id', workspaceId)
          .maybeSingle()

        if (limitsError) {
          console.error('Error fetching workspace limits:', limitsError)
        }

        // user_limit semantics:
        // - null/undefined => use default (5)
        // - 0 => unlimited (do not enforce)
        const userLimit = (limits?.user_limit ?? 5)

        // Count current users (exclude hidden members and master role)
        const { count: currentUserCount, error: countError } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('is_hidden', false)
          .neq('role', 'master')

        if (countError) {
          console.error('Error counting workspace members:', countError)
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to check workspace user limit' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Current users:', currentUserCount, 'Limit:', userLimit, 'Raw limits row:', limits)

        // Check if limit reached (only for non-master workspaces)
        if (!isMaster && userLimit > 0 && (currentUserCount ?? 0) >= userLimit) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Limite de usuários atingido. Atual: ${currentUserCount}/${userLimit}. Entre em contato com o administrador para aumentar o limite.` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspaceId,
            user_id: userId,
            role
          })
          .select()
          .single()

        if (memberError) {
          // Friendly error for duplicated membership
          if (memberError.code === '23505' || memberError.message?.toLowerCase().includes('duplicate key')) {
            return new Response(
              JSON.stringify({ success: false, error: 'Este usuário já está vinculado a esta empresa.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ success: false, error: memberError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true, member: memberData }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'update':
        if (!memberId || !updates) {
          return new Response(
            JSON.stringify({ success: false, error: 'memberId and updates required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { error: updateError } = await supabase
          .from('workspace_members')
          .update(updates)
          .eq('id', memberId)

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'remove':
        if (!memberId) {
          return new Response(
            JSON.stringify({ success: false, error: 'memberId required for remove action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // 1. Obter o user_id do membro antes de deletar
        const { data: memberToRemove, error: memberFetchError } = await supabase
          .from('workspace_members')
          .select('user_id')
          .eq('id', memberId)
          .single()

        if (memberFetchError || !memberToRemove) {
          console.error('Error fetching member data:', memberFetchError)
          return new Response(
            JSON.stringify({ success: false, error: 'Membro não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const userIdToCheck = memberToRemove.user_id

        // 2. Deletar o membro do workspace
        const { error: removeError } = await supabase
          .from('workspace_members')
          .delete()
          .eq('id', memberId)

        if (removeError) {
          return new Response(
            JSON.stringify({ success: false, error: removeError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // 3. Verificar se o usuário tem outras empresas vinculadas
        const { data: remainingMemberships, error: checkError } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('user_id', userIdToCheck)
          .limit(1)

        if (checkError) {
          console.error('Error checking remaining memberships:', checkError)
          // Continua mesmo com erro, pois o membro já foi removido
        }

        // 4. Se não tiver mais nenhuma empresa, deletar o usuário completamente
        if (!remainingMemberships || remainingMemberships.length === 0) {
          console.log(`🗑️ Usuário ${userIdToCheck} não tem mais empresas vinculadas. Removendo do sistema...`)
          
          // Deletar cargos do usuário
          await supabase
            .from('system_user_cargos')
            .delete()
            .eq('user_id', userIdToCheck)

          // Deletar o usuário da system_users
          const { error: deleteUserError } = await supabase
            .from('system_users')
            .delete()
            .eq('id', userIdToCheck)

          if (deleteUserError) {
            console.error('Error deleting user from system_users:', deleteUserError)
            // Não retorna erro pois o membro já foi removido do workspace
          } else {
            console.log(`✅ Usuário ${userIdToCheck} removido completamente do sistema`)
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Error managing workspace members:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})