-- ============================================
-- Views para Ranking de Vendas e Ranking de Trabalho
-- ============================================

-- 1) Ranking de Vendas (somente negócios ganhos com produtos)
CREATE OR REPLACE VIEW public.report_sales_ranking_view AS
SELECT
  p.workspace_id,
  pc.id AS card_id,
  pc.responsible_user_id,
  COALESCE(pc.updated_at, pc.created_at) AS card_date,
  pc.status,
  SUM(
    COALESCE(
      pcp.total_value,
      (pcp.unit_value * COALESCE(pcp.quantity, 1)),
      0
    )
  ) AS products_revenue,
  COALESCE(
    NULLIF(
      SUM(
        COALESCE(
          pcp.total_value,
          (pcp.unit_value * COALESCE(pcp.quantity, 1)),
          0
        )
      ),
      0
    ),
    pc.value,
    0
  ) AS revenue,
  SUM(COALESCE(pcp.quantity, 1)) AS products_qty
FROM public.pipeline_cards pc
JOIN public.pipelines p ON p.id = pc.pipeline_id
JOIN public.pipeline_cards_products pcp ON pcp.pipeline_card_id = pc.id
WHERE lower(COALESCE(pc.status, '')) IN ('won', 'ganho', 'venda', 'success', 'sucesso')
GROUP BY
  p.workspace_id,
  pc.id,
  pc.responsible_user_id,
  pc.status,
  card_date,
  pc.value;

COMMENT ON VIEW public.report_sales_ranking_view IS 'Ranking de vendas por card ganho com produtos e receita agregada';

GRANT SELECT ON public.report_sales_ranking_view TO authenticated;
GRANT SELECT ON public.report_sales_ranking_view TO anon;

-- 2) Ranking de Trabalho (agregado por dia/responsável)
CREATE OR REPLACE VIEW public.report_team_work_ranking_view AS
WITH base AS (
  SELECT
    a.workspace_id,
    a.responsible_id,
    (a.created_at::date) AS activity_date,
    translate(lower(trim(coalesce(a.type, ''))),
      'ãâáàêéèîíìõôóòûúùç',
      'aaaaeeeiiiooouuuc'
    ) AS t
  FROM public.activities a
  WHERE a.responsible_id IS NOT NULL
)
SELECT
  b.workspace_id,
  b.responsible_id,
  b.activity_date,
  COUNT(*) FILTER (WHERE b.t LIKE '%mensagem%')::bigint AS mensagem,
  COUNT(*) FILTER (WHERE b.t LIKE '%ligacao nao atendida%')::bigint AS ligacao_nao_atendida,
  COUNT(*) FILTER (WHERE b.t LIKE '%ligacao atendida%' AND b.t NOT LIKE '%nao atendida%')::bigint AS ligacao_atendida,
  COUNT(*) FILTER (WHERE b.t LIKE '%ligacao abordada%')::bigint AS ligacao_abordada,
  COUNT(*) FILTER (WHERE b.t LIKE '%ligacao agendada%' AND b.t NOT LIKE '%reagendada%')::bigint AS ligacao_agendada,
  COUNT(*) FILTER (WHERE b.t LIKE '%follow up%' OR b.t LIKE '%followup%' OR b.t LIKE '%follow%up%')::bigint AS ligacao_follow_up,
  COUNT(*) FILTER (WHERE b.t LIKE '%reuniao agendada%' AND b.t NOT LIKE '%reagendada%')::bigint AS reuniao_agendada,
  COUNT(*) FILTER (WHERE b.t LIKE '%reuniao realizada%' AND b.t NOT LIKE '%nao realizada%')::bigint AS reuniao_realizada,
  COUNT(*) FILTER (WHERE b.t LIKE '%reuniao nao realizada%')::bigint AS reuniao_nao_realizada,
  COUNT(*) FILTER (WHERE b.t LIKE '%reuniao reagendada%')::bigint AS reuniao_reagendada,
  COUNT(*) FILTER (WHERE b.t LIKE '%whatsapp%')::bigint AS whatsapp_enviado
FROM base b
GROUP BY b.workspace_id, b.responsible_id, b.activity_date;

COMMENT ON VIEW public.report_team_work_ranking_view IS 'Ranking de trabalho agregado por dia e responsável';

GRANT SELECT ON public.report_team_work_ranking_view TO authenticated;
GRANT SELECT ON public.report_team_work_ranking_view TO anon;
