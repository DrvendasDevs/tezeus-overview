import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface WorkspaceContactField {
  id: string;
  workspace_id: string;
  field_name: string;
  field_order: number;
  is_required: boolean;
}

export function useWorkspaceContactFields(workspaceId: string | null) {
  const [fields, setFields] = useState<WorkspaceContactField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchFields = async () => {
    if (!workspaceId) {
      setFields([]);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('workspace_contact_fields')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('field_order');

      if (error) throw error;
      setFields(data || []);
    } catch (error) {
      console.error('Error fetching workspace fields:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar campos obrigatórios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addField = async (fieldName: string) => {
    if (!workspaceId) return false;

    try {
      const maxOrder = fields.length > 0 ? Math.max(...fields.map(f => f.field_order)) : -1;
      
      const { error } = await supabase
        .from('workspace_contact_fields')
        .insert({
          workspace_id: workspaceId,
          field_name: fieldName,
          field_order: maxOrder + 1,
          is_required: true
        });

      if (error) throw error;

      await fetchFields();
      toast({
        title: "Campo adicionado",
        description: `Campo "${fieldName}" adicionado com sucesso`,
      });
      return true;
    } catch (error: any) {
      console.error('Error adding field:', error);
      if (error.code === '23505') {
        toast({
          title: "Erro",
          description: "Este campo já existe",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao adicionar campo",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const removeField = async (fieldId: string) => {
    if (!workspaceId) return false;

    try {
      const { error } = await supabase
        .from('workspace_contact_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      await fetchFields();
      toast({
        title: "Campo removido",
        description: "Campo removido com sucesso",
      });
      return true;
    } catch (error) {
      console.error('Error removing field:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover campo",
        variant: "destructive",
      });
      return false;
    }
  };

  const reorderFields = async (reorderedFields: WorkspaceContactField[]) => {
    if (!workspaceId) return false;

    try {
      // Update order for all fields
      for (let i = 0; i < reorderedFields.length; i++) {
        const { error } = await supabase
          .from('workspace_contact_fields')
          .update({ field_order: i })
          .eq('id', reorderedFields[i].id);

        if (error) throw error;
      }

      await fetchFields();
      return true;
    } catch (error) {
      console.error('Error reordering fields:', error);
      toast({
        title: "Erro",
        description: "Erro ao reordenar campos",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchFields();
  }, [workspaceId]);

  return {
    fields,
    isLoading,
    addField,
    removeField,
    reorderFields,
    refetch: fetchFields
  };
}
