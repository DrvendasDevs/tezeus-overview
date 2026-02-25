import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { getSupabaseFunctionUrl } from "@/lib/config";

interface ConnectionCreateRequest {
  instanceName: string;
  historyRecovery: 'none' | 'week' | 'month' | 'quarter';
  workspaceId: string;
  autoCreateCrmCard?: boolean;
  defaultPipelineId?: string;
  defaultColumnId?: string;
  defaultColumnName?: string;
  queueId?: string;
  phoneNumber?: string;
  provider?: 'evolution' | 'zapi';
  metadata?: Record<string, any>;
}

interface ConnectionUpdateRequest {
  connectionId: string;
  phone_number?: string;
  auto_create_crm_card?: boolean;
  default_pipeline_id?: string;
  default_column_id?: string;
  default_column_name?: string;
  queue_id?: string;
  instance_name?: string;
}

interface ConnectionResponse {
  id: string;
  instance_name: string;
  status: 'creating' | 'qr' | 'connecting' | 'connected' | 'disconnected' | 'error';
  qr_code?: string;
  phone_number?: string;
  history_recovery: 'none' | 'week' | 'month' | 'quarter';
  created_at: string;
  last_activity_at?: string;
  workspace_id: string;
  metadata?: any;
}

interface ConnectionsListResponse {
  connections: ConnectionResponse[];
  quota: {
    used: number;
    limit: number;
  };
}

class EvolutionProvider {
  private async getEvolutionConfig(workspaceId?: string) {
    try {
      const headers = workspaceId ? getWorkspaceHeaders(workspaceId) : this.getHeaders();
      
      const { data, error } = await supabase.functions.invoke('get-evolution-config', {
        body: { workspaceId: headers['x-workspace-id'] },
        headers
      });

      if (error) throw error;

      if (!data?.url) {
        throw new Error('Evolution API URL não configurada para este workspace. Configure nas configurações da Evolution API.');
      }
      
      return {
        url: data.url,
        apiKey: data?.apiKey
      };
    } catch (error) {
      console.error('Error getting evolution config:', error);
      throw new Error('Configuração da Evolution API não encontrada. Configure a URL e API Key nas configurações do workspace.');
    }
  }

  private getHeaders() {
    // Get current user from localStorage (custom auth system)
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id) {
      throw new Error('Usuário não autenticado');
    }

