import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProviderMetrics {
  provider: 'evolution' | 'zapi';
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  successRate: number;
  averageResponseTime: number;
  lastActivity: string | null;
}

export function useProviderMetrics(workspaceId: string, days: number = 7) {
  const [metrics, setMetrics] = useState<ProviderMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const fetchMetrics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error: fetchError } = await supabase
          .from('whatsapp_provider_logs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .gte('created_at', startDate.toISOString())
          .eq('action', 'send_message');

        if (fetchError) throw fetchError;

        // Processar métricas por provedor
        const providerStats: Record<string, {
          total: number;
          success: number;
          failed: number;
          responseTimes: number[];
          lastActivity: string | null;
        }> = {
          evolution: { total: 0, success: 0, failed: 0, responseTimes: [], lastActivity: null },
          zapi: { total: 0, success: 0, failed: 0, responseTimes: [], lastActivity: null },
        };

        data?.forEach((log: any) => {
          const stats = providerStats[log.provider];
          if (!stats) return;

          stats.total++;
          if (log.result === 'success') {
            stats.success++;
          } else {
            stats.failed++;
          }

          if (log.response_time_ms) {
            stats.responseTimes.push(log.response_time_ms);
          }

          if (!stats.lastActivity || new Date(log.created_at) > new Date(stats.lastActivity)) {
            stats.lastActivity = log.created_at;
          }
        });

        // Converter para array de métricas
        const metricsArray: ProviderMetrics[] = Object.entries(providerStats).map(([provider, stats]) => ({
          provider: provider as 'evolution' | 'zapi',
          totalMessages: stats.total,
          successfulMessages: stats.success,
          failedMessages: stats.failed,
          successRate: stats.total > 0 ? (stats.success / stats.total) * 100 : 0,
          averageResponseTime: stats.responseTimes.length > 0
            ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
            : 0,
          lastActivity: stats.lastActivity,
        }));

        setMetrics(metricsArray);
      } catch (err) {
        console.error('Error fetching provider metrics:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();

    // Atualizar métricas a cada 30 segundos
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [workspaceId, days]);

  return { metrics, isLoading, error };
}
