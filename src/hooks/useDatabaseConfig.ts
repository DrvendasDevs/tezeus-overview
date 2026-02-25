import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_CONFIG, clearConfigCache } from '@/lib/config';

export interface DatabaseConfig {
  id: string;
  name: string;
  url: string;
  projectId: string;
  anonKey: string;
}

interface UseDatabaseConfigReturn {
  config: DatabaseConfig | null;
  loading: boolean;
  error: string | null;
  isTesting: boolean;
  refreshConfig: () => Promise<void>;
  updateConfig: (id: string, updates: Partial<DatabaseConfig>) => Promise<boolean>;
  testConnection: (config: DatabaseConfig) => Promise<boolean>;
}

/**
 * Hook para gerenciar a configuração única de banco de dados
 * Permite visualizar e editar a configuração do banco
 */
export function useDatabaseConfig(): UseDatabaseConfigReturn {
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);

  /**
   * Busca a configuração do banco na tabela database_configs
   */
  const getDatabaseConfig = async (): Promise<DatabaseConfig | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('database_configs')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('❌ [getDatabaseConfig] Erro:', error);
        return null;
      }
      
      if (data) {
        return {
          id: data.id,
          name: data.name || 'Configuração Principal',
          url: data.url,
          projectId: data.project_id,
          anonKey: data.anon_key,
        };
      }
      
      return null;
    } catch (err) {
      console.error('❌ [getDatabaseConfig] Exceção:', err);
      return null;
    }
  };

  /**
   * Cria uma nova configuração de banco
   */
  const createDatabaseConfig = async (configData: Omit<DatabaseConfig, 'id'>): Promise<DatabaseConfig | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('database_configs')
        .insert({
          name: configData.name,
          url: configData.url,
          project_id: configData.projectId,
          anon_key: configData.anonKey,
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ [createDatabaseConfig] Erro:', error);
        return null;
      }
      
      return {
        id: data.id,
        name: data.name,
        url: data.url,
        projectId: data.project_id,
        anonKey: data.anon_key,
      };
    } catch (err) {
      console.error('❌ [createDatabaseConfig] Exceção:', err);
      return null;
    }
  };

  /**
   * Busca a configuração única do banco
   * Se não existir, cria uma configuração padrão
   */
  const refreshConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 [useDatabaseConfig] Buscando configuração única...');
      let data = await getDatabaseConfig();
      
      // Se não existe configuração, criar uma padrão
      if (!data) {
        console.log('⚠️ [useDatabaseConfig] Nenhuma configuração encontrada. Criando configuração padrão...');
        data = await createDatabaseConfig({
          name: 'Configuração Principal',
          url: DEFAULT_CONFIG.url,
          anonKey: DEFAULT_CONFIG.anonKey,
          projectId: DEFAULT_CONFIG.projectId
        });
      }
      
      if (data) {
        setConfig(data);
        console.log('✅ [useDatabaseConfig] Configuração carregada:', data.name);
      } else {
        setConfig(null);
        console.warn('⚠️ [useDatabaseConfig] Não foi possível carregar ou criar configuração');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar configuração';
      setError(errorMessage);
      console.error('❌ [useDatabaseConfig] Erro ao buscar configuração:', err);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Atualiza a configuração do banco
   */
  const updateConfig = useCallback(async (
    id: string,
    updates: Partial<DatabaseConfig>
  ): Promise<boolean> => {
    try {
      setError(null);

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.url !== undefined) updateData.url = updates.url;
      if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
      if (updates.anonKey !== undefined) updateData.anon_key = updates.anonKey;

      console.log('💾 [updateConfig] Atualizando configuração:', updateData);

      const { error: updateError } = await (supabase as any)
        .from('database_configs')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('❌ [updateConfig] Erro ao atualizar:', updateError);
        throw updateError;
      }

      console.log('✅ [updateConfig] Configuração atualizada com sucesso');

      // Limpar cache para forçar busca da nova configuração
      clearConfigCache();

      // Atualizar configuração local
      const updatedConfig = { ...config!, ...updates };
      setConfig(updatedConfig);

      toast({
        title: 'Sucesso',
        description: 'Configuração salva com sucesso. A página será recarregada.',
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configuração';
      setError(errorMessage);
      console.error('❌ [updateConfig] Erro ao atualizar configuração:', err);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    }
  }, [config, toast]);

  /**
   * Testa conexão com uma configuração de banco
   */
  const testConnection = useCallback(async (testConfig: DatabaseConfig): Promise<boolean> => {
    try {
      setIsTesting(true);
      setError(null);

      const anonKey = testConfig.anonKey;

      if (!anonKey) {
        throw new Error('Chave anon não encontrada para esta configuração');
      }

      // Criar cliente temporário para testar
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(testConfig.url, anonKey, {
        auth: {
          persistSession: false,
        },
      });

      // Tentar uma query simples
      const { error: testError } = await testClient
        .from('database_configs')
        .select('id')
        .limit(1);

      if (testError) {
        throw testError;
      }

      toast({
        title: 'Sucesso',
        description: 'Conexão testada com sucesso',
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao testar conexão';
      setError(errorMessage);
      console.error('Erro ao testar conexão:', err);
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  }, [toast]);

  // Carregar configuração ao montar o hook e quando o usuário estiver disponível
  useEffect(() => {
    // Não carregar se já carregou ou se não há usuário ainda
    if (hasLoadedRef.current) return;
    
    // Aguardar usuário estar disponível (importante para RLS)
    if (!user) {
      console.log('⏳ [useDatabaseConfig] Aguardando usuário para carregar configuração...');
      return;
    }
    
    // Carregar configuração
    const loadConfig = async () => {
      try {
        console.log('🔄 [useDatabaseConfig] Iniciando carregamento inicial...');
        hasLoadedRef.current = true;
        await refreshConfig();
      } catch (err) {
        console.error('❌ [useDatabaseConfig] Erro no carregamento inicial:', err);
      }
    };
    
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Depender apenas do usuário, refreshConfig é estável

  return {
    config,
    loading,
    error,
    isTesting,
    refreshConfig,
    updateConfig,
    testConnection,
  };
}