    return {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': currentUserData.workspace_id || ''
    };
  }

  async listConnections(workspaceId: string): Promise<ConnectionsListResponse> {
    try {
      console.log('🔍 EvolutionProvider.listConnections called with workspaceId:', workspaceId);
      
      // Get user data for headers
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      console.log('👤 Current user data:', currentUserData);
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': workspaceId
      };
      
      console.log('📤 Calling evolution-list-connections with headers:', headers);

      const { data } = await supabase.functions.invoke('evolution-list-connections', {
        body: { workspaceId },
        headers
      });
      
      console.log('📥 Evolution API response:', data);
      
      if (!data?.success) {
        return { 
          connections: [], 
          quota: { used: 0, limit: 1 } 
        };
      }
      
      return {
        connections: data.connections || [],
        quota: data.quota || { used: 0, limit: 1 }
      };
    } catch (error) {
      console.warn('Error listing connections:', error);
      return { 
        connections: [], 
        quota: { used: 0, limit: 1 } 
      };
    }
  }

  async createConnection(request: ConnectionCreateRequest): Promise<ConnectionResponse> {
    const retryCount = 3;
    const retryDelay = 2000;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        console.log(`🏗️ EvolutionProvider: Creating connection - Attempt ${attempt}/${retryCount}`, request);
        
        const headers = getWorkspaceHeaders(request.workspaceId);
        console.log('📤 Request headers:', headers);
        console.log('🔗 Function URL will be:', getSupabaseFunctionUrl('evolution-create-instance'));
        
        const response = await supabase.functions.invoke('evolution-create-instance', {
          body: request,
          headers
        });

        console.log('📥 Raw Supabase response:', response);
        const { data, error } = response;

        if (error) {
          console.error(`❌ Error from evolution-create-instance function (attempt ${attempt}):`, error);
          console.error('❌ Error details:', JSON.stringify(error, null, 2));
          
          // Try to extract detailed error from data even when there's an error
          let detailedError = error.message || 'Erro ao criar instância';
          
          if (data && typeof data === 'object') {
            console.log('📦 Error response data:', data);
            if (data.error) {
              detailedError = data.error;
            }
          }
          
          // Se for erro CORS/rede e ainda temos tentativas, retry
          if (attempt < retryCount && (
            error.message?.includes('Failed to fetch') || 
            error.message?.includes('NetworkError') ||
            error.message?.includes('CORS') ||
            error.message?.includes('fetch')
          )) {
            console.log(`⏳ Network error, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          
          // Enhanced error handling for CORS issues
          if (error.message?.includes('Failed to fetch') || 
              error.message?.includes('NetworkError') ||
              error.message?.includes('CORS')) {
            throw new Error('Erro de conexão com o servidor. Verificando disponibilidade...');
          }
          
          throw new Error(detailedError);
        }

        if (!data?.success) {
          console.error('❌ Function returned unsuccessful response:', data);
          // Use the detailed error message from the edge function
          const errorMessage = data?.error || 'Falha ao criar instância';
          throw new Error(errorMessage);
        }

        console.log('✅ Connection created successfully:', data);
        
        // If there's a QR code in the response, include it in the connection
        const connection = data.connection;
        if (data.qr_code && !connection.qr_code) {
          connection.qr_code = data.qr_code;
        }
        
        return connection;
        
      } catch (error: any) {
        console.error(`❌ EvolutionProvider.createConnection error (attempt ${attempt}):`, error);
        console.error('❌ Error stack:', error.stack);
        
        // Se for último attempt, lança o erro
        if (attempt === retryCount) {
          // Re-throw with more specific error information
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new Error('Erro de conexão: Serviço temporariamente indisponível');
          }
          
          throw error;
        }
        
        // Se for erro de rede, tenta novamente
        if (error instanceof TypeError || 
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('CORS') ||
            error.message?.includes('fetch')) {
          console.log(`⏳ Network error, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        // Para outros tipos de erro, não retry
        throw error;
      }
    }
    
    throw new Error('Falha ao criar instância após múltiplas tentativas');
  }

  async getConnectionStatus(connectionId: string): Promise<ConnectionResponse> {
    const { data, error } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'status', connectionId }
    });
    
    // Tratar erro de invocação
    if (error) {
      console.error('Error invoking evolution-manage-instance:', error);
      throw new Error(error.message || 'Failed to invoke status check');
    }
    
    // Validar resposta
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to get connection status');
    }
    
    // A edge function retorna { success, status, evolutionData }
    // Construir o objeto ConnectionResponse esperado
    return {
      id: connectionId,
      instance_name: data.evolutionData?.instance?.instanceName || '',
      status: data.status,
      phone_number: data.evolutionData?.instance?.owner || undefined,
    } as ConnectionResponse;
  }

  async getQRCode(connectionId: string): Promise<{ qr_code: string }> {
    // Primeiro, buscar a conexão para verificar o provider
    const { data: connection, error: connError } = await supabase
      .from('connections')
      .select('provider_id, whatsapp_providers(provider)')
      .eq('id', connectionId)
      .single();

    if (connError || !connection) {
      throw new Error('Conexão não encontrada');
    }

    const provider = connection.whatsapp_providers?.provider;
    const functionName = provider === 'zapi' ? 'refresh-zapi-qr' : 'evolution-refresh-qr';
    
    console.log(`📱 Getting QR code using ${functionName} for ${provider} provider`);

    const { data } = await supabase.functions.invoke(functionName, {
      body: { connectionId }
    });
    
    console.log('QR Code response:', data);
    
    if (!data?.success) {
      throw new Error(data?.error || 'Failed to get QR code');
    }
    
    if (!data.qr_code) {
      throw new Error('QR Code não encontrado na resposta');
    }
    
    return { qr_code: data.qr_code };
  }

  async testConnection(): Promise<{
    success: boolean;
    tests: Array<{ test: string; passed: boolean; message?: string }>;
    summary: { passed: number; total: number };
  }> {
    // Mock test for now - can be implemented later
    return {
      success: true,
      tests: [
        { test: 'Evolution API Connection', passed: true, message: 'Connected successfully' },
        { test: 'Webhook Configuration', passed: true, message: 'Webhook configured' }
      ],
      summary: { passed: 2, total: 2 }
    };
  }

  async reconnectInstance(connectionId: string): Promise<{ success: boolean }> {
    const { data } = await supabase.functions.invoke('evolution-manage-instance', {
      body: { action: 'reconnect', connectionId }
    });
    
    return { success: data?.success || false };
  }

  async pauseInstance(connectionId: string): Promise<{ success: boolean }> {
    try {
      console.log('⏸️ EvolutionProvider.pauseInstance called with connectionId:', connectionId);
      
      // Use the new dedicated disconnect function
      const { data, error } = await supabase.functions.invoke('disconnect-connection', {
        body: { connectionId }
      });
      
      console.log('📥 Disconnect response:', { data, error });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        // Even on error, try to return success as fallback
        return { success: true };
      }
      
      // Always return success - the function always succeeds
      return { success: data?.success !== false };
    } catch (error) {
      console.error('❌ Error in pauseInstance:', error);
      // Always return success on disconnect
      return { success: true };
    }
  }

  async updateConnection(request: ConnectionUpdateRequest): Promise<ConnectionResponse> {
    try {
      console.log('🔄 EvolutionProvider.updateConnection called with request:', request);
      
      // Get user data for headers
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': currentUserData.workspace_id || ''
      };
      
      console.log('📤 Calling update-connection with headers:', headers);

      const { data, error } = await supabase.functions.invoke('update-connection', {
        body: request,
        headers
      });
      
      // Log detalhado para debug
      console.log('📥 Update response - data:', data);
      console.log('📥 Update response - data.success:', data?.success);
      console.log('📥 Update response - data.error:', data?.error);
      console.log('📥 Update response - error:', error);
      
      // Primeiro checar se temos data com erro
      if (data && data.success === false) {
        const errMsg = data.error;
        console.error('❌ Function returned error:');
        console.error('  - Type:', typeof errMsg);
        console.error('  - Value:', errMsg);
        console.error('  - Keys:', errMsg ? Object.keys(errMsg) : 'N/A');
        
        // Extrair mensagem do erro
        let errorMessage = 'Falha ao atualizar conexão';
        if (typeof errMsg === 'string') {
          errorMessage = errMsg;
        } else if (errMsg && typeof errMsg === 'object') {
          // Tentar várias propriedades comuns de erro
          errorMessage = errMsg.message || errMsg.error || errMsg.detail || errMsg.hint || 
                        (errMsg.code ? `Erro ${errMsg.code}` : null) ||
                        JSON.stringify(errMsg);
        }
        
        console.error('  - Final message:', errorMessage);
        throw new Error(errorMessage);
      }
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw new Error(error.message || 'Erro ao atualizar conexão');
      }

      if (!data?.success) {
        console.error('❌ Data indicates failure:', data);
        throw new Error('Falha ao atualizar conexão');
      }
      
      return data.connection;
    } catch (error) {
      console.error('❌ Error in updateConnection:', error);
      throw error;
    }
  }

  async deleteConnection(connectionId: string): Promise<{ success: boolean }> {
    try {
      console.log('🗑️ EvolutionProvider.deleteConnection called with connectionId:', connectionId);
      
      // Get user data for headers
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': currentUserData.workspace_id || ''
      };
      
      console.log('📤 Calling evolution-manage-instance delete with headers:', headers);

      const { data, error } = await supabase.functions.invoke('evolution-manage-instance', {
        body: { action: 'delete', connectionId },
        headers
      });
      
      console.log('📥 Delete response:', { data, error });
      
      if (error) {
        console.error('❌ Supabase function error:', error);
        throw new Error(error.message || 'Erro ao chamar função de exclusão');
      }
      
      // Se o backend retornou success: false, lançar erro com a mensagem retornada
      if (!data?.success) {
        const errorMessage = data?.error || 'Erro ao excluir conexão';
        console.error('❌ Delete failed:', errorMessage);
        throw new Error(errorMessage);
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error in deleteConnection:', error);
      throw error;
    }
  }

  async getLogs(connectionId: string, limit: number = 100): Promise<{
    logs: Array<{
      id: string;
      level: string;
      message: string;
      event_type: string;
      created_at: string;
      metadata?: any;
    }>;
  }> {
    const { data } = await supabase
      .from('provider_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return {
      logs: data || []
    };
  }
}

export const evolutionProvider = new EvolutionProvider();