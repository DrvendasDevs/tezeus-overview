import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  profile: string;
}

// Cache global para usuários
let globalUsersCache: User[] = [];
let isFetching = false;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milliseconds

// Listeners para notificar componentes quando o cache é atualizado
const cacheListeners: ((users: User[]) => void)[] = [];

const notifyListeners = (users: User[]) => {
  cacheListeners.forEach(listener => listener(users));
};

const addCacheListener = (listener: (users: User[]) => void) => {
  cacheListeners.push(listener);
  return () => {
    const index = cacheListeners.indexOf(listener);
    if (index > -1) {
      cacheListeners.splice(index, 1);
    }
  };
};

const fetchUsersFromDB = async (workspaceId?: string): Promise<User[]> => {
  // Se já está buscando, retornar cache atual
  if (isFetching) {
    return globalUsersCache;
  }

  // Se cache é recente e workspace é o mesmo, usar cache
  const now = Date.now();
  if (globalUsersCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION && !workspaceId) {
    return globalUsersCache;
  }

  isFetching = true;
  try {
    // Fetching users from database
    
    // Se workspace_id foi fornecido, buscar usuários desse workspace via JOIN
    if (workspaceId) {
      // Fetching workspace users via JOIN
      
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          system_users!inner (
            id,
            name,
            profile,
            status
          )
        `)
        .eq('workspace_id', workspaceId)
        .eq('system_users.status', 'active');

      if (error) {
        console.error('❌ Erro ao buscar usuários do workspace:', error);
        throw error;
      }

      const users = data?.map((member: any) => ({
        id: member.system_users.id,
        name: member.system_users.name,
        profile: member.system_users.profile
      })) || [];
      
      // Workspace users loaded successfully
      return users;
    }

    // Busca global (sem filtro de workspace)
    const { data, error } = await supabase
      .from('system_users')
      .select('id, name, profile')
      .eq('status', 'active')
      .order('name')
      .limit(100);
      
    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }

    const users = data?.map(user => ({ id: user.id, name: user.name, profile: user.profile })) || [];
    
    // Só atualizar cache global se não for filtro por workspace
    if (!workspaceId) {
      globalUsersCache = users;
      cacheTimestamp = now;
      notifyListeners(users);
    }
    
    // All users loaded successfully
    
    return users;
  } catch (error) {
    console.error('❌ Erro crítico ao buscar usuários:', error);
    return globalUsersCache;
  } finally {
    isFetching = false;
  }
};

export const useUsersCache = (workspaceId?: string, filterProfiles?: ('user' | 'admin' | 'master')[]) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await fetchUsersFromDB(workspaceId);
      setUsers(fetchedUsers);
      return { data: fetchedUsers };
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return { error: 'Erro ao carregar usuários' };
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    // Carregar usuários apenas uma vez quando o workspace estiver disponível
    if (workspaceId && users.length === 0 && !isLoading) {
      loadUsers();
    }
  }, [workspaceId, loadUsers, users.length, isLoading]);

  useEffect(() => {
    // Listener para cache global apenas se não tiver workspace específico
    if (!workspaceId && globalUsersCache.length > 0) {
      setUsers(globalUsersCache);
      
      const removeListener = addCacheListener((updatedUsers) => {
        setUsers(updatedUsers);
      });
      return removeListener;
    }
  }, [workspaceId]);

  const refreshUsers = async () => {
    // Força atualização ignorando cache
    if (!workspaceId) {
      cacheTimestamp = 0;
      globalUsersCache = [];
    }
    return loadUsers();
  };

  // Filtrar usuários por perfil se especificado
  const filteredUsers = filterProfiles 
    ? users.filter(user => {
        const matchesFilter = filterProfiles.includes(user.profile as 'user' | 'admin' | 'master');
        return matchesFilter;
      })
    : users;

  // Users filter applied

  return {
    users: filteredUsers,
    isLoading,
    loadUsers,
    refreshUsers
  };
};