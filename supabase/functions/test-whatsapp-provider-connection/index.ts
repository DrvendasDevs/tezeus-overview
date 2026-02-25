import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  getActiveProviderForWorkspace,
  EvolutionAdapter,
  ZapiAdapter,
  type WhatsAppProvider,
  type ProviderConfig
} from '../_shared/whatsapp-providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 [Test Provider Connection] Starting...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workspaceId, provider, providerId } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId é obrigatório');
    }

    console.log('📍 Workspace:', workspaceId);
    console.log('🔌 Provider:', provider || 'ativo');

    let providerConfig: ProviderConfig;

    // Se providerId foi especificado, buscar por ID
    if (providerId) {
      console.log('🔍 Buscando provider por ID:', providerId);
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('id', providerId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error || !data) {
        throw new Error(`Provider não encontrado: ${error?.message}`);
      }

      providerConfig = data;
    }
    // Se provider foi especificado, buscar por tipo
    else if (provider) {
      console.log('🔍 Buscando provider por tipo:', provider);
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('provider', provider)
        .single();

      if (error || !data) {
        throw new Error(`Provider ${provider} não encontrado: ${error?.message}`);
      }

      providerConfig = data;
    }
    // Caso contrário, buscar o provider ativo
    else {
      console.log('🔍 Buscando provider ativo...');
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error(`Nenhum provider ativo encontrado: ${error?.message}`);
      }

      providerConfig = data;
    }

    console.log('✅ Provider encontrado:', providerConfig.provider);

    // Criar adapter apropriado
    let adapter: WhatsAppProvider;
    
    if (providerConfig.provider === 'evolution') {
      if (!providerConfig.evolution_url || !providerConfig.evolution_token) {
        throw new Error('Credenciais Evolution incompletas. Configure URL e Token.');
      }
      adapter = new EvolutionAdapter(providerConfig);
    } else if (providerConfig.provider === 'zapi') {
      if (!providerConfig.zapi_url || !providerConfig.zapi_token) {
        throw new Error('Credenciais Z-API incompletas. Configure URL e Token.');
      }
      adapter = new ZapiAdapter(providerConfig);
    } else {
      throw new Error(`Provider não suportado: ${providerConfig.provider}`);
    }

    // Testar conexão
    console.log('🧪 Testando conexão com', adapter.name);
    const result = await adapter.testConnection();

    console.log(result.ok ? '✅' : '❌', 'Resultado:', result);

    // Registrar log
    try {
      await supabase.from('whatsapp_provider_logs').insert({
        workspace_id: workspaceId,
        provider: providerConfig.provider,
        action: 'test_connection',
        result: result.ok ? 'success' : 'error',
        payload: { 
          message: result.message,
          provider_id: providerConfig.id,
          tested_at: new Date().toISOString()
        },
      });
    } catch (logError) {
      console.error('⚠️ Erro ao registrar log:', logError);
    }

    return new Response(
      JSON.stringify({
        success: result.ok,
        provider: providerConfig.provider,
        message: result.message,
        details: {
          provider_id: providerConfig.id,
          is_active: providerConfig.is_active,
          tested_at: new Date().toISOString(),
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.ok ? 200 : 400,
      }
    );

  } catch (error: any) {
    console.error('❌ [Test Provider Connection] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao testar conexão',
        details: error.toString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
