import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface CargoPermissions {
  [moduleId: string]: {
    ver?: boolean;
    criar?: boolean;
    editar?: boolean;
    deletar?: boolean;
  };
}

export const useCargoPermissions = () => {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState<CargoPermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      // APENAS Master tem acesso total sempre (nunca sofre restrições de cargo)
      if (userRole === 'master') {
        setLoading(false);
        return;
      }

      // Admin e User podem ter cargo com restrições
      if (user?.cargo_id) {
        const { data, error } = await supabase
          .from('cargos')
          .select('permissions')
          .eq('id', user.cargo_id)
          .single();

        if (data && !error) {
          setPermissions((data.permissions as CargoPermissions) || {});
        }
      } else {
        // Sem cargo definido: usar permissões padrão baseado no nível
        const defaultPermissions: CargoPermissions = {
          'dashboard-item': { ver: true },
          'conversas-item': { ver: true },
          'crm-negocios-item': { ver: true },
          'crm-contatos-item': { ver: true },
          'crm-tags-item': { ver: true },
          'crm-produtos-item': { ver: true },
          // Motivos de Perda (antigo configuração de ações)
          'crm-loss-reasons-item': { ver: true }
        };
        
        // Admin sem cargo tem acesso total a tudo
        if (userRole === 'admin') {
          defaultPermissions['administracao-usuarios-item'] = { ver: true, criar: true, editar: true, deletar: true };
          defaultPermissions['administracao-cargos-item'] = { ver: true, criar: true, editar: true, deletar: true };
          defaultPermissions['administracao-configuracoes-item'] = { ver: true, editar: true };
          defaultPermissions['automacoes-item'] = { ver: true, criar: true, editar: true, deletar: true };
          defaultPermissions['conexoes-item'] = { ver: true, criar: true, editar: true, deletar: true };
          defaultPermissions['recursos-item'] = { ver: true, criar: true, editar: true, deletar: true };
        }
        
        setPermissions(defaultPermissions);
      }
      setLoading(false);
    };

    loadPermissions();
  }, [user?.cargo_id, userRole]);

  // Funções de verificação
  const canView = (moduleId: string): boolean => {
    // Apenas Master tem acesso total sempre
    if (userRole === 'master') return true;
    // Admin e User respeitam permissões (de cargo ou padrão)
    return permissions[moduleId]?.ver === true;
  };

  const canCreate = (moduleId: string): boolean => {
    if (userRole === 'master') return true;
    return permissions[moduleId]?.criar === true;
  };

  const canEdit = (moduleId: string): boolean => {
    if (userRole === 'master') return true;
    return permissions[moduleId]?.editar === true;
  };

  const canDelete = (moduleId: string): boolean => {
    if (userRole === 'master') return true;
    return permissions[moduleId]?.deletar === true;
  };

  const canViewAnyIn = (moduleIds: string[]): boolean => {
    if (userRole === 'master') return true;
    return moduleIds.some(id => canView(id));
  };

  return {
    permissions,
    loading,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canViewAnyIn
  };
};
