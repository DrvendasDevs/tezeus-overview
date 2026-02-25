import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProviderAlert {
  id: string;
  workspace_id: string;
  provider: string;
  error_rate: number;
  threshold_percent: number;
  total_messages: number;
  error_count: number;
  time_window_start: string;
  time_window_end: string;
  notified_via: string[];
  created_at: string;
}

interface UseProviderAlertsParams {
  workspaceId: string;
}

export function useProviderAlerts({ workspaceId }: UseProviderAlertsParams) {
  const [alerts, setAlerts] = useState<ProviderAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlerts = async () => {
    if (!workspaceId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_provider_alerts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      setAlerts((data as ProviderAlert[]) || []);
    } catch (error) {
      console.error('Exception fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Realtime subscription para novos alertas
    const channel = supabase
      .channel('provider-alerts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_provider_alerts',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const newAlert = payload.new as ProviderAlert;
          
          // Mostrar toast se incluído nos meios de notificação
          if (newAlert.notified_via?.includes('toast')) {
            toast.error(
              `Taxa de erro do ${newAlert.provider.toUpperCase()}: ${newAlert.error_rate}%`,
              {
                description: `Limite: ${newAlert.threshold_percent}% | Erros: ${newAlert.error_count}/${newAlert.total_messages}`,
                duration: 10000,
              }
            );
          }

          setAlerts((prev) => [newAlert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return {
    alerts,
    isLoading,
    fetchAlerts,
  };
}
