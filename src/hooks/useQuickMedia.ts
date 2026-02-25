import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface QuickMedia {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  caption?: string;
  workspace_id: string;
  is_ai_agent?: boolean;
  created_by_id?: string | null;
  visible_to_all?: boolean;
  created_at: string;
  updated_at: string;
}

export const useQuickMedia = () => {
  const [media, setMedia] = useState<QuickMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();

  const fetchMedia = async () => {
    if (!selectedWorkspace?.workspace_id || !user) {
      setMedia([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('quick_media')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (userRole !== 'master') {
        query = query.is('is_ai_agent', false);
      }

      query = query.or(`visible_to_all.eq.true,created_by_id.eq.${user.id}`);

      let { data, error } = await query;

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');

        if (isMissingColumns) {
          console.warn('[useQuickMedia] Colunas de visibilidade/owner não encontradas no banco. Recarregando sem filtro. Aplique a migration.', error);
          const fallback = await supabase
            .from('quick_media')
            .select('*')
            .eq('workspace_id', selectedWorkspace.workspace_id)
            .order('created_at', { ascending: false });
          data = fallback.data as any;
          error = fallback.error as any;
        }
      }

      if (error) throw error;
      setMedia(data || []);
    } catch (error) {
      console.error('Error fetching quick media:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao carregar mídias rápidas. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createMedia = async (
    title: string,
    file: File,
    caption?: string,
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean }
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
      // Upload do arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${selectedWorkspace.workspace_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(filePath);

      // Inserir no banco
      let { data, error } = await supabase
        .from('quick_media')
        .insert({
          title,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          caption: caption || null,
          workspace_id: selectedWorkspace.workspace_id,
          is_ai_agent: isAiAgent,
          created_by_id: user.id,
          visible_to_all: Boolean(options?.visibleToAll)
        })
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');
        if (isMissingColumns) {
          console.warn('[useQuickMedia] Migration não aplicada no banco (colunas ausentes). Criando sem campos novos.', error);
          const fallback = await supabase
            .from('quick_media')
            .insert({
              title,
              file_url: publicUrl,
              file_name: file.name,
              file_type: file.type,
              caption: caption || null,
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

      setMedia(prev => [data, ...prev]);
      toast({
        title: 'Sucesso',
        description: 'Mídia criada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error creating media:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao criar mídia. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const updateMedia = async (
    id: string,
    title: string,
    file?: File,
    caption?: string,
    isAiAgent: boolean = false,
    options?: { visibleToAll?: boolean }
  ) => {
    try {
      let updateData: any = { title, caption: caption || null, is_ai_agent: isAiAgent };
      if (typeof options?.visibleToAll === 'boolean') {
        updateData.visible_to_all = options.visibleToAll;
      }

      if (file && selectedWorkspace?.workspace_id) {
        // Upload novo arquivo se fornecido
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${selectedWorkspace.workspace_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('workspace-media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('workspace-media')
          .getPublicUrl(filePath);

        updateData.file_url = publicUrl;
        updateData.file_name = file.name;
        updateData.file_type = file.type;
      }

      const { data, error } = await supabase
        .from('quick_media')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const msg = `${(error as any)?.message || ''} ${(error as any)?.details || ''}`.toLowerCase();
        const isMissingColumns =
          (error as any)?.code === '42703' ||
          msg.includes('visible_to_all') ||
          msg.includes('created_by_id');
        if (isMissingColumns && typeof options?.visibleToAll === 'boolean') {
          console.warn('[useQuickMedia] Migration não aplicada no banco (colunas ausentes). Atualizando sem campos novos.', error);
          const { visible_to_all, ...rest } = updateData;
          const fallback = await supabase
            .from('quick_media')
            .update(rest)
            .eq('id', id)
            .select()
            .single();
          if (fallback.error) throw fallback.error;
          setMedia(prev => prev.map(item => item.id === id ? (fallback.data as any) : item));
          toast({
            title: 'Sucesso',
            description: 'Mídia atualizada com sucesso',
          });
          return fallback.data;
        }
      }

      if (error) throw error;

      setMedia(prev => prev.map(item => item.id === id ? data : item));
      toast({
        title: 'Sucesso',
        description: 'Mídia atualizada com sucesso',
      });
      return data;
    } catch (error) {
      console.error('Error updating media:', error, JSON.stringify(error));
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar mídia. Se começou após atualização, aplique a migration do Supabase.',
        variant: 'destructive',
      });
    }
  };

  const deleteMedia = async (id: string) => {
    try {
      const { error } = await supabase
        .from('quick_media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMedia(prev => prev.filter(item => item.id !== id));
      toast({
        title: 'Sucesso',
        description: 'Mídia excluída com sucesso',
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir mídia',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [selectedWorkspace?.workspace_id, user]);

  return {
    media,
    loading,
    createMedia,
    updateMedia,
    deleteMedia,
    refetch: fetchMedia,
  };
};