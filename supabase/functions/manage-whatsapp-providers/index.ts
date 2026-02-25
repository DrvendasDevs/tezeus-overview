import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email',
};

function normalizeWebhookUrl(url: string) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.includes('/test/') ? trimmed.replace('/test/', '/webhook/') : trimmed;
}

async function syncWorkspaceWebhook(
  supabase: any,
  workspaceId: string,
  webhookUrl?: string | null
) {
  if (!webhookUrl) return;
  const normalizedUrl = normalizeWebhookUrl(webhookUrl);
  if (!normalizedUrl) return;

  const now = new Date().toISOString();

  const { data: existingSettings } = await supabase
    .from('workspace_webhook_settings')
    .select('webhook_secret')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const webhookSecret = existingSettings?.webhook_secret || crypto.randomUUID();

  await supabase
    .from('workspace_webhook_settings')
    .upsert({
      workspace_id: workspaceId,
      webhook_url: normalizedUrl,
      webhook_secret: webhookSecret,
      updated_at: now
    }, {
      onConflict: 'workspace_id'
    });

  const secretName = `N8N_WEBHOOK_URL_${workspaceId}`;

  const { data: existingSecret } = await supabase
    .from('workspace_webhook_secrets')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('secret_name', secretName)
    .maybeSingle();

  if (existingSecret?.id) {
    await supabase
      .from('workspace_webhook_secrets')
      .update({
        webhook_url: normalizedUrl,
        updated_at: now
      })
      .eq('id', existingSecret.id);
  } else {
    await supabase
      .from('workspace_webhook_secrets')
      .insert({
        workspace_id: workspaceId,
        secret_name: secretName,
        webhook_url: normalizedUrl
      });
  }

  console.log(`🔄 [Manage Providers] Webhook sincronizado com ${normalizedUrl.substring(0, 50)}...`);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [Manage Providers] Starting...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, workspaceId, providerId, providerData } = await req.json();

    if (!workspaceId) {
      throw new Error('workspaceId é obrigatório');
    }

    console.log('📍 Action:', action);
    console.log('📍 Workspace:', workspaceId);

    // LIST - Listar providers do workspace
    if (action === 'list') {
      console.log('📋 Listando providers...');
      
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, providers: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE - Criar novo provider
    if (action === 'create') {
      console.log('➕ Criando provider:', providerData.provider);

      // Se o novo provider for ativo, desativar outros
      if (providerData.is_active) {
        console.log('🔄 Desativando outros providers...');
        await supabase
          .from('whatsapp_providers')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId);
      }

      const { data, error } = await supabase
        .from('whatsapp_providers')
        .insert({
          workspace_id: workspaceId,
          provider: providerData.provider,
          is_active: providerData.is_active || false,
          evolution_url: providerData.evolution_url,
          evolution_token: providerData.evolution_token,
          zapi_url: providerData.zapi_url,
          zapi_token: providerData.zapi_token,
          zapi_client_token: providerData.zapi_client_token,
          n8n_webhook_url: providerData.n8n_webhook_url,
          n8n_status_webhook_url: providerData.n8n_status_webhook_url,
          enable_fallback: providerData.enable_fallback || false,
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider criado:', data.id);

      if (data?.n8n_webhook_url) {
        await syncWorkspaceWebhook(supabase, workspaceId, data.n8n_webhook_url);
      }

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE - Atualizar provider existente
    if (action === 'update') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para update');
      }

      console.log('✏️ Atualizando provider:', providerId);

      // Se o provider está sendo ativado, desativar outros
      if (providerData.is_active) {
        console.log('🔄 Desativando outros providers...');
        await supabase
          .from('whatsapp_providers')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('workspace_id', workspaceId)
          .neq('id', providerId);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (providerData.is_active !== undefined) updateData.is_active = providerData.is_active;
      if (providerData.evolution_url !== undefined) updateData.evolution_url = providerData.evolution_url;
      if (providerData.evolution_token !== undefined) updateData.evolution_token = providerData.evolution_token;
      if (providerData.zapi_url !== undefined) updateData.zapi_url = providerData.zapi_url;
      if (providerData.zapi_token !== undefined) updateData.zapi_token = providerData.zapi_token;
      if (providerData.zapi_client_token !== undefined) updateData.zapi_client_token = providerData.zapi_client_token;
      if (providerData.n8n_webhook_url !== undefined) updateData.n8n_webhook_url = providerData.n8n_webhook_url;
      if (providerData.n8n_status_webhook_url !== undefined) updateData.n8n_status_webhook_url = providerData.n8n_status_webhook_url;
      if (providerData.enable_fallback !== undefined) updateData.enable_fallback = providerData.enable_fallback;

      const { data, error } = await supabase
        .from('whatsapp_providers')
        .update(updateData)
        .eq('id', providerId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider atualizado');

      if (data?.n8n_webhook_url) {
        await syncWorkspaceWebhook(supabase, workspaceId, data.n8n_webhook_url);
      }

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Deletar provider
    if (action === 'delete') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para delete');
      }

      console.log('🗑️ Deletando provider:', providerId);

      // Verificar se há connections usando este provider
      const { data: connections, error: connError } = await supabase
        .from('connections')
        .select('id')
        .eq('provider_id', providerId)
        .limit(1);

      if (connError) throw connError;

      if (connections && connections.length > 0) {
        throw new Error('Não é possível deletar provider com connections associadas');
      }

      const { error } = await supabase
        .from('whatsapp_providers')
        .delete()
        .eq('id', providerId)
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      console.log('✅ Provider deletado');

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTIVATE - Ativar provider específico
    if (action === 'activate') {
      if (!providerId) {
        throw new Error('providerId é obrigatório para activate');
      }

      console.log('🔌 Ativando provider:', providerId);

      // Desativar todos
      await supabase
        .from('whatsapp_providers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId);

      // Ativar o selecionado
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', providerId)
        .eq('workspace_id', workspaceId)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Provider ativado');

      if (data?.n8n_webhook_url) {
        await syncWorkspaceWebhook(supabase, workspaceId, data.n8n_webhook_url);
      }

      return new Response(
        JSON.stringify({ success: true, provider: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Ação desconhecida: ${action}`);

  } catch (error: any) {
    console.error('❌ [Manage Providers] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao gerenciar providers',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
