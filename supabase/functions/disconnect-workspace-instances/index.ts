import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configuração Evolution API do workspace
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_api_config')
      .select('api_url, api_key')
      .eq('workspace_id', workspaceId)
      .single();

    if (configError || !evolutionConfig) {
      console.log('No Evolution API config found for workspace:', workspaceId);
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma configuração Evolution API encontrada',
          disconnected: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todas as instâncias conectadas do workspace
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('instance_name, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['connected', 'open']);

    if (instancesError) {
      console.error('Error fetching instances:', instancesError);
      return new Response(
        JSON.stringify({ error: 'Falha ao buscar instâncias' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!instances || instances.length === 0) {
      console.log('No connected instances found for workspace:', workspaceId);
      return new Response(
        JSON.stringify({ 
          message: 'Nenhuma instância conectada encontrada',
          disconnected: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${instances.length} connected instances to disconnect`);

    let disconnectedCount = 0;
    const errors: string[] = [];

    // Desconectar cada instância via Evolution API
    for (const instance of instances) {
      try {
        const logoutUrl = `${evolutionConfig.api_url}/instance/logout/${instance.instance_name}`;
        
        const response = await fetch(logoutUrl, {
          method: 'DELETE',
          headers: {
            'apikey': evolutionConfig.api_key,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          // Atualizar status no banco
          await supabase
            .from('whatsapp_instances')
            .update({ 
              status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('instance_name', instance.instance_name)
            .eq('workspace_id', workspaceId);

          disconnectedCount++;
          console.log(`Disconnected instance: ${instance.instance_name}`);
        } else {
          const errorText = await response.text();
          console.error(`Failed to disconnect ${instance.instance_name}:`, errorText);
          errors.push(`${instance.instance_name}: ${errorText}`);
        }
      } catch (error) {
        console.error(`Error disconnecting instance ${instance.instance_name}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${instance.instance_name}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Processo de desconexão concluído',
        totalInstances: instances.length,
        disconnected: disconnectedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error disconnecting instances:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
