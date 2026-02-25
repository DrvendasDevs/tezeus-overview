import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  userRole: 'master' | 'support' | 'admin' | 'user' | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const mapProfileToRole = (profile: string): 'master' | 'support' | 'admin' | 'user' => {
  const p = (profile || '').toLowerCase();
  switch (p) {
    case 'master':
    case 'mentor_master':
      return 'master';
    case 'support':
      return 'support';
    case 'admin':
    case 'gestor':
      return 'admin';
    default:
      return 'user';
  }
};

export const useAuthState = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userRole, setUserRole] = useState<'master' | 'support' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    let cancelled = false;

    const restoreFromSupabaseSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        const meta: any = session?.user?.user_metadata || {};
        const systemUserId = meta?.system_user_id;

        if (!systemUserId) return;

        const restored: AuthUser = {
          id: String(systemUserId),
          name: String(meta?.system_name || meta?.system_user_name || meta?.name || 'Usuário'),
          email: String(meta?.system_email || meta?.email || session?.user?.email || ''),
          profile: String(meta?.system_profile || meta?.profile || 'user'),
          status: String(meta?.system_status || 'active'),
          avatar: meta?.avatar || undefined,
          cargo_id: meta?.cargo_id || undefined,
        };

        if (cancelled) return;
        setUser(restored);
        setUserRole(mapProfileToRole(restored.profile));
        localStorage.setItem('currentUser', JSON.stringify(restored));
      } catch (e) {
        // Não bloquear a app se não houver sessão Supabase
        console.log('Info: não foi possível restaurar usuário via Supabase Auth:', e);
      }
    };

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserRole(mapProfileToRole(parsedUser.profile));
        setLoading(false);
        return () => {
          cancelled = true;
        };
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }

    // Fallback: restaurar via sessão Supabase (metadata) quando `currentUser` não existe.
    (async () => {
      await restoreFromSupabaseSession();
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncUserContext = async () => {
      if (!user?.id) return;

      try {
        const { error } = await supabase.rpc('set_current_user_context', {
          user_id: user.id,
          user_email: user.email,
        });

        if (error) {
          console.error('Erro ao sincronizar contexto do usuário:', error);
        }
      } catch (contextError) {
        console.error('Exceção ao definir contexto do usuário:', contextError);
      }
    };

    syncUserContext();
  }, [user?.id, user?.email]);

  const login = async (email: string, password: string) => {
    try {
      // Validar credenciais via sistema customizado
      const { data, error } = await supabase.functions.invoke('get-system-user', {
        body: { email, password }
      });

      if (error) {
        // Quando a edge function retorna status 4xx/5xx, o erro pode estar em diferentes lugares
        // Tentar extrair a mensagem do contexto do erro
        let errorMessage = 'Email ou senha inválidos';
        
        // Verificar se há uma mensagem de erro no contexto
        if (error.context?.body) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            errorMessage = errorBody.error || errorMessage;
          } catch (e) {
            // Se não conseguir parsear, usar a mensagem padrão do erro
            errorMessage = error.message || errorMessage;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return { error: errorMessage };
      }

      if (!data.user) {
        const errorMessage = data?.error || 'Email ou senha inválidos';
        return { error: errorMessage };
      }

      const user = data.user;
      
      // Criar uma sessão Supabase para permitir checagens no servidor
      try {
        const supabaseEmail = `${user.id}@tezeus.app`;
        
        // Primeiro tenta fazer signUp (cria conta se não existir)
        const { error: signUpError } = await supabase.auth.signUp({
          email: supabaseEmail,
          password: user.id,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              system_user_id: user.id,
              system_email: user.email,
              system_name: user.name,
              system_profile: user.profile
            }
          }
        });
        
        // Se usuário já existe ou criou com sucesso, fazer signIn
        if (!signUpError || signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: supabaseEmail,
            password: user.id
          });
          
          if (signInError) {
            console.log('Info: Erro no signIn Supabase:', signInError.message);
          } else {
            console.log('Sessão Supabase ativa para chamadas autenticadas');
            
            // Ensure user metadata is updated after login
            try {
              await supabase.auth.updateUser({
                data: {
                  system_user_id: user.id,
                  system_email: user.email,
                  system_name: user.name,
                  system_profile: user.profile
                }
              });
              console.log('User metadata updated successfully');
            } catch (metadataError) {
              console.log('Info: Erro ao atualizar metadata (ignorado):', metadataError);
            }
          }
        }
      } catch (authError) {
        console.log('Info: Erro na autenticação Supabase (ignorado):', authError);
      }

      // Salvar sessionToken se fornecido
      const sessionToken = data.sessionToken;
      if (sessionToken) {
        localStorage.setItem('sessionToken', sessionToken);
      }

      // Definir dados do usuário no estado local
      setUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // Set user role based on profile
      setUserRole(mapProfileToRole(user.profile));


      return {};
    } catch (error) {
      console.error('Login error:', error);
      return { error: 'Erro interno do servidor' };
    }
  };

  const logout = async () => {
    // Invalidar sessão no servidor se houver token
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      try {
        await (supabase
          .from('user_sessions' as any)
          .update({ is_active: false })
          .eq('session_token', sessionToken) as any);
      } catch (error) {
        console.log('Erro ao invalidar sessão no servidor:', error);
      }
    }

    setUser(null);
    setUserRole(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedWorkspace');
    localStorage.removeItem('sessionToken');
    
    // Também fazer logout do Supabase Auth
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('Erro ao fazer logout do Supabase:', error);
    }
  };

  const hasRole = (roles: string[]) => {
    if (!userRole) return false;
    return roles.includes(userRole);
  };

  return {
    user,
    userRole,
    loading,
    login,
    logout,
    hasRole
  };
};

export { AuthContext };