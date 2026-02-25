import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function useWorkspaceStatusCheck() {
  const { userRole, logout } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    // Masters não precisam dessa verificação
    if (userRole === 'master' || !selectedWorkspace) return;

    const checkWorkspaceStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('is_active')
          .eq('id', selectedWorkspace.workspace_id)
          .maybeSingle(); // Use maybeSingle instead of single to avoid 406

        // Se der erro 406 ou similar, ignorar silenciosamente
        // (pode ser problema de RLS ou configuração)
        if (error) {
          console.warn('⚠️ [useWorkspaceStatusCheck] Erro ao verificar status do workspace:', error.message);
          // Não fazer logout em caso de erro de query
          return;
        }

        if (data && (data as any).is_active === false) {
          // Workspace inativo - forçar logout
          toast.error('Sua empresa foi inativada. Entre em contato com o administrador.');
          await logout();
          navigate('/login');
        }
      } catch (err) {
        console.warn('⚠️ [useWorkspaceStatusCheck] Erro inesperado:', err);
        // Ignorar erros silenciosamente para não bloquear a aplicação
      }
    };

    // Verificar imediatamente
    checkWorkspaceStatus();

    // Verificar a cada 30 segundos
    const interval = setInterval(checkWorkspaceStatus, 30000);

    return () => clearInterval(interval);
  }, [selectedWorkspace, userRole, logout, navigate]);
}
