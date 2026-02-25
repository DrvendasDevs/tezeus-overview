import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  const { user, userRole, login } = useAuth();
  const navigate = useNavigate();

  // Garantir que a página de login sempre use tema claro
  useEffect(() => {
    // Remover classe dark ao montar o componente
    document.documentElement.classList.remove('dark');
    
    // Restaurar tema original ao desmontar (se necessário)
    return () => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  // Redirecionar após login bem-sucedido baseado na role
  useEffect(() => {
    if (loginSuccess && user && userRole) {
      if (userRole === 'master' || userRole === 'support') {
        // Master e Support SEMPRE vão para Central Tezeus após login
        navigate('/master-dashboard');
      } else {
        navigate('/relatorios');
      }
    }
  }, [loginSuccess, user, userRole, navigate]);

  // Redirect if already logged in
  if (user && !loading) {
    if (userRole === 'master' || userRole === 'support') {
      // Master e Support SEMPRE vão para Central Tezeus
      return <Navigate to="/master-dashboard" replace />;
    }
    return <Navigate to="/relatorios" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(email, password);
      
      if (result.error) {
        // Se for erro de empresa inativa, usar mesma notificação do deslogamento automático
        if (result.error.toLowerCase().includes('empresa') && 
            (result.error.toLowerCase().includes('inativa') || 
             result.error.toLowerCase().includes('inativada'))) {
          sonnerToast.error(result.error);
        } else {
          // Para outros erros de login, manter toast normal
          toast({
            title: "Erro no login",
            description: result.error,
            variant: "destructive"
          });
        }
      } else {
        // ✅ CRÍTICO: Buscar e salvar workspace ANTES de qualquer redirecionamento
        const currentUserStr = localStorage.getItem('currentUser');
        if (currentUserStr) {
          try {
            const loggedUser = JSON.parse(currentUserStr);
            const userRole = loggedUser?.profile;
            
            console.log('🔄 Fetching workspace for user:', loggedUser.email);
            
            if (userRole === 'admin' || userRole === 'user') {
              const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
                headers: {
                  'x-system-user-id': loggedUser.id,
                  'x-system-user-email': loggedUser.email || ''
                }
              });
              
              console.log('📡 Workspace fetch response:', { 
                error: error ? 'ERROR' : 'OK', 
                workspacesCount: data?.workspaces?.length || 0 
              });
              
              if (!error && data?.workspaces && data.workspaces.length > 0) {
                const userWorkspace = {
                  workspace_id: data.workspaces[0].workspace_id || data.workspaces[0].id,
                  name: data.workspaces[0].name,
                  slug: data.workspaces[0].slug,
                  cnpj: data.workspaces[0].cnpj,
                  created_at: data.workspaces[0].created_at,
                  updated_at: data.workspaces[0].updated_at,
                  connections_count: data.workspaces[0].connections_count || 0
                };
                
                console.log('✅ Workspace salvo no login:', userWorkspace.name);
                localStorage.setItem('selectedWorkspace', JSON.stringify(userWorkspace));
              } else {
                console.warn('⚠️ Nenhum workspace encontrado para o usuário');
              }
            }
          } catch (error) {
            console.error('❌ Erro ao buscar workspace no login:', error);
          }
        }
        
        // ✅ SÓ AGORA disparar toast e redirecionamento
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando...",
        });
        setLoginSuccess(true);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 dark:bg-white">
      <Card className="w-full max-w-md bg-white dark:bg-white border-gray-200 dark:border-gray-200 shadow-lg">
        <CardHeader className="text-center bg-white dark:bg-white">
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-900">
            Tezeus CRM
          </CardTitle>
          <p className="text-gray-600 dark:text-gray-600">
            Faça login para acessar o sistema
          </p>
        </CardHeader>
        
        <CardContent className="bg-white dark:bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-900 dark:text-gray-900">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-white dark:bg-white text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-400"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-900 dark:text-gray-900">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-white dark:bg-white text-gray-900 dark:text-gray-900 border-gray-300 dark:border-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-100 text-gray-600 dark:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-primary dark:hover:bg-primary/90 dark:text-primary-foreground" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Entrando...
                </div>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};