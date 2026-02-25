import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Master não pode acessar rotas de empresa diretamente
  if (userRole === 'master') {
    const allowedMasterPaths = [
      '/master-dashboard',
      '/workspace/',
      '/administracao-usuarios',
      '/administracao-financeiro', 
      '/administracao-configuracoes',
      '/administracao-dashboard',
      '/empresa',
      '/parceiros-clientes'
    ];
    
    // Verificar se a rota atual é permitida para Master
    const isAllowedPath = allowedMasterPaths.some(path => 
      location.pathname.startsWith(path)
    );
    
    if (!isAllowedPath) {
      // Master tentou acessar rota não permitida, limpar workspace e redirecionar
      console.warn('⚠️ Master tentou acessar rota não permitida:', location.pathname);
      if (selectedWorkspace) {
        localStorage.removeItem('selectedWorkspace');
      }
      return <Navigate to="/master-dashboard" replace />;
    }
  }

  return <>{children}</>;
};