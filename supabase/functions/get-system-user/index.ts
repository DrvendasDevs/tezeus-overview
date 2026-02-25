import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Attempting login for email: ${email}`);

    // Get user with password verification
    const { data, error } = await supabase.rpc('get_system_user', {
      user_email: email,
      user_password: password
    });

    console.log('RPC Response - data:', data);
    console.log('RPC Response - error:', error);
    console.log('Data type:', typeof data);
    console.log('Data length:', data ? data.length : 'N/A');

    if (error) {
      console.error('Error authenticating user:', error);
      return new Response(
        JSON.stringify({ error: 'Email ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.log('No user found or invalid credentials - data is empty or null');
      return new Response(
        JSON.stringify({ error: 'Email ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = data[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      console.log('User account is not active');
      return new Response(
        JSON.stringify({ error: 'Conta de usuário inativa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Masters e Support podem fazer login independentemente do status do workspace
    if (user.profile !== 'master' && user.profile !== 'support') {
      // Buscar workspaces do usuário
      const { data: memberWorkspaces, error: workspaceError } = await supabase
        .from('workspace_members')
        .select(`
          workspaces!inner(is_active)
        `)
        .eq('user_id', user.id);

      if (workspaceError) {
        console.error('Error checking workspace status:', workspaceError);
        return new Response(
          JSON.stringify({ error: 'Erro ao verificar status da empresa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se pelo menos um workspace está ativo
      const hasActiveWorkspace = memberWorkspaces?.some((m: any) => 
        m.workspaces?.is_active === true
      );

      if (!hasActiveWorkspace) {
        console.log('User workspace is inactive');
        return new Response(
          JSON.stringify({ error: 'Sua empresa está inativa. Entre em contato com o administrador.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('User authenticated successfully:', user.email);

    // Gerar token único para esta sessão
    const sessionToken = crypto.randomUUID();
    
    // Criar nova sessão ativa PRIMEIRO
    try {
      const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      const { error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          session_token: sessionToken,
          is_active: true,
          user_agent: userAgent,
          ip_address: clientIp
        });

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        // Não falhar o login se houver erro ao criar sessão
      } else {
        console.log('New session created for user:', user.id);
      }
    } catch (error) {
      console.error('Exception creating session:', error);
      // Continuar com o login mesmo se houver erro
    }

    // DEPOIS invalidar todas as sessões anteriores deste usuário (exceto a nova)
    // Isso garante que o Realtime capture a mudança
    try {
      const { data: invalidatedCount, error: invalidateError } = await supabase.rpc('invalidate_user_sessions', {
        p_user_id: user.id,
        p_except_token: sessionToken
      });

      if (invalidateError) {
        console.error('❌ Error invalidating previous sessions:', invalidateError);
        // Não falhar o login se houver erro ao invalidar sessões
      } else {
        console.log(`✅ Invalidated ${invalidatedCount || 0} previous sessions for user ${user.id}`);
        
        // Se houve sessões invalidadas, aguardar um pouco para garantir que o Realtime processe
        if (invalidatedCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('❌ Exception invalidating sessions:', error);
      // Continuar com o login mesmo se houver erro
    }

    return new Response(
      JSON.stringify({ 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          status: user.status,
          avatar: user.avatar,
          cargo_id: user.cargo_id
        },
        sessionToken: sessionToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-system-user:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});