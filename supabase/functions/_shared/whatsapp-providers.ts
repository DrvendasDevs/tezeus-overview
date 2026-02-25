import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===============================
// TYPES & INTERFACES
// ===============================

export interface SendTextParams {
  workspaceId: string;
  to: string;
  text: string;
  context?: Record<string, any>;
}

export interface SendMediaParams {
  workspaceId: string;
  to: string;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  fileName?: string;
  mimeType?: string;
  context?: Record<string, any>;
}

export interface SendResult {
  ok: boolean;
  providerMsgId?: string;
  error?: string;
  failoverFrom?: 'evolution' | 'zapi';
}

export interface TestResult {
  ok: boolean;
  message?: string;
}

export interface CreateInstanceParams {
  instanceName: string;
  webhookUrl: string;
  phoneNumber?: string;
  queueId?: string;
  autoCreateCrmCard?: boolean;
  defaultPipelineId?: string;
  defaultColumnId?: string;
  defaultColumnName?: string;
  historyRecovery?: string;
  historyDays?: number;
  metadata?: any;
}

export interface CreateInstanceResult {
  ok: boolean;
  qrCode?: string;
  token?: string;
  sessionId?: string;
  error?: string;
  details?: any;
}

export interface WhatsAppProvider {
  name: 'evolution' | 'zapi';
  testConnection(): Promise<TestResult>;
  sendText(params: SendTextParams): Promise<SendResult>;
  sendMedia(params: SendMediaParams): Promise<SendResult>;
  createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult>;
}

export interface ProviderConfig {
  id: string;
  workspace_id: string;
  provider: 'evolution' | 'zapi';
  is_active: boolean;
  evolution_url?: string;
  evolution_token?: string;
  zapi_url?: string;
  zapi_token?: string;
  n8n_webhook_url?: string;
  enable_fallback: boolean;
}

// ===============================
// EVOLUTION ADAPTER
// ===============================

export class EvolutionAdapter implements WhatsAppProvider {
  name: 'evolution' = 'evolution';
  private url: string;
  private token: string;

  constructor(config: ProviderConfig) {
    if (!config.evolution_url || !config.evolution_token) {
      throw new Error('Evolution URL e Token são obrigatórios');
    }
    this.url = config.evolution_url;
    this.token = config.evolution_token;
  }

  async testConnection(): Promise<TestResult> {
    try {
      console.log('🔍 [Evolution] Testando conexão:', this.url);
      
      const response = await fetch(`${this.url}/instance/fetchInstances`, {
        method: 'GET',
        headers: {
          'apikey': this.token,
          'Content-Type': 'application/json',
        },
      });

      const ok = response.ok;
      const message = ok ? 'Conexão estabelecida com sucesso' : `Erro HTTP ${response.status}`;
      
      console.log(ok ? '✅' : '❌', `[Evolution] ${message}`);
      return { ok, message };
    } catch (e: any) {
      const message = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Evolution] Erro na conexão:', message);
      return { ok: false, message };
    }
  }

  async sendText({ to, text, context }: SendTextParams): Promise<SendResult> {
    try {
      console.log('📤 [Evolution] Enviando texto para:', to);
      
      const instance = context?.instance || context?.evolutionInstance;
      if (!instance) {
        throw new Error('Instance name é obrigatório');
      }

      const response = await fetch(`${this.url}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'apikey': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: to,
          text: text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log('✅ [Evolution] Texto enviado:', data?.key?.id);
        return { ok: true, providerMsgId: data?.key?.id || data?.messageId };
      } else {
        console.error('❌ [Evolution] Erro ao enviar:', JSON.stringify(data));
        return { ok: false, error: JSON.stringify(data) };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Evolution] Erro no envio:', error);
      return { ok: false, error };
    }
  }

  async sendMedia({ to, mediaUrl, mediaType, caption, fileName, mimeType, context }: SendMediaParams): Promise<SendResult> {
    try {
      console.log('📤 [Evolution] Enviando mídia para:', to, 'tipo:', mediaType);
      
      const instance = context?.instance || context?.evolutionInstance;
      if (!instance) {
        throw new Error('Instance name é obrigatório');
      }

      const endpoint = `${this.url}/message/sendMedia/${instance}`;
      
      const payload: any = {
        number: to,
        mediatype: mediaType,
        media: mediaUrl,
      };

      if (caption) payload.caption = caption;
      if (fileName) payload.fileName = fileName;
      if (mimeType) payload.mimetype = mimeType;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log('✅ [Evolution] Mídia enviada:', data?.key?.id);
        return { ok: true, providerMsgId: data?.key?.id || data?.messageId };
      } else {
        console.error('❌ [Evolution] Erro ao enviar mídia:', JSON.stringify(data));
        return { ok: false, error: JSON.stringify(data) };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Evolution] Erro no envio de mídia:', error);
      return { ok: false, error };
    }
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    try {
      console.log('📤 [Evolution] Criando instância:', params.instanceName);
      
      const payload: any = {
        instanceName: params.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: false,
        msgCall: '',
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        webhook: {
          url: params.webhookUrl,
          byEvents: true,
          base64: true,
          events: [
            'QRCODE_UPDATED',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE'
          ]
        }
      };

      if (params.phoneNumber) {
        payload.number = params.phoneNumber;
      }

      const response = await fetch(`${this.url}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        console.log('✅ [Evolution] Instância criada:', data);
        return {
          ok: true,
          qrCode: data.qrcode?.base64 || data.qr || null,
          token: data.hash || null,
          details: data
        };
      } else {
        console.error('❌ [Evolution] Erro ao criar instância:', JSON.stringify(data));
        return {
          ok: false,
          error: data.response?.message?.[0] || data.message || 'Failed to create instance',
          details: data
        };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Evolution] Erro na criação de instância:', error);
      return { ok: false, error };
    }
  }
}

