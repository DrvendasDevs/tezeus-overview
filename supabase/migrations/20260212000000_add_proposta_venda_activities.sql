-- Adiciona novos tipos de atividades: Proposta Enviada e Venda Realizada
-- Atualiza a função report_team_work_ranking para incluir as novas colunas

-- Primeiro remove a função existente pois o tipo de retorno mudou
DROP FUNCTION IF EXISTS public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.report_team_work_ranking(
  p_workspace_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_responsible_id uuid DEFAULT NULL
)
RETURNS TABLE (
  responsible_id uuid,
  mensagem bigint,
  ligacao_nao_atendida bigint,
  ligacao_atendida bigint,
  ligacao_abordada bigint,
  ligacao_agendada bigint,
  ligacao_follow_up bigint,
  reuniao_agendada bigint,
  reuniao_realizada bigint,
  reuniao_nao_realizada bigint,
  reuniao_reagendada bigint,
  whatsapp_enviado bigint,
  proposta_enviada bigint,
  venda_realizada bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      a.responsible_id,
      lower(trim(coalesce(a.type, ''))) AS t
    FROM public.activities a
    WHERE a.responsible_id IS NOT NULL
      AND (p_workspace_id IS NULL OR a.workspace_id = p_workspace_id)
      AND (p_from IS NULL OR a.created_at >= p_from)
      AND (p_to IS NULL OR a.created_at <= p_to)
      AND (p_responsible_id IS NULL OR a.responsible_id = p_responsible_id)
  )
  SELECT
    b.responsible_id,
    
    -- Mensagem
    COUNT(*) FILTER (WHERE b.t LIKE '%mensagem%')::bigint AS mensagem,
    
    -- Ligação não atendida (com e sem acento)
    COUNT(*) FILTER (WHERE 
      (b.t LIKE '%ligação não atendida%' OR b.t LIKE '%ligacao nao atendida%')
    )::bigint AS ligacao_nao_atendida,
    
    -- Ligação atendida (com e sem acento, exclui "não atendida")
    COUNT(*) FILTER (WHERE 
      (b.t LIKE '%ligação atendida%' OR b.t LIKE '%ligacao atendida%')
      AND b.t NOT LIKE '%não atendida%'
      AND b.t NOT LIKE '%nao atendida%'
    )::bigint AS ligacao_atendida,
    
    -- Ligação abordada
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%ligação abordada%' OR b.t LIKE '%ligacao abordada%'
    )::bigint AS ligacao_abordada,
    
    -- Ligação agendada
    COUNT(*) FILTER (WHERE 
      (b.t LIKE '%ligação agendada%' OR b.t LIKE '%ligacao agendada%')
      AND b.t NOT LIKE '%reagendada%'
    )::bigint AS ligacao_agendada,
    
    -- Ligação de follow up
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%ligação de follow up%' OR b.t LIKE '%ligacao de follow up%' OR b.t LIKE '%follow%up%'
    )::bigint AS ligacao_follow_up,
    
    -- Reunião agendada
    COUNT(*) FILTER (WHERE 
      (b.t LIKE '%reunião agendada%' OR b.t LIKE '%reuniao agendada%')
      AND b.t NOT LIKE '%reagendada%'
    )::bigint AS reuniao_agendada,
    
    -- Reunião realizada
    COUNT(*) FILTER (WHERE 
      (b.t LIKE '%reunião realizada%' OR b.t LIKE '%reuniao realizada%')
      AND b.t NOT LIKE '%não realizada%'
      AND b.t NOT LIKE '%nao realizada%'
    )::bigint AS reuniao_realizada,
    
    -- Reunião não realizada
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%reunião não realizada%' OR b.t LIKE '%reuniao nao realizada%'
    )::bigint AS reuniao_nao_realizada,
    
    -- Reunião reagendada
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%reunião reagendada%' OR b.t LIKE '%reuniao reagendada%'
    )::bigint AS reuniao_reagendada,
    
    -- WhatsApp enviado
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%whatsapp%'
    )::bigint AS whatsapp_enviado,
    
    -- Proposta enviada
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%proposta enviada%' OR b.t LIKE '%proposta%'
    )::bigint AS proposta_enviada,
    
    -- Venda realizada
    COUNT(*) FILTER (WHERE 
      b.t LIKE '%venda realizada%' OR b.t LIKE '%venda%'
    )::bigint AS venda_realizada
    
  FROM base b
  GROUP BY b.responsible_id;
$$;

GRANT EXECUTE ON FUNCTION public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_team_work_ranking(uuid, timestamptz, timestamptz, uuid) TO anon;

-- Atualiza também a view report_team_work_ranking_view
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
  COUNT(*) FILTER (WHERE b.t LIKE '%whatsapp%')::bigint AS whatsapp_enviado,
  COUNT(*) FILTER (WHERE b.t LIKE '%proposta%')::bigint AS proposta_enviada,
  COUNT(*) FILTER (WHERE b.t LIKE '%venda%')::bigint AS venda_realizada
FROM base b
GROUP BY b.workspace_id, b.responsible_id, b.activity_date;

COMMENT ON VIEW public.report_team_work_ranking_view IS 'Ranking de trabalho agregado por dia e responsável';

GRANT SELECT ON public.report_team_work_ranking_view TO authenticated;
GRANT SELECT ON public.report_team_work_ranking_view TO anon;
