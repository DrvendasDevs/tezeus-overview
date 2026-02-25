import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  profile: string;
  status: string;
  avatar?: string;
  cargo_id?: string;
  cargo_ids?: string[];
  cargo_names?: string[];
  default_channel?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  created_by_name?: string;
  workspaces?: { id: string; name: string; role: string }[];
  empresa?: string;
}

interface CreateUserData {
  name: string;
  email: string;
  profile: string;
  status?: string;
  senha: string;
  cargo_id?: string;
  cargo_ids?: string[];
  default_channel?: string;
}

interface UpdateUserData {
  id: string;
  name?: string;
  email?: string;
  profile?: string;
  status?: string;
  senha?: string;
  cargo_id?: string;
  cargo_ids?: string[];
  default_channel?: string;
}

export const useSystemUsers = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const createUser = async (userData: CreateUserData) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-system-user-id'] = user.id;
      }
      if (user?.email) {
        headers['x-system-user-email'] = user.email;
      }

      const response = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'create',
          userData
        },
        headers
      });

      // Check if the edge function returned success
      if (response.data?.success) {
        // Refresh the user list immediately to show the new user
        await listUsers();
        
        toast({
          title: "Usuário criado",
          description: "Usuário criado com sucesso",
          variant: "default"
        });
        return { data: response.data.data };
      }

      // Handle errors from the edge function (including 500 errors)
      let errorMessage = "Erro desconhecido";
      
      if (response.data?.error) {
        // Error from edge function (like duplicate email)
        if (response.data.error.includes('duplicate key') && response.data.error.includes('email')) {
          errorMessage = "Este email já está sendo usado por outro usuário";
        } else {
          errorMessage = response.data.error;
        }
      } else if (response.error?.message) {
        // Network or other errors
        errorMessage = response.error.message;
      }
      
      // Even if there's an error, try to refresh the list in case the user was created
      // This is because sometimes the user is created but the function returns an error
      console.log('Attempting to refresh user list after error...');
      try {
        await listUsers();
      } catch (refreshError) {
        console.error('Failed to refresh user list:', refreshError);
      }
      
      toast({
        title: "Erro ao criar usuário",
        description: errorMessage,
        variant: "destructive"
      });
      
      return { error: errorMessage };

    } catch (error) {
      console.error('Unexpected error creating user:', error);
      toast({
        title: "Erro ao criar usuário",
        description: "Erro inesperado do sistema",
        variant: "destructive"
      });
      return { error: 'Erro inesperado do sistema' };
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: UpdateUserData) => {
    setLoading(true);
    try {
      const { id, ...updateData } = userData;
      
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-system-user-id'] = user.id;
      }
      if (user?.email) {
        headers['x-system-user-email'] = user.email;
      }

      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'update',
          userData: updateData,
          userId: id
        },
        headers
      });

      if (error) {
        console.error('Error updating user:', error);
        toast({
          title: "Erro ao atualizar usuário",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (data?.error) {
        toast({
          title: "Erro ao atualizar usuário",
          description: data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      if (!data?.success || !data?.data) {
        toast({
          title: "Erro ao atualizar usuário",
          description: "Resposta inválida do servidor",
          variant: "destructive"
        });
        return { error: 'Resposta inválida do servidor' };
      }

      toast({
        title: "Usuário atualizado",
        description: "Usuário atualizado com sucesso",
        variant: "default"
      });

      return { data: data.data };
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Erro ao atualizar usuário",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-system-user-id'] = user.id;
      }
      if (user?.email) {
        headers['x-system-user-email'] = user.email;
      }

      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'delete',
          userId: userId
        },
        headers
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast({
          title: "Erro ao deletar usuário",
          description: error.message || "Erro interno do servidor",
          variant: "destructive"
        });
        return { error: error.message };
      }

      if (data?.error) {
        toast({
          title: "Erro ao deletar usuário",
          description: data.error,
          variant: "destructive"
        });
        return { error: data.error };
      }

      if (!data?.success) {
        toast({
          title: "Erro ao deletar usuário",
          description: "Resposta inválida do servidor",
          variant: "destructive"
        });
        return { error: 'Resposta inválida do servidor' };
      }

      toast({
        title: "Usuário deletado",
        description: "Usuário deletado com sucesso",
        variant: "default"
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Erro ao deletar usuário",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  const listUsers = async (): Promise<{ data?: SystemUser[], error?: string }> => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (user?.id) {
        headers['x-system-user-id'] = user.id;
      }
      if (user?.email) {
        headers['x-system-user-email'] = user.email;
      }

      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'list',
          userData: {}
        },
        headers
      });

      if (error) {
        console.error('Error listing users:', error);
        return { error: error.message || "Erro interno do servidor" };
      }

      if (data?.error) {
        return { error: data.error };
      }

      if (!data?.success) {
        return { error: 'Resposta inválida do servidor' };
      }

      const users = data?.data || [];
      
      // A view já deve conter cargo_ids, não precisamos buscar separadamente
      return { data: users };
    } catch (error) {
      console.error('Error listing users:', error);
      return { error: 'Erro interno do servidor' };
    } finally {
      setLoading(false);
    }
  };

  return {
    createUser,
    updateUser,
    deleteUser,
    listUsers,
    loading
  };
};