// ===============================
// Z-API ADAPTER
// ===============================

export class ZapiAdapter implements WhatsAppProvider {
  name: 'zapi' = 'zapi';
  private url: string;
  private token: string;

  constructor(config: ProviderConfig) {
    if (!config.zapi_token) {
      throw new Error('Z-API Token é obrigatório');
    }
    // Z-API uses a fixed URL for on-demand instance creation (endpoint correto: integrator)
    this.url = config.zapi_url || 'https://api.z-api.io/instances/integrator/on-demand';
    this.token = config.zapi_token;
  }

  async testConnection(): Promise<TestResult> {
    try {
      console.log('🔍 [Z-API] Testando conexão com Client-Token');
      
      // Z-API test endpoint - uses Client-Token authentication
      const response = await fetch(`${this.url}/ping`, {
        method: 'GET',
        headers: {
          'Client-Token': this.token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ [Z-API] Resposta de erro:', response.status, errorText);
        return { 
          ok: false, 
          message: `Erro HTTP ${response.status}. Verifique se o Client-Token está correto.` 
        };
      }

      const data = await response.json().catch(() => ({}));
      console.log('✅ [Z-API] Conexão estabelecida:', data);
      
      return { 
        ok: true, 
        message: 'Conexão estabelecida com sucesso' 
      };
    } catch (e: any) {
      const message = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Z-API] Erro na conexão:', message);
      return { 
        ok: false, 
        message: `Erro: ${message}. Verifique o Client-Token.` 
      };
    }
  }

  async sendText({ to, text }: SendTextParams): Promise<SendResult> {
    try {
      console.log('📤 [Z-API] Enviando texto para:', to);
      
      const response = await fetch(`${this.url}/send-text`, {
        method: 'POST',
        headers: {
          'Client-Token': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: to,
          message: text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log('✅ [Z-API] Texto enviado:', data?.messageId);
        return { ok: true, providerMsgId: data?.messageId || data?.id };
      } else {
        console.error('❌ [Z-API] Erro ao enviar:', JSON.stringify(data));
        return { ok: false, error: JSON.stringify(data) };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Z-API] Erro no envio:', error);
      return { ok: false, error };
    }
  }

  async sendMedia({ to, mediaUrl, mediaType, caption }: SendMediaParams): Promise<SendResult> {
    try {
      console.log('📤 [Z-API] Enviando mídia para:', to, 'tipo:', mediaType);
      
      // Z-API usa endpoints diferentes por tipo de mídia
      const endpointMap: Record<string, string> = {
        image: 'send-image',
        video: 'send-video',
        audio: 'send-audio',
        document: 'send-document',
      };

      const endpoint = `${this.url}/${endpointMap[mediaType] || 'send-file-url'}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Client-Token': this.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: to,
          image: mediaType === 'image' ? mediaUrl : undefined,
          video: mediaType === 'video' ? mediaUrl : undefined,
          audio: mediaType === 'audio' ? mediaUrl : undefined,
          document: mediaType === 'document' ? mediaUrl : undefined,
          caption: caption || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      
      if (response.ok) {
        console.log('✅ [Z-API] Mídia enviada:', data?.messageId);
        return { ok: true, providerMsgId: data?.messageId || data?.id };
      } else {
        console.error('❌ [Z-API] Erro ao enviar mídia:', JSON.stringify(data));
        return { ok: false, error: JSON.stringify(data) };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Z-API] Erro no envio de mídia:', error);
      return { ok: false, error };
    }
  }

  async createInstance(params: CreateInstanceParams): Promise<CreateInstanceResult> {
    try {
      console.log('📤 [Z-API] Criando instância on-demand:', params.instanceName);
      
      const payload = {
        instanceName: params.instanceName,
        webhookUrl: params.webhookUrl,
        phoneNumber: params.phoneNumber,
      };

      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`, // ✅ Bearer Token de Integrator para criar instância
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

    if (response.ok) {
      console.log('✅ [Z-API] Instância criada com dados:', JSON.stringify(data, null, 2));
      
      // Fazer assinatura da instância
      const instanceId = data.instanceId || data.id;
      const instanceToken = data.token;
      
      console.log('🔍 [Z-API] Dados para assinatura - instanceId:', instanceId, 'instanceToken:', instanceToken);
      
      if (instanceId && instanceToken) {
        try {
          // Construir URL base corretamente
          const baseUrl = this.url.replace('/instances/integrator/on-demand', '');
          const subscriptionUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/integrator/on-demand/subscription`;
          
          console.log('📤 [Z-API] URL de assinatura:', subscriptionUrl);
          console.log('📤 [Z-API] Assinando instância:', instanceId);
          
          const subscriptionResponse = await fetch(subscriptionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Content-Type': 'application/json',
            },
          });
          
          const subscriptionData = await subscriptionResponse.json().catch(() => ({}));
          
          if (subscriptionResponse.ok) {
            console.log('✅ [Z-API] Instância assinada com sucesso:', subscriptionData);
          } else {
            console.error('❌ [Z-API] Erro ao assinar instância (status:', subscriptionResponse.status, '):', subscriptionData);
          }
        } catch (subError: any) {
          console.error('❌ [Z-API] Exceção ao assinar instância:', subError.message, subError.stack);
        }
      } else {
        console.error('❌ [Z-API] Dados insuficientes para assinatura. instanceId:', instanceId, 'instanceToken:', instanceToken);
      }
      
      return {
        ok: true,
        qrCode: data.qrcode || data.qr || null,
        sessionId: data.instanceId || data.id || null,
        details: data
      };
    } else {
        console.error('❌ [Z-API] Erro ao criar instância:', JSON.stringify(data));
        return {
          ok: false,
          error: data.message || 'Failed to create instance',
          details: data
        };
      }
    } catch (e: any) {
      const error = e?.message ?? 'Erro desconhecido';
      console.error('❌ [Z-API] Erro na criação de instância:', error);
      return { ok: false, error };
    }
  }
}

// ===============================
// FACTORY & RESOLUTION
// ===============================

export async function getActiveProviderForWorkspace(
  workspaceId: string,
  supabase: SupabaseClient
): Promise<WhatsAppProvider> {
  console.log('🔍 Buscando provedor ativo para workspace:', workspaceId);

  const { data: provider, error } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .single();

  if (error || !provider) {
    console.error('❌ Nenhum provedor ativo encontrado:', error);
    throw new Error('Nenhum provedor WhatsApp ativo configurado para este workspace');
  }

  console.log('✅ Provedor ativo encontrado:', provider.provider);

  if (provider.provider === 'evolution') {
    return new EvolutionAdapter(provider);
  }

  if (provider.provider === 'zapi') {
    return new ZapiAdapter(provider);
  }

  throw new Error(`Provedor inválido: ${provider.provider}`);
}

// ===============================
// FALLBACK LOGIC
// ===============================


export async function sendWithOptionalFallback(
  params: SendTextParams | SendMediaParams,
  type: 'text' | 'media',
  supabase: SupabaseClient
): Promise<SendResult> {
  const { workspaceId } = params;
  const startTime = Date.now();

  console.log('📡 [Fallback] Iniciando envio com fallback opcional...');

  // Buscar provedor ativo
  const { data: activeProvider, error: activeError } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .single();

  if (activeError || !activeProvider) {
    console.error('❌ [Fallback] Sem provedor ativo');
    throw new Error('Sem provedor ativo configurado');
  }

  // Criar adapter primário
  const primaryAdapter = activeProvider.provider === 'evolution'
    ? new EvolutionAdapter(activeProvider)
    : new ZapiAdapter(activeProvider);

  // Tentar enviar com provedor primário
  console.log(`📤 [Fallback] Tentando envio via ${primaryAdapter.name}...`);
  const sendStartTime = Date.now();
  const result1 = type === 'text'
    ? await primaryAdapter.sendText(params as SendTextParams)
    : await primaryAdapter.sendMedia(params as SendMediaParams);
  const responseTime = Date.now() - sendStartTime;

  // Registrar log do envio primário
  await logProviderAction(
    supabase,
    workspaceId,
    activeProvider.provider,
    'send_message',
    result1.ok ? 'success' : 'error',
    {
      type,
      responseTime,
      error: result1.error,
      provider: activeProvider.provider,
    }
  );

  // Se sucesso ou fallback desabilitado, retornar
  if (result1.ok || !activeProvider.enable_fallback) {
    console.log(result1.ok ? '✅' : '❌', `[Fallback] Resultado final:`, result1);
    return result1;
  }

  // Buscar provedor alternativo
  console.log('⚠️ [Fallback] Provedor primário falhou. Buscando alternativo...');
  const { data: altProvider } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('provider', activeProvider.provider)
    .single();

  if (!altProvider) {
    console.log('⚠️ [Fallback] Sem provedor alternativo configurado');
    return result1;
  }

  // Tentar com provedor alternativo
  const altAdapter = altProvider.provider === 'evolution'
    ? new EvolutionAdapter(altProvider)
    : new ZapiAdapter(altProvider);

  console.log(`📤 [Fallback] Tentando envio via ${altAdapter.name}...`);
  const altStartTime = Date.now();
  const result2 = type === 'text'
    ? await altAdapter.sendText(params as SendTextParams)
    : await altAdapter.sendMedia(params as SendMediaParams);
  const altResponseTime = Date.now() - altStartTime;

  // Registrar log do fallback
  await logProviderAction(
    supabase,
    workspaceId,
    altProvider.provider,
    'send_message',
    result2.ok ? 'success' : 'error',
    {
      type,
      responseTime: altResponseTime,
      isFallback: true,
      error: result2.error,
      provider: altProvider.provider,
    }
  );

  if (result2.ok) {
    console.log('✅ [Fallback] Sucesso via failover!');
    return { ...result2, failoverFrom: primaryAdapter.name };
  }

  console.log('❌ [Fallback] Ambos provedores falharam');
  return result1;
}

// ===============================
// LOGGING HELPER
// ===============================

export async function logProviderAction(
  supabase: SupabaseClient,
  workspaceId: string,
  provider: 'evolution' | 'zapi',
  action: string,
  result: 'success' | 'error',
  payload: any
) {
  try {
    const { responseTime, ...metadata } = payload;
    
    await supabase.from('whatsapp_provider_logs').insert({
      workspace_id: workspaceId,
      provider,
      action,
      result,
      response_time_ms: responseTime || null,
      error_message: payload.error || null,
      metadata,
    });
  } catch (e) {
    console.error('⚠️ Erro ao registrar log de provider:', e);
  }
}
