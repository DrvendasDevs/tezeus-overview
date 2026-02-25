import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Keep in sync with other edge functions that accept user identification headers
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('Request received:', requestBody);
    
    const { action, userData, userId, workspaceId } = JSON.parse(requestBody);
    console.log('Action:', action, 'UserData keys:', Object.keys(userData || {}), 'UserId:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Capturar o ID do usuário que está fazendo a requisição (para created_by)
    const createdByUserId = req.headers.get('x-system-user-id');
    console.log('Created by user ID from header:', createdByUserId);

    // For operations that need permission checks, get current user
    let currentUserProfile = null;
    let currentUserId: string | null = null;
    let currentUserWorkspaces: string[] = [];
    
    const authHeader = req.headers.get('Authorization');
    // Expandido para verificar permissões em create, update e delete também
    if (['list', 'create', 'update', 'delete'].includes(action)) {
      let systemUserId: string | null = null;
      
      // Primeiro: tentar obter via Supabase Auth (Authorization header)
      if (authHeader) {
        try {
          const supabaseAuth = createClient(
            supabaseUrl,
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
              global: {
                headers: {
                  Authorization: authHeader
                }
              }
            }
          );
          
          const { data: { user } } = await supabaseAuth.auth.getUser();
          
          // Get system_user_id from metadata or fallback to extracting from synthetic email
          systemUserId = user?.user_metadata?.system_user_id || null;
          if (!systemUserId && user?.email) {
            // Extract UUID from synthetic email format: ${uuid}@{domain}
            const emailMatch = user.email.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})@/);
            if (emailMatch) {
              systemUserId = emailMatch[1];
              console.log('Extracted system_user_id from email:', systemUserId);
            }
          } else if (systemUserId) {
            console.log('Using system_user_id from metadata:', systemUserId);
          }
        } catch (authError) {
          console.log('Auth check error (will try header fallback):', authError);
        }
      }
      
      // Fallback: usar o header x-system-user-id se não conseguiu via Auth
      if (!systemUserId && createdByUserId) {
        systemUserId = createdByUserId;
        console.log('Using system_user_id from x-system-user-id header:', systemUserId);
      }
      
      // Buscar o perfil do usuário atual
      if (systemUserId) {
        currentUserId = systemUserId;
        const { data: systemUser } = await supabase
          .from('system_users')
          .select('profile')
          .eq('id', systemUserId)
          .single();
        
        currentUserProfile = systemUser?.profile;
        console.log('Current user profile:', currentUserProfile);
        
        // Get user workspaces if not master or support
        if (currentUserProfile && currentUserProfile !== 'master' && currentUserProfile !== 'support') {
          const { data: memberships } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', systemUserId);
          
          currentUserWorkspaces = memberships?.map(m => m.workspace_id) || [];
          console.log('Current user workspaces:', currentUserWorkspaces);
        }
      }
    }

    if (action === 'create') {
      const { name, email, profile, senha, cargo_ids, default_channel, status } = userData;
      const normalizedEmail = email?.trim()?.toLowerCase();
      
      console.log('Fields received:', {
        name: name || 'MISSING',
        email: email || 'MISSING', 
        profile: profile || 'MISSING',
        senha: senha ? 'PROVIDED' : 'MISSING',
        status: status || 'active',
        cargo_ids: cargo_ids || [],
        default_channel: default_channel || null
      });

      // Validate required fields
      if (!name?.trim() || !email?.trim() || !profile?.trim() || !senha?.trim()) {
        const missing: string[] = [];
        if (!name?.trim()) missing.push('nome');
        if (!email?.trim()) missing.push('email');
        if (!profile?.trim()) missing.push('perfil');
        if (!senha?.trim()) missing.push('senha');
        
        console.error('Missing fields:', missing);
        return new Response(
          JSON.stringify({ error: `Campos obrigatórios: ${missing.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar permissões de criação de perfil
      // Usuário 'support' não pode criar 'master' nem 'support'
      if (currentUserProfile === 'support' && (profile === 'master' || profile === 'support')) {
        console.error('Support user trying to create restricted profile:', profile);
        return new Response(
          JSON.stringify({ error: 'Você não tem permissão para criar usuários deste perfil.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Apenas 'master' pode criar outros 'master' ou 'support'
      if ((profile === 'master' || profile === 'support') && currentUserProfile !== 'master') {
        console.error('Non-master user trying to create master/support profile');
        return new Response(
          JSON.stringify({ error: 'Apenas usuários Master podem criar este tipo de perfil.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // If the email already exists, return a user-friendly message.
        // When workspaceId is provided, make the message specific to "already in this company".
        if (normalizedEmail) {
          const { data: existingUser, error: existingUserError } = await supabase
            .from('system_users')
            .select('id, email')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (existingUserError) {
            console.error('Error checking existing user by email:', existingUserError);
          } else if (existingUser?.id) {
            if (workspaceId) {
              const { data: existingMembership, error: membershipError } = await supabase
                .from('workspace_members')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('user_id', existingUser.id)
                .maybeSingle();

              if (membershipError) {
                console.error('Error checking existing membership:', membershipError);
              }

              if (existingMembership?.id) {
                return new Response(
                  JSON.stringify({ error: 'Este e-mail já está cadastrado nesta empresa.' }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }

              return new Response(
                JSON.stringify({ error: 'Este e-mail já está cadastrado no sistema. Você pode vincular este usuário à empresa em vez de criar novamente.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            return new Response(
              JSON.stringify({ error: 'Este email já está sendo usado por outro usuário' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Insert user directly (let database handle unique constraints)
        console.log('Attempting to insert user...');
        const insertData: Record<string, any> = {
          name: name.trim(),
          email: normalizedEmail,
          profile: profile.trim(),
          status: status || 'active',
          senha: senha,
          default_channel: default_channel || null
        };
        
        // Adicionar created_by se disponível
        if (createdByUserId) {
          insertData.created_by = createdByUserId;
          console.log('Setting created_by:', createdByUserId);
        }
        
        const { data, error } = await supabase
          .from('system_users')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('Insert error:', error);
          if (error.code === '23505' && error.message?.includes('email')) {
            return new Response(
              JSON.stringify({ error: 'Este email já está sendo usado por outro usuário' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('User created successfully:', data.id);

        // Handle cargos
        if (cargo_ids && Array.isArray(cargo_ids) && cargo_ids.length > 0 && data) {
          console.log('Adding cargos:', cargo_ids);
          for (const cargoId of cargo_ids) {
            try {
              await supabase
                .from('system_user_cargos')
                .insert({ user_id: data.id, cargo_id: cargoId });
            } catch (cargoError) {
              console.error('Cargo error:', cargoError);
              // Continue with other cargos
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (insertError) {
        console.error('Unexpected insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro interno do servidor' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'list') {
      const { data: users, error } = await supabase
        .from('system_users_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('List error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter users based on current user permissions
      let filteredUsers = users;
      
      if (currentUserProfile === 'admin' && currentUserWorkspaces.length > 0) {
        // Admin users only see users from their workspaces
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('user_id')
          .in('workspace_id', currentUserWorkspaces);
        
        const allowedUserIds = new Set(memberships?.map(m => m.user_id) || []);
        filteredUsers = users.filter(user => allowedUserIds.has(user.id));
        console.log('Filtered users for admin:', filteredUsers.length, 'out of', users.length);
      }

      // Enrich users with workspace information and cargo names
      if (filteredUsers && filteredUsers.length > 0) {
        const userIds = filteredUsers.map(user => user.id);
        
        // Get workspace memberships for filtered users
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('user_id, role, workspace_id')
          .in('user_id', userIds);

        // Get workspace details
        const workspaceIds = memberships ? Array.from(new Set(memberships.map(m => m.workspace_id))) : [];
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id, name')
          .in('id', workspaceIds);

        // Get cargo associations for filtered users
        const { data: userCargos } = await supabase
          .from('system_user_cargos')
          .select('user_id, cargo_id')
          .in('user_id', userIds);

        // Get all cargo IDs
        const cargoIds = userCargos ? Array.from(new Set(userCargos.map(uc => uc.cargo_id))) : [];
        const { data: cargos } = await supabase
          .from('cargos')
          .select('id, nome')
          .in('id', cargoIds);

        // Create workspace lookup
        const workspaceMap = new Map();
        if (workspaces) {
          workspaces.forEach(ws => workspaceMap.set(ws.id, ws));
        }

        // Create cargo lookup
        const cargoMap = new Map();
        if (cargos) {
          cargos.forEach(c => cargoMap.set(c.id, c.nome));
        }

        // Enrich each user with workspace data and cargo names
        const enrichedUsers = filteredUsers.map(user => {
          const userMemberships = memberships ? memberships.filter(m => m.user_id === user.id) : [];
          const userWorkspaces = userMemberships.map(m => ({
            id: m.workspace_id,
            name: workspaceMap.get(m.workspace_id)?.name || 'Workspace não encontrado',
            role: m.role
          }));

          // Get user's cargo names
          const userCargoAssociations = userCargos ? userCargos.filter(uc => uc.user_id === user.id) : [];
          const cargoNames = userCargoAssociations.map(uc => cargoMap.get(uc.cargo_id)).filter(Boolean);

          // Create empresa summary string
          let empresa = '-';
          if (userWorkspaces.length > 0) {
            if (userWorkspaces.length === 1) {
              empresa = userWorkspaces[0].name;
            } else {
              empresa = `${userWorkspaces[0].name} (+${userWorkspaces.length - 1})`;
            }
          }

          return {
            ...user,
            workspaces: userWorkspaces,
            empresa,
            cargo_names: cargoNames
          };
        });

        return new Response(
          JSON.stringify({ success: true, data: enrichedUsers }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: users }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required for update' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { cargo_ids, ...userUpdateData } = userData;
      
      // Clean up empty string values and convert to null for UUID fields
      const cleanedData = { ...userUpdateData };
      if (cleanedData.default_channel === '' || cleanedData.default_channel === 'undefined') {
        cleanedData.default_channel = null;
      }
      if (cleanedData.phone === '') {
        cleanedData.phone = null;
      }
      
      console.log('Updating user with cleaned data:', cleanedData);
      
      const { data, error } = await supabase
        .from('system_users')
        .update(cleanedData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        return new Response(
          JSON.stringify({ error: `Failed to update user: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle cargo assignments if provided
      if (cargo_ids !== undefined) {
        // Remove existing cargos
        await supabase
          .from('system_user_cargos')
          .delete()
          .eq('user_id', userId);

        // Add new cargos
        if (Array.isArray(cargo_ids) && cargo_ids.length > 0) {
          for (const cargoId of cargo_ids) {
            await supabase
              .from('system_user_cargos')
              .insert({ user_id: userId, cargo_id: cargoId });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required for delete' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Impedir que o usuário delete a si mesmo
      if (currentUserId && userId === currentUserId) {
        console.error('User trying to delete themselves:', userId);
        return new Response(
          JSON.stringify({ error: 'Você não pode excluir seu próprio usuário.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se usuário 'support' está tentando deletar 'master' ou 'support'
      if (currentUserProfile === 'support') {
        const { data: targetUser } = await supabase
          .from('system_users')
          .select('profile')
          .eq('id', userId)
          .single();
        
        if (targetUser && (targetUser.profile === 'master' || targetUser.profile === 'support')) {
          console.error('Support user trying to delete restricted profile:', targetUser.profile);
          return new Response(
            JSON.stringify({ error: 'Você não tem permissão para excluir este tipo de usuário.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // First delete cargo assignments
      await supabase
        .from('system_user_cargos')
        .delete()
        .eq('user_id', userId);

      const { data, error } = await supabase
        .from('system_users')
        .delete()
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Delete error:', error);
        return new Response(
          JSON.stringify({ error: `Failed to delete user: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Action not supported' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Internal error', 
        message: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});