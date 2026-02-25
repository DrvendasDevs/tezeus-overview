import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProviderAlertConfig {
  id: string;
  workspace_id: string;
  provider: 'evolution' | 'zapi' | 'all';
  error_threshold_percent: number;
  time_window_minutes: number;
  email_notifications_enabled: boolean;
  toast_notifications_enabled: boolean;
  notification_emails: string[];
  is_active: boolean;
}

export function useProviderAlertConfig(workspaceId: string) {
  const [configs, setConfigs] = useState<ProviderAlertConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('whatsapp_provider_alert_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('provider');

      if (error) throw error;
      setConfigs((data as any) || []);
    } catch (error) {
      console.error('Error fetching alert configs:', error);
      toast.error('Erro ao carregar configurações de alerta');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (config: Partial<ProviderAlertConfig>) => {
    try {
      if (config.id) {
        const { error } = await supabase
          .from('whatsapp_provider_alert_config')
          .update(config)
          .eq('id', config.id);

        if (error) throw error;
        toast.success('Configuração atualizada');
      } else {
        const { error } = await supabase
          .from('whatsapp_provider_alert_config')
          .insert([{ ...config, workspace_id: workspaceId }] as any);

        if (error) throw error;
        toast.success('Configuração criada');
      }

      await fetchConfigs();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configuração');
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_provider_alert_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Configuração removida');
      await fetchConfigs();
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Erro ao remover configuração');
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [workspaceId]);

  return { configs, isLoading, saveConfig, deleteConfig, fetchConfigs };
}
