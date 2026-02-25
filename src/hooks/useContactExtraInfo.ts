import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export interface ContactExtraField {
  id?: string;
  field_name: string;
  field_value: string;
}

export function useContactExtraInfo(contactId: string | null, workspaceId: string) {
  const [fields, setFields] = useState<ContactExtraField[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchFields = async () => {
    if (!contactId || !workspaceId) {
      setFields([]);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contact_extra_info')
        .select('*')
        .eq('contact_id', contactId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedFields = (data || []).map(item => ({
        id: item.id,
        field_name: item.field_name,
        field_value: item.field_value
      }));

      setFields(formattedFields);
    } catch (error) {
      console.error('Error fetching contact extra info:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar informações adicionais",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveFields = async (fieldsToSave: ContactExtraField[]) => {
    if (!contactId || !workspaceId) return false;

    try {
      // Deletar todos os campos existentes deste contato
      const { error: deleteError } = await supabase
        .from('contact_extra_info')
        .delete()
        .eq('contact_id', contactId)
        .eq('workspace_id', workspaceId);

      if (deleteError) throw deleteError;

      // Inserir novos campos (apenas os que têm nome e valor)
      const validFields = fieldsToSave.filter(f => 
        f.field_name.trim() && f.field_value.trim()
      );

      if (validFields.length > 0) {
        const { error: insertError } = await supabase
          .from('contact_extra_info')
          .insert(
            validFields.map(field => ({
              contact_id: contactId,
              workspace_id: workspaceId,
              field_name: field.field_name.trim(),
              field_value: field.field_value.trim()
            }))
          );

        if (insertError) throw insertError;
      }

      // Recarregar campos
      await fetchFields();
      return true;
    } catch (error) {
      console.error('Error saving contact extra info:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar informações adicionais",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchFields();
  }, [contactId, workspaceId]);

  return {
    fields,
    isLoading,
    fetchFields,
    saveFields
  };
}
