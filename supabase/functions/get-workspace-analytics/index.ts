import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Permitimos todos os headers para evitar bloqueio por preflight (inclui x-workspace-id)
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId;

    if (!workspaceId) throw new Error('workspaceId is required');

    console.log('📊 [ANALYTICS] Buscando para Workspace:', workspaceId);

    // 1) Validação simples do workspace
    const { data: wsData, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single();
    if (wsError) console.error('⚠️ [ANALYTICS] Erro ao validar workspace:', wsError.message);

    // 2) Contagens de conversas (sem baixar linhas)
    const statusAtivos = ['open', 'aberto', 'active', 'pendente', 'waiting'];
    const [totalConvs, activeConvs] = await Promise.all([
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .in('status', statusAtivos)
    ]);

    const totalConversations = totalConvs.count || 0;
    const activeConversations = activeConvs.count || 0;

    // 3) Pipelines e contagens de cards por status (sem baixar linhas)
    const { data: pipelines } = await supabase
      .from('pipelines')
      .select('id')
      .eq('workspace_id', workspaceId);
    const pipelineIds = pipelines?.map(p => p.id) || [];

    let completedDeals = 0;
    let lostDeals = 0;
    let dealsInProgress = 0;

    if (pipelineIds.length > 0) {
      const statusGanhos = ['won', 'ganho', 'vitoria', 'concluido'];
      const statusPerdidos = ['lost', 'perdido', 'derrota', 'cancelado'];

      const [ganhos, perdidos, totalCards] = await Promise.all([
        supabase
          .from('pipeline_cards')
          .select('id', { count: 'exact', head: true })
          .in('pipeline_id', pipelineIds)
          .in('status', statusGanhos),
        supabase
          .from('pipeline_cards')
          .select('id', { count: 'exact', head: true })
          .in('pipeline_id', pipelineIds)
          .in('status', statusPerdidos),
        supabase
          .from('pipeline_cards')
          .select('id', { count: 'exact', head: true })
          .in('pipeline_id', pipelineIds)
      ]);

      completedDeals = ganhos.count || 0;
      lostDeals = perdidos.count || 0;
      const total = totalCards.count || 0;
      dealsInProgress = Math.max(0, total - completedDeals - lostDeals);
    }

    const totalClosed = completedDeals + lostDeals;
    const conversionRate = totalClosed > 0 ? (completedDeals / totalClosed) * 100 : 0;

    // Resposta enxuta (sem tendências para não pesar)
    return new Response(
      JSON.stringify({
        activeConversations,
        totalConversations,
        dealsInProgress,
        completedDeals,
        lostDeals,
        conversionRate,
        averageResponseTime: 0,
        conversationTrends: [],
        dealTrends: [],
        _debug: {
          wsName: wsData?.name || 'N/A',
          pipelines: pipelineIds.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [ANALYTICS] Erro Crítico:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
