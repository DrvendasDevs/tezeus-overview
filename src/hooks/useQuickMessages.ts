import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface QuickMessage {
  id: string;
  title: string;
  content: string;
  workspace_id: string;
  is_ai_agent?: boolean;
  created_by_id?: string | null;
  visible_to_all?: boolean;
  allow_edit_before_send?: boolean;
  created_at: string;
  updated_at: string;
}

export const useQuickMessages = () => {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();
  const warnedMissingColumnsRef = useRef(false);

  const fetchMessages = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('quick_messages')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (userRole !== 'master') {
        query = query.is('is_ai_agent', false);
      }

      // ✅ Privado por padrão: mostrar itens compartilhados OU criados pelo usuário
      query = query.or(`visible_to_all.eq.true,created_by_id.eq.${user.id}`);

      let { data, error } = await query;

      // Fallback: caso a migration ainda não tenha sido aplicada no banco (colunas não existem)
      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id') ||
          msg.includes('allow_edit_before_send');

        if (isMissingColumns) {
          console.warn('[useQuickMessages] Colunas de visibilidade/owner não encontradas no banco. Recarregando sem filtro. Aplique a migration.', error);
          if (!warnedMissingColumnsRef.current) {
            warnedMissingColumnsRef.current = true;
            toast({
              title: 'Atualização pendente',
              description: 'Seu banco ainda não foi atualizado. Aplique a migration para habilitar: visível para todos e editar ao enviar.',
              variant: 'destructive',
            });
          }
          const fallback = await supabase
            .from('quick_messages')
            .select('*')
            .eq('workspace_id', selectedWorkspace.workspace_id)
            .order('created_at', { ascending: false });
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching quick messages:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mensagens rápidas. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createMessage = async (
    title: string,
    content: string,
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean; allowEditBeforeSend?: boolean }
  ) => {
    if (!selectedWorkspace?.workspace_id || !user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive',
      });
      return;
    }

    try {
      let { data, error } = await supabase
        .from('quick_messages')
        .insert({
          title,
          content,
          workspace_id: selectedWorkspace.workspace_id,
          is_ai_agent: isAiAgent,
          created_by_id: user.id,
          visible_to_all: Boolean(options?.visibleToAll),
          allow_edit_before_send: Boolean(options?.allowEditBeforeSend)
        })
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id') ||
          msg.includes('allow_edit_before_send');
        if (isMissingColumns) {
          console.warn('[useQuickMessages] Migration não aplicada no banco (colunas ausentes). Criando sem campos novos.', error);
          if ((options?.allowEditBeforeSend || options?.visibleToAll) && !warnedMissingColumnsRef.current) {
            warnedMissingColumnsRef.current = true;
            toast({
              title: 'Atualização pendente',
              description: 'Para usar “Editar ao enviar”/“Visível para todos”, aplique a migration no Supabase.',
              variant: 'destructive',
            });
          }
          const fallback = await supabase
            .from('quick_messages')
            .insert({
              title,
              content,
              workspace_id: selectedWorkspace.workspace_id,
              is_ai_agent: isAiAgent
            })
            .select()
            .single();
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;

      setMessages(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Mensagem criada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating message:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao criar mensagem. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const updateMessage = async (
    id: string,
    title: string,
    content: string,
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean; allowEditBeforeSend?: boolean }
  ) => {
    try {
      let { data, error } = await supabase
        .from('quick_messages')
        .update({
          title,
          content,
          is_ai_agent: isAiAgent,
          visible_to_all: options?.visibleToAll,
          allow_edit_before_send: options?.allowEditBeforeSend,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id') ||
          msg.includes('allow_edit_before_send');
        if (isMissingColumns) {
          console.warn('[useQuickMessages] Migration não aplicada no banco (colunas ausentes). Atualizando sem campos novos.', error);
          if ((options?.allowEditBeforeSend || options?.visibleToAll) && !warnedMissingColumnsRef.current) {
            warnedMissingColumnsRef.current = true;
            toast({
              title: 'Atualização pendente',
              description: 'Para usar “Editar ao enviar”/“Visível para todos”, aplique a migration no Supabase.',
              variant: 'destructive',
            });
          }
          const fallback = await supabase
            .from('quick_messages')
            .update({
              title,
              content,
              is_ai_agent: isAiAgent,
            })
            .eq('id', id)
            .select()
            .single();
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;

      setMessages(prev => prev.map(msg => msg.id === id ? data : msg));
      toast({
        title: 'Sucesso',
        description: 'Mensagem atualizada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error updating message:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar mensagem. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Mensagem excluída com sucesso',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir mensagem',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [selectedWorkspace?.workspace_id, user]);

  return {
    messages,
    loading,
    createMessage,
    updateMessage,
    deleteMessage,
    refetch: fetchMessages,
  };
};