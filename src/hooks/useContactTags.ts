import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id?: string | null;
}

export function useContactTags(contactId?: string | null, workspaceIdOverride?: string | null) {
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const workspaceId = workspaceIdOverride ?? selectedWorkspace?.workspace_id ?? null;

  // Fetch tags already assigned to contact
  const fetchContactTags = useCallback(async () => {
    if (!contactId) {
      setContactTags([]);
      return;
    }
    
    try {
      let query = supabase
        .from('contact_tags')
        .select(`
          id,
          tag_id,
          tags(id, name, color, workspace_id)
        `)
        .eq('contact_id', contactId);

      if (workspaceId) {
        query = query.eq('tags.workspace_id', workspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const tags = data?.map(item => item.tags).filter((tag): tag is { id: string; name: string; color: string; workspace_id: string | null } => Boolean(tag)) || [];
      const filteredTags = workspaceId
        ? tags.filter(tag => tag.workspace_id === workspaceId)
        : tags;
      setContactTags(filteredTags as Tag[]);
    } catch (err) {
      console.error('Error fetching contact tags:', err);
    }
  }, [contactId, workspaceId]);

  // Fetch all available tags
  const fetchAvailableTags = useCallback(async () => {
    if (!workspaceId) {
      setAvailableTags([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color, workspace_id')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
    }
  }, [workspaceId]);

  // Add tag to contact
  const addTagToContact = async (tagId: string) => {
    if (!contactId) return false;

    setIsLoading(true);
    try {
      // Buscar o ID do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar system_user_id baseado no email do usuário autenticado
      const { data: systemUser } = await supabase
        .from('system_users')
        .select('id')
        .eq('email', user?.email)
        .maybeSingle();

      const { error } = await supabase
        .from('contact_tags')
        .upsert({
          contact_id: contactId,
          tag_id: tagId,
          created_by: systemUser?.id || null
        }, {
          onConflict: 'contact_id,tag_id',
          ignoreDuplicates: true
        });

      if (error) throw error;

      await fetchContactTags();
      
      return true;
    } catch (error: any) {
      console.error('Error adding tag to contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Remove tag from contact
  const removeTagFromContact = async (tagId: string) => {
    if (!contactId) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);

      if (error) throw error;

      await fetchContactTags();
      
      return true;
    } catch (error: any) {
      console.error('Error removing tag from contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get available tags excluding already assigned ones
  const getFilteredTags = (searchTerm: string = '') => {
    const assignedTagIds = contactTags.map(tag => tag.id);
    const filtered = availableTags.filter(tag => 
      !assignedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  };

  useEffect(() => {
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  useEffect(() => {
    fetchContactTags();
  }, [fetchContactTags]);

  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-tags-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_tags',
          filter: `contact_id=eq.${contactId}`,
        },
        () => {
          fetchContactTags();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, fetchContactTags]);

  return {
    contactTags,
    availableTags,
    isLoading,
    addTagToContact,
    removeTagFromContact,
    getFilteredTags,
    refreshTags: fetchContactTags
  };
}