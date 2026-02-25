-- =============================================
-- Migração: Criar VIEW e RPC otimizadas para deals do contato
-- =============================================
-- Objetivo: Melhorar a estabilidade do carregamento de oportunidades/negócios
-- do contato no WhatsApp Chat, que às vezes não carrega.

-- 1. VIEW para deals do contato com dados necessários
CREATE OR REPLACE VIEW public.contact_deals_view AS
SELECT 
  pc.id as card_id,
  pc.contact_id,
  pc.pipeline_id,
  pc.column_id,
  pc.status as card_status,
  pc.value,
  pc.description,
  p.name as pipeline_name,
  p.workspace_id,
  col.name as column_name
FROM public.pipeline_cards pc
INNER JOIN public.pipelines p ON p.id = pc.pipeline_id
LEFT JOIN public.pipeline_columns col ON col.id = pc.column_id
WHERE pc.is_lab_test IS NOT TRUE;

COMMENT ON VIEW public.contact_deals_view IS 'View otimizada para buscar deals/oportunidades de um contato';

-- 2. RPC para buscar deals do contato de forma otimizada
CREATE OR REPLACE FUNCTION public.get_contact_deals(
  p_contact_id UUID,
  p_workspace_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(
    json_build_object(
      'card_id', pc.id,
      'description', pc.description,
      'pipeline_id', pc.pipeline_id,
      'pipeline_name', p.name,
      'column_id', pc.column_id,
      'column_name', col.name,
      'card_status', pc.status
    ) ORDER BY 
      -- Priorizar ativos (não ganho/perdido)
      CASE WHEN LOWER(COALESCE(pc.status, '')) IN ('ganho', 'perdido', 'perda', 'closed') THEN 1 ELSE 0 END,
      pc.description NULLS LAST
  ), '[]'::json) INTO v_result
  FROM pipeline_cards pc
  INNER JOIN pipelines p ON p.id = pc.pipeline_id
  LEFT JOIN pipeline_columns col ON col.id = pc.column_id
  WHERE pc.contact_id = p_contact_id
    AND p.workspace_id = p_workspace_id
    AND (pc.is_lab_test IS NOT TRUE);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_contact_deals IS 'RPC otimizada para buscar deals/oportunidades de um contato específico';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_contact_deals TO authenticated;
GRANT SELECT ON public.contact_deals_view TO authenticated;

-- Criar índice para otimizar a busca por contact_id
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_contact_id ON pipeline_cards(contact_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_contact_pipeline ON pipeline_cards(contact_id, pipeline_id);
