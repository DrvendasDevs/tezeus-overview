import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { toast } from 'sonner';

export interface SyncResult {
  instance: string;
  status: 'updated' | 'deleted' | 'in_sync' | 'error' | 'skipped';
  oldStatus?: string;
  newStatus?: string;
  evolutionState?: string;
  reason?: string;
  error?: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  results: SyncResult[];
  summary: {
    total: number;
    synced: number;
    deleted: number;
    errors: number;
    in_sync: number;
    skipped: number;
  };
}

export const useInstanceSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();

  const syncInstanceStatus = async (): Promise<SyncResponse | null> => {
    setIsSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-instance-status', {
        headers: getHeaders(),
      });

      if (error) {
        console.error('Error syncing instance status:', error);
        toast.error('Erro ao sincronizar status das instâncias');
        return null;
      }

      const result = data as SyncResponse;
      
      if (result.success) {
        const { synced, deleted, errors } = result.summary;
        if (synced > 0 || deleted > 0) {
          toast.success(`Sincronização concluída! ${synced} atualizadas, ${deleted} removidas.`);
        } else if (errors > 0) {
          toast.warning(`Sincronização com erros. ${errors} instâncias com problema.`);
        } else {
          toast.success('Todas as instâncias já estavam sincronizadas!');
        }
      } else {
        toast.error('Falha na sincronização das instâncias');
      }

      return result;
    } catch (error) {
      console.error('Error syncing instance status:', error);
      toast.error('Erro interno na sincronização');
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    syncInstanceStatus
  };
};