import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WhatsAppProvider } from '@/types/whatsapp-provider';

interface TestConnectionResult {
  success: boolean;
  provider: 'evolution' | 'zapi';
  message?: string;
  details?: any;
}

export function useWhatsAppProviders(workspaceId: string) {
  const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const fetchProviders = async () => {
    if (!workspaceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-providers', {
        body: { action: 'list', workspaceId },
      });

      if (error) throw error;
      
      setProviders(data.providers || []);
    } catch (error: any) {
      console.error('Erro ao buscar providers:', error);
      toast.error('Erro ao carregar provedores WhatsApp');
    } finally {
      setIsLoading(false);
    }
  };

  const createProvider = async (providerData: Partial<WhatsAppProvider>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-providers', {
        body: { 
          action: 'create', 
          workspaceId,
          providerData 
        },
      });

      if (error) throw error;

      toast.success('Provedor criado com sucesso');
      await fetchProviders();
      return data.provider;
    } catch (error: any) {
      console.error('Erro ao criar provider:', error);
      toast.error(error.message || 'Erro ao criar provedor');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProvider = async (providerId: string, providerData: Partial<WhatsAppProvider>) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-providers', {
        body: { 
          action: 'update', 
          workspaceId,
          providerId,
          providerData 
        },
      });

      if (error) throw error;

      toast.success('Provedor atualizado com sucesso');
      await fetchProviders();
      return data.provider;
    } catch (error: any) {
      console.error('Erro ao atualizar provider:', error);
      toast.error(error.message || 'Erro ao atualizar provedor');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProvider = async (providerId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-whatsapp-providers', {
        body: { 
          action: 'delete', 
          workspaceId,
          providerId 
        },
      });

      if (error) throw error;

      toast.success('Provedor deletado com sucesso');
      await fetchProviders();
    } catch (error: any) {
      console.error('Erro ao deletar provider:', error);
      toast.error(error.message || 'Erro ao deletar provedor');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const activateProvider = async (providerId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-providers', {
        body: { 
          action: 'activate', 
          workspaceId,
          providerId 
        },
      });

      if (error) throw error;

      toast.success('Provedor ativado com sucesso');
      await fetchProviders();
      return data.provider;
    } catch (error: any) {
      console.error('Erro ao ativar provider:', error);
      toast.error(error.message || 'Erro ao ativar provedor');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (
    providerId?: string, 
    provider?: 'evolution' | 'zapi'
  ): Promise<TestConnectionResult> => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-whatsapp-provider-connection', {
        body: { 
          workspaceId,
          providerId,
          provider 
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`✅ ${data.provider === 'evolution' ? 'Evolution' : 'Z-API'}: ${data.message}`);
      } else {
        toast.error(`❌ ${data.provider === 'evolution' ? 'Evolution' : 'Z-API'}: ${data.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      toast.error(error.message || 'Erro ao testar conexão');
      throw error;
    } finally {
      setIsTesting(false);
    }
  };

  return {
    providers,
    isLoading,
    isTesting,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    activateProvider,
    testConnection,
  };
}
