import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// Helper function to return error response with CORS
function errorResponse(message: string, status: number = 500) {
  console.error(`❌ Error: ${message}`);
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}

// Helper function to return success response with CORS
function successResponse(data: any) {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}

serve(async (req): Promise<Response> => {
  console.log('🚀 list-user-workspaces function started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Add timeout to the entire operation
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Function timeout after 25 seconds')), 25000);
    });

    const mainPromise = (async () => {
      console.log('🔧 Initializing Supabase client...');
      
      // Initialize Supabase client with service role for bypassing RLS
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing required environment variables');
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      console.log('✅ Supabase client initialized');

      console.log('🔐 Processing authentication...');
      
      // Try authentication via JWT first
      let systemUserId = null;
      let systemUserEmail = null;
      
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          console.log('🔑 Attempting JWT authentication...');
          const token = authHeader.replace('Bearer ', '');
          const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
          if (!anonKey) {
            throw new Error('Missing SUPABASE_ANON_KEY');
          }
          
          const { data: { user }, error: authError } = await createClient(supabaseUrl, anonKey)
            .auth.getUser(token);
          
          if (authError) {
            console.log('JWT auth error:', authError.message);
          } else if (user?.email) {
            systemUserEmail = user.email;
            console.log('✅ Authenticated via JWT, email:', systemUserEmail);
          }
        } catch (jwtError) {
          console.log('⚠️ JWT auth failed, trying headers:', jwtError);
        }
      }

      // Fall back to header authentication
      if (!systemUserEmail) {
        systemUserId = req.headers.get('x-system-user-id');
        systemUserEmail = req.headers.get('x-system-user-email');
        console.log('🔗 Using header auth - ID:', systemUserId, 'Email:', systemUserEmail);
      }

      if (!systemUserId && !systemUserEmail) {
        throw new Error('Authentication required - no user ID or email provided');
      }

      console.log('👤 Fetching system user info...');
      
      // Get system user info
      let systemUserQuery = supabase
        .from('system_users')
        .select('id, profile, email, status');

      if (systemUserId) {
        systemUserQuery = systemUserQuery.eq('id', systemUserId);
      } else {
        systemUserQuery = systemUserQuery.eq('email', systemUserEmail);
      }

      const { data: systemUser, error: userError } = await systemUserQuery
        .eq('status', 'active')
        .single();

      if (userError) {
        console.error('❌ System user query error:', userError);
        throw new Error(`User lookup failed: ${userError.message}`);
      }
      
      if (!systemUser) {
        throw new Error('User not found or inactive');
      }

      console.log('✅ Found system user:', systemUser.id, 'profile:', systemUser.profile);

      // If user is master or support, return all workspaces (including inactive ones for management)
      if (systemUser.profile === 'master' || systemUser.profile === 'support') {
        console.log(`🔐 User is ${systemUser.profile}, fetching all workspaces...`);
        
        const { data: workspaces, error: workspacesError } = await supabase
          .from('workspaces_view')
          .select('*')
          .neq('workspace_id', '00000000-0000-0000-0000-000000000000')
          .order('name');

        if (workspacesError) {
          console.error('❌ Error fetching workspaces for master/support:', workspacesError);
          throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
        }

        // Fetch status e default_pipeline_id direto da tabela base
        const { data: workspaceStatuses, error: statusError } = await supabase
          .from('workspaces')
          .select('id, is_active, default_pipeline_id')
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (statusError) {
          console.error('❌ Error fetching workspace statuses:', statusError);
        }

        // Merge is_active into workspaces
        const workspacesWithStatus = workspaces?.map(w => ({
          ...w,
          is_active: workspaceStatuses?.find(s => s.id === w.workspace_id)?.is_active ?? true,
          default_pipeline_id: workspaceStatuses?.find(s => s.id === w.workspace_id)?.default_pipeline_id ?? null
        })) || [];

        console.log('✅ Returning', workspacesWithStatus?.length || 0, 'workspaces for', systemUser.profile, 'user');
        return successResponse({ 
          workspaces: workspacesWithStatus || [], 
          userRole: systemUser.profile 
        });
      }

      // For admin/user, get workspaces from membership (only active ones)
      console.log('👥 User is not master, fetching workspace memberships...');
      
      const { data: memberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select(`
          workspace_id,
          role,
          workspaces!inner(
            id,
            name,
            default_pipeline_id,
            slug,
            cnpj,
            created_at,
            updated_at,
            is_active
          )
        `)
        .eq('user_id', systemUser.id)
        .eq('workspaces.is_active', true);

      if (membershipError) {
        console.error('❌ Error fetching workspace memberships:', membershipError);
        throw new Error(`Failed to fetch workspace memberships: ${membershipError.message}`);
      }

      console.log('🔄 Transforming membership data...');
      
      // Transform the data to match expected format
      const workspaces = memberships?.map(m => {
        // Handle both array and object format from Supabase join
        const workspace = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
        return {
          workspace_id: workspace.id,
          name: workspace.name,
          default_pipeline_id: workspace.default_pipeline_id ?? null,
          slug: workspace.slug,
          cnpj: workspace.cnpj,
          created_at: workspace.created_at,
          updated_at: workspace.updated_at,
          is_active: workspace.is_active,
          connections_count: 0 // We don't need this for the basic functionality
        };
      }) || [];

      // Get user memberships for role calculation
      const userMemberships = memberships?.map(m => ({
        workspaceId: m.workspace_id,
        role: m.role
      })) || [];

      console.log('✅ Returning', workspaces.length, 'workspaces for user:', systemUser.id);

      return successResponse({ 
        workspaces, 
        userMemberships,
        userRole: systemUser.profile 
      });
    })();

    // Race between main operation and timeout
    const result = await Promise.race([mainPromise, timeoutPromise]);
    return result as Response;

  } catch (error) {
    console.error('❌ Critical error in list-user-workspaces function:', error);
    
    // Ensure we always return a proper error response with CORS
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(errorMessage, 500);
  }
});