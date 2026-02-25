import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { WorkspaceWebhook, WebhookLog, WorkspaceInstance, TestWebhookResponse } from '@/types/webhook';
import { generateRandomId } from '@/lib/generate-random-id';

export const useWorkspaceWebhooks = (workspaceId?: string) => {
  const [webhookConfig, setWebhookConfig] = useState<WorkspaceWebhook | null>(null);
  const [instances, setInstances] = useState<WorkspaceInstance[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  // Fetch webhook configuration with fallback to secrets table
  const fetchWebhookConfig = async () => {
    console.log('🔧 fetchWebhookConfig called with workspaceId:', workspaceId);
    if (!workspaceId) {
      console.log('🔧 No workspaceId provided, returning early');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🔧 Attempting to fetch webhook settings for workspace:', workspaceId);
      
      // First try to get from workspace_webhook_settings
      let { data: settingsData, error: settingsError } = await supabase
        .from('workspace_webhook_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      console.log('🔧 Settings query result:', { settingsData, settingsError });
      
      if (settingsError) {
        console.error('🔧 Error fetching settings:', settingsError);
        throw settingsError;
      }
      console.log('Settings data:', settingsData);

      // If no data in settings, try to get from secrets as fallback
      if (!settingsData) {
        console.log('No webhook settings found, checking secrets...');
        const secretName = `N8N_WEBHOOK_URL_${workspaceId}`;
        const { data: secretsData, error: secretsError } = await supabase
          .from('workspace_webhook_secrets')
          .select('webhook_url')
          .eq('workspace_id', workspaceId)
          .eq('secret_name', secretName)
          .maybeSingle();

        console.log('Secrets data:', secretsData);

        if (secretsError) {
          console.error('Error fetching webhook secrets:', secretsError);
        } else if (secretsData?.webhook_url) {
          console.log('Found webhook URL in secrets, migrating to settings...');
          // Generate a random secret for the migration
          const newSecret = generateRandomId();
          
          // Migrate from secrets to settings
          const { data: migratedData, error: migrateError } = await supabase
            .from('workspace_webhook_settings')
            .upsert({
              workspace_id: workspaceId,
              webhook_url: secretsData.webhook_url,
              webhook_secret: newSecret
            })
            .select()
            .single();

          if (migrateError) {
            console.error('Error migrating webhook config:', migrateError);
          } else {
            settingsData = migratedData;
            console.log('Successfully migrated webhook config:', settingsData);
          }
        }
      }
      
      console.log('🔧 Final webhook config:', settingsData);
      setWebhookConfig(settingsData);
      console.log('🔧 setWebhookConfig called with:', settingsData);
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a configuração do webhook",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Convert N8N test URL to production URL automatically
  const convertToProductionUrl = (url: string): string => {
    // N8N test URLs have "/test/" in the path, production URLs have "/webhook/"
    if (url.includes('/test/')) {
      const productionUrl = url.replace('/test/', '/webhook/');
      console.log(`🔄 Converting N8N test URL to production:`, { original: url, production: productionUrl });
      return productionUrl;
    }
    return url;
  };

  // Save webhook configuration to both tables for consistency
  const saveWebhookConfig = async (url: string, secret: string) => {
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    // Convert test URL to production URL automatically
    const productionUrl = convertToProductionUrl(url);
    
    setIsLoading(true);
    try {
      // Save to workspace_webhook_settings (primary) - always upsert to avoid duplicates
      const { data, error } = await supabase
        .from('workspace_webhook_settings')
        .upsert({
          workspace_id: workspaceId,
          webhook_url: productionUrl, // Use production URL
          webhook_secret: secret,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id'
        })
        .select()
        .single();

      if (error) throw error;

      // Use the correct secret name format: N8N_WEBHOOK_URL_{workspace_id}
      const secretName = `N8N_WEBHOOK_URL_${workspaceId}`;
      
      // Check if ANY record exists for this workspace (regardless of secret_name)
      const { data: existingSecret, error: checkError } = await supabase
        .from('workspace_webhook_secrets')
        .select('id, secret_name')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing secret:', checkError);
      }

      // Update existing record or insert new one
      if (existingSecret) {
        // Update existing record and also update the secret_name to the new format
        const { error: updateError } = await supabase
          .from('workspace_webhook_secrets')
          .update({
            secret_name: secretName, // Update to new format
            webhook_url: productionUrl, // Use production URL
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSecret.id);

        if (updateError) {
          console.error('Error updating webhook secrets:', updateError);
        } else {
          console.log(`Updated existing webhook secret from "${existingSecret.secret_name}" to "${secretName}"`);
        }
      } else {
        // Insert new record only if none exists
        const { error: insertError } = await supabase
          .from('workspace_webhook_secrets')
          .insert({
            workspace_id: workspaceId,
            secret_name: secretName,
            webhook_url: productionUrl // Use production URL
          });

        if (insertError) {
          console.error('Error inserting webhook secrets:', insertError);
        } else {
          console.log(`Created new webhook secret with name "${secretName}"`);
        }
      }
      
      setWebhookConfig(data);
      
      // Show warning if URL was converted from test to production
      if (url !== productionUrl) {
        toast({
          title: "URL Convertida",
          description: `URL de teste convertida automaticamente para produção. Certifique-se de que o workflow N8N está ATIVO!`,
          variant: "default",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Configuração do webhook salva com sucesso",
        });
      }
      return true;
    } catch (error) {
      console.error('Error saving webhook config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a configuração do webhook",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Rotate webhook secret
  const rotateWebhookSecret = async () => {
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      const newSecret = generateRandomId();
      const { data, error } = await supabase
        .from('workspace_webhook_settings')
        .update({ 
          webhook_secret: newSecret, 
          updated_at: new Date().toISOString() 
        })
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;
      
      setWebhookConfig(data);
      toast({
        title: "Sucesso",
        description: "Secret do webhook rotacionado com sucesso",
      });
      return true;
    } catch (error) {
      console.error('Error rotating webhook secret:', error);
      toast({
        title: "Erro",
        description: "Não foi possível rotacionar o secret do webhook",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Apply webhook to all instances
  const applyToAllInstances = async () => {
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return false;
    }
    
    setIsLoading(true);
    try {
      const { error, count } = await supabase
        .from('connections')
        .update({ use_workspace_default: true }, { count: 'exact' })
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Webhook aplicado a ${count || 0} instâncias`,
      });
      
      // Refresh instances list
      await fetchInstances();
      return true;
    } catch (error) {
      console.error('Error applying webhook to instances:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aplicar o webhook às instâncias",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Test webhook delivery
  const testWebhook = async (): Promise<TestWebhookResponse | null> => {
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma empresa",
        variant: "destructive",
      });
      return null;
    }
    if (!webhookConfig?.webhook_url) return null;
    
    setIsTestingWebhook(true);
    const startTime = performance.now();
    
    try {
      // Use edge function to test webhook (avoid CORS issues)
      const { data: testResult, error } = await supabase.functions.invoke('test-webhook-reception', {
        body: { 
          webhook_url: webhookConfig.webhook_url,
          webhook_secret: webhookConfig.webhook_secret,
          workspace_id: workspaceId
        }
      });

      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      if (error) {
        console.error('Error testing webhook:', error);
        toast({
          title: "Erro no teste",
          description: error.message || "Falha ao testar webhook",
          variant: "destructive",
        });
        return {
          success: false,
          status: 500,
          latency,
          error: error.message
        };
      }

      const result: TestWebhookResponse = {
        success: testResult.success,
        status: testResult.status,
        latency,
        error: testResult.success ? undefined : testResult.error
      };
      
      if (result.success) {
        toast({
          title: "Webhook OK",
          description: `Resposta: ${result.status} (${result.latency}ms)`,
        });
      } else {
        toast({
          title: "Erro no webhook",
          description: result.error || "Falha na entrega",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      
      // Log the error
      await supabase.from('webhook_logs').insert({
        workspace_id: workspaceId,
        event_type: 'test',
        status: 'error',
        payload_json: { type: 'test', timestamp: new Date().toISOString() },
        response_body: (error as Error).message
      });

      console.error('Error testing webhook:', error);
      toast({
        title: "Erro",
        description: "Não foi possível testar o webhook",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Fetch instances
  const fetchInstances = async () => {
    if (!workspaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, status, use_workspace_default')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setInstances(data || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
    }
  };

  // Fetch webhook logs
  const fetchWebhookLogs = async (page = 1, limit = 20, filters?: { eventType?: string; status?: string; dateFrom?: string; dateTo?: string }) => {
    if (!workspaceId) return;
    
    try {
      const offset = (page - 1) * limit;
      let query = supabase
        .from('webhook_logs')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      const typedLogs = (data || []).map(log => ({
        ...log,
        status: log.status as 'success' | 'error' | 'pending'
      })) as WebhookLog[];
      
      setLogs(typedLogs);
      return {
        logs: typedLogs,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
      return {
        logs: [],
        total: 0,
        totalPages: 0
      };
    }
  };

  // Get applied instances count
  const getAppliedCount = () => {
    return instances.filter(instance => instance.use_workspace_default).length;
  };

  // Filter instances based on applied status
  const getFilteredInstances = (showOnlyApplied: boolean) => {
    if (showOnlyApplied) {
      return instances.filter(instance => instance.use_workspace_default);
    }
    return instances;
  };

  useEffect(() => {
    console.log('🔧 useWorkspaceWebhooks useEffect - workspaceId:', workspaceId);
    if (workspaceId) {
      console.log('🔧 Calling fetchWebhookConfig, fetchInstances, fetchWebhookLogs');
      fetchWebhookConfig();
      fetchInstances();
      fetchWebhookLogs();
    } else {
      console.log('🔧 No workspaceId, clearing states');
      setWebhookConfig(null);
      setInstances([]);
      setLogs([]);
    }
  }, [workspaceId]);

  return {
    webhookConfig,
    instances,
    logs,
    isLoading,
    isTestingWebhook,
    saveWebhookConfig,
    rotateWebhookSecret,
    applyToAllInstances,
    testWebhook,
    fetchInstances,
    fetchWebhookLogs,
    getAppliedCount,
    getFilteredInstances,
    refetch: fetchWebhookConfig,
    refreshConfig: fetchWebhookConfig // Added this for explicit refresh
  };
};