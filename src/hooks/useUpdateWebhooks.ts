import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useUpdateWebhooks = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateAllWebhooks = async () => {
    setIsUpdating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('update-all-webhooks-to-v2');

      if (error) {
        console.error('Erro ao atualizar webhooks:', error);
        toast.error('Erro ao atualizar webhooks');
        return null;
      }

      const result = data as {
        success: boolean;
        message: string;
        summary: {
          total: number;
          successful: number;
          failed: number;
        };
        results: Array<{
          instance_name: string;
          success: boolean;
          status?: number;
          error?: string;
        }>;
      };
      
      if (result.success) {
        toast.success(`✅ ${result.summary.successful} de ${result.summary.total} instâncias atualizadas com base64 habilitado!`);
      } else {
        toast.error('Falha ao atualizar webhooks');
      }

      return result;
    } catch (error) {
      console.error('Erro ao atualizar webhooks:', error);
      toast.error('Erro interno ao atualizar webhooks');
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isUpdating,
    updateAllWebhooks
  };
};
