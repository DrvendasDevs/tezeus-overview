import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'user' | 'admin' | 'master';
  is_hidden: boolean;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profile: string;
    phone?: string;
    status?: string;
    cargo_names?: string[];
    avatar?: string;
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const getRequestHeaders = () => {
    const headers: Record<string, string> = {};
    if (user?.id) {
      headers['x-system-user-id'] = user.id;
    }
    if (user?.email) {
      headers['x-system-user-email'] = user.email;
    }
    return headers;
  };

  const fetchMembers = async () => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'list',
          workspaceId
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      setMembers(data.members || []);
    } catch (error: any) {
      console.error('Error in fetchMembers:', error);
      setMembers([]);
      
      const errorMessage = error?.message || "Erro ao carregar membros do workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [workspaceId]);

  const addMember = async (userId: string, role: 'user' | 'admin' | 'master') => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'add',
          workspaceId,
          userId,
          role
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to add member');
      }

      toast({
        title: "Sucesso",
        description: "Membro adicionado ao workspace com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in addMember:', error);
      
      const errorMessage = error?.message || "Erro ao adicionar membro ao workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const createUserAndAddToWorkspace = async (
    userData: {
      name: string;
      email: string;
      profile: string;
      senha: string;
      default_channel?: string;
      phone?: string;
      cargo_ids?: string[];
    },
    role: 'user' | 'admin' | 'master'
  ) => {
    if (!workspaceId) return;

    const getEdgeFunctionErrorMessage = async (err: any, fallback: string) => {
      if (!err) return fallback;
      if (typeof err === 'string') return err;
      // Supabase Functions errors often include the real payload in err.context.body
      const rawBody = err?.context?.body;

      const parseJsonBody = (text: string) => {
        try {
          const parsed = JSON.parse(text);
          return parsed?.error || parsed?.message || null;
        } catch {
          return null;
        }
      };

      try {
        if (rawBody) {
          if (typeof rawBody === 'string') {
            return parseJsonBody(rawBody) || rawBody || fallback;
          }

          // If it's already an object
          if (typeof rawBody === 'object' && !ArrayBuffer.isView(rawBody) && !(rawBody instanceof ArrayBuffer) && !(rawBody instanceof ReadableStream)) {
            return rawBody?.error || rawBody?.message || fallback;
          }

          // Uint8Array / ArrayBuffer
          if (ArrayBuffer.isView(rawBody) || rawBody instanceof ArrayBuffer) {
            const bytes = ArrayBuffer.isView(rawBody) ? rawBody : new Uint8Array(rawBody);
            const text = new TextDecoder().decode(bytes as any);
            return parseJsonBody(text) || text || fallback;
          }

          // ReadableStream (browser)
          if (rawBody instanceof ReadableStream) {
            const text = await new Response(rawBody).text();
            return parseJsonBody(text) || text || fallback;
          }
        }

        // Some versions expose a Response object in context
        const resp = err?.context?.response;
        if (resp && typeof resp.text === 'function') {
          const text = await resp.text();
          return parseJsonBody(text) || text || fallback;
        }
      } catch {
        // ignore parsing failures
      }

      return err?.message || fallback;
    };

    try {
      // Create user via edge function
      const { data: createResponse, error: createError } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'create',
          userData: userData,
          workspaceId
        },
        // keep headers consistent; some deployments rely on auth context/logging
        headers: getRequestHeaders()
      });

      if (createError) {
        const msg = await getEdgeFunctionErrorMessage(createError, 'Falha ao criar usuário');
        throw new Error(msg);
      }

      if (!createResponse.success) {
        throw new Error(createResponse.error || 'Falha ao criar usuário');
      }

      const newUserId = createResponse.data.id;

      try {
        // Add user to workspace via edge function to handle RLS
        const { data: memberResponse, error: memberError } = await supabase.functions.invoke('manage-workspace-members', {
          body: {
            action: 'add',
            workspaceId: workspaceId,
            userId: newUserId,
            role: role
          },
          headers: getRequestHeaders()
        });

        if (memberError) {
          const msg = await getEdgeFunctionErrorMessage(memberError, 'Falha ao adicionar membro ao workspace');
          throw new Error(msg);
        }

        if (!memberResponse.success) {
          throw new Error(memberResponse.error || 'Falha ao adicionar membro ao workspace');
        }

        fetchMembers();
        return memberResponse.member;
      } catch (memberErr) {
        // Important: avoid leaving orphan system_users when linking fails (limits/permissions/etc)
        try {
          await supabase.functions.invoke('manage-system-user', {
            body: { action: 'delete', userId: newUserId },
            headers: getRequestHeaders()
          });
        } catch (rollbackErr) {
          console.error('Rollback failed while deleting newly created user:', rollbackErr);
        }
        throw memberErr;
      }
    } catch (error: any) {
      console.error('Error creating user and adding to workspace:', error);
      
      let errorMessage = "Falha ao criar usuário e adicionar ao workspace";
      
      // Check for specific error messages
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        errorMessage = "Este email já está sendo usado por outro usuário";
      } else if (error.message?.includes('invalid email')) {
        errorMessage = "Email inválido";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateMember = async (memberId: string, updates: { role?: 'user' | 'admin' | 'master'; is_hidden?: boolean }) => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'update',
          workspaceId,
          memberId,
          updates
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update member');
      }

      toast({
        title: "Sucesso",
        description: "Membro atualizado com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in updateMember:', error);
      
      const errorMessage = error?.message || "Erro ao atualizar membro.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const updateUser = async (userId: string, userData: {
    name?: string;
    email?: string;
    profile?: string;
    senha?: string;
    phone?: string;
    default_channel?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: {
          action: 'update',
          userId,
          userData
        }
      });

      if (error) {
        console.error('Error calling manage-system-user function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update user');
      }

      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso.",
      });

      // Refresh the members list to show updated data
      await fetchMembers();
    } catch (error) {
      console.error('Error in updateUser:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar usuário.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeMember = async (memberId: string) => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-workspace-members', {
        body: {
          action: 'remove',
          workspaceId,
          memberId
        },
        headers: getRequestHeaders()
      });

      if (error) {
        console.error('Error calling manage-workspace-members function:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove member');
      }

      toast({
        title: "Sucesso",
        description: "Membro removido do workspace com sucesso.",
      });

      // Refresh the members list
      await fetchMembers();
    } catch (error: any) {
      console.error('Error in removeMember:', error);
      
      const errorMessage = error?.message || "Erro ao remover membro do workspace.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    members,
    isLoading,
    fetchMembers,
    refreshMembers: fetchMembers,
    addMember,
    createUserAndAddToWorkspace,
    updateMember,
    updateUser,
    removeMember
  };
}