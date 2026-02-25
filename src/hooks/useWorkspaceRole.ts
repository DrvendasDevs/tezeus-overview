import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type WorkspaceRole = 'master' | 'admin' | 'user';

interface WorkspaceRoleHook {
  userWorkspaceRole: WorkspaceRole | null;
  isMaster: boolean;
  isAdmin: (workspaceId?: string) => boolean;
  isUser: (workspaceId?: string) => boolean;
  canCreateConnections: (workspaceId?: string) => boolean;
  canManageWorkspace: (workspaceId?: string) => boolean;
  canManagePipelines: (workspaceId?: string) => boolean;
  canManageColumns: (workspaceId?: string) => boolean;
  getUserWorkspaces: () => Promise<string[]>;
  loading: boolean;
}

export function useWorkspaceRole(): WorkspaceRoleHook {
  const { user, userRole } = useAuth();
  const [userWorkspaceRole, setUserWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<{workspaceId: string, role: WorkspaceRole}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserWorkspaceRoles = async () => {
      if (!user?.id) {
        setUserWorkspaceRole(null);
        setUserWorkspaces([]);
        setLoading(false);
        return;
      }

      try {
        // Fetching workspace roles via Edge function
        
        // Use the Edge function to get workspace data and role information
        const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
          headers: {
            'x-system-user-id': user.id,
            'x-system-user-email': user.email || ''
          }
        });

        if (error) {
          console.error('Error fetching workspace data from Edge function:', error);
          // Fallback to userRole from auth if Edge function fails
          console.log('Falling back to userRole from auth:', userRole);
          setUserWorkspaceRole(userRole === 'master' ? 'master' : userRole === 'admin' ? 'admin' : 'user');
          setUserWorkspaces([]);
          setLoading(false);
          return;
        }

        const backendUserRole = data?.userRole || 'user';
        const memberships = data?.userMemberships || [];

        console.log('🔍 useWorkspaceRole - Data from Edge Function:', {
          backendUserRole,
          memberships,
          userRoleFromAuth: userRole
        });

        // IMPORTANTE: Se o usuário tem profile admin no sistema, ele é admin globalmente
        if (backendUserRole === 'master') {
          setUserWorkspaceRole('master');
          setUserWorkspaces(memberships.map((m: any) => ({ workspaceId: m.workspaceId, role: 'master' })));
        } else if (backendUserRole === 'admin') {
          // Se o profile global é admin, o usuário é admin em todos os workspaces
          setUserWorkspaceRole('admin');
          setUserWorkspaces(memberships.map((m: any) => ({ 
            workspaceId: m.workspaceId, 
            role: 'admin' // Força admin mesmo que o membership seja user
          })));
        } else if (memberships && memberships.length > 0) {
          setUserWorkspaces(memberships.map((m: any) => ({ workspaceId: m.workspaceId, role: m.role as WorkspaceRole })));
          
          // Para usuários não-admin, usa o role do membership
          const hasAdmin = memberships.some((m: any) => m.role === 'admin');
          const finalRole = hasAdmin ? 'admin' : 'user';
          console.log('🔍 useWorkspaceRole - Setting role from memberships:', { hasAdmin, finalRole });
          setUserWorkspaceRole(finalRole);
        } else {
          setUserWorkspaceRole(null);
          setUserWorkspaces([]);
        }
      } catch (error) {
        console.error('Error in fetchUserWorkspaceRoles:', error);
        // Fallback to userRole from auth if there's an exception
        console.log('Falling back to userRole from auth due to error:', userRole);
        setUserWorkspaceRole(userRole === 'master' ? 'master' : userRole === 'admin' ? 'admin' : 'user');
        setUserWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserWorkspaceRoles();
  }, [user?.id, userRole]);

  const isMaster = userRole === 'master' || userWorkspaceRole === 'master';

  const isAdmin = (workspaceId?: string) => {
    if (userRole === 'master' || userWorkspaceRole === 'master') return true;
    if (!workspaceId) return userWorkspaceRole === 'admin';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && (w.role === 'admin' || w.role === 'master'));
  };

  const isUser = (workspaceId?: string) => {
    if (!workspaceId) return userWorkspaceRole === 'user';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && w.role === 'user');
  };

  const canCreateConnections = (workspaceId?: string) => {
    // master can create connections anywhere
    if (isMaster) return true;
    
    // admin can create connections in their workspace
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    // If no specific workspace, check if user is at least admin somewhere
    return userWorkspaceRole === 'admin';
  };

  const canManageWorkspace = (workspaceId?: string) => {
    // master can manage any workspace
    if (isMaster) return true;
    
    // admin can manage their workspace (but not create new ones)
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    return false;
  };

  const canManagePipelines = (workspaceId?: string) => {
    // master e admin podem gerenciar pipelines
    if (isMaster) return true;
    
    // admin pode gerenciar pipelines no workspace dele
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    // Se não especificar workspace, verifica se é pelo menos admin em algum lugar
    return userWorkspaceRole === 'admin';
  };

  const canManageColumns = (workspaceId?: string) => {
    // master e admin podem gerenciar colunas
    if (isMaster) return true;
    
    // admin pode gerenciar colunas no workspace dele
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    // Se não especificar workspace, verifica se é pelo menos admin em algum lugar
    return userWorkspaceRole === 'admin';
  };

  const getUserWorkspaces = async (): Promise<string[]> => {
    if (isMaster) {
      // master has access to all workspaces
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      return allWorkspaces?.map(w => w.id) || [];
    }
    
    return userWorkspaces.map(w => w.workspaceId);
  };

  return {
    userWorkspaceRole,
    isMaster,
    isAdmin,
    isUser,
    canCreateConnections,
    canManageWorkspace,
    canManagePipelines,
    canManageColumns,
    getUserWorkspaces,
    loading
  };
}