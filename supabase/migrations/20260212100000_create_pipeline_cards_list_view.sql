-- =============================================
-- Migração: Criar VIEW otimizada para listagem de cards do pipeline
-- =============================================
-- Objetivo: Melhorar a performance do carregamento de cards nas colunas do pipeline
-- através de uma VIEW que pré-faz os JOINs necessários.

-- 1. VIEW para listagem de cards do pipeline (versão lite para listagem)
CREATE OR REPLACE VIEW public.pipeline_cards_list_view AS
SELECT 
  -- Dados do card
  pc.id,
  pc.pipeline_id,
  pc.column_id,
  pc.contact_id,
  pc.conversation_id,
  pc.responsible_user_id,
  pc.description,
  pc.value,
  pc.status,
  pc.tags,
  pc.qualification,
  pc.is_lab_test,
  pc.created_at,
  pc.updated_at,
  
  -- Dados do pipeline (workspace_id para filtros)
  p.workspace_id,
  
  -- Dados do contato (essenciais para exibição)
  ct.name AS contact_name,
  ct.phone AS contact_phone,
  ct.email AS contact_email,
  ct.profile_image_url AS contact_profile_image_url,
  
  -- Dados da conversa (essenciais para badges e status)
  cv.unread_count AS conversation_unread_count,
  cv.assigned_user_id AS conversation_assigned_user_id,
  cv.agente_ativo AS conversation_agente_ativo,
  cv.agent_active_id AS conversation_agent_active_id,
  
  -- Dados do responsável (essenciais para exibição)
  su.name AS responsible_user_name,
  su.avatar AS responsible_user_avatar

FROM public.pipeline_cards pc
INNER JOIN public.pipelines p ON p.id = pc.pipeline_id
LEFT JOIN public.contacts ct ON ct.id = pc.contact_id
LEFT JOIN public.conversations cv ON cv.id = pc.conversation_id
LEFT JOIN public.system_users su ON su.id = pc.responsible_user_id;

COMMENT ON VIEW public.pipeline_cards_list_view IS 'View otimizada para listagem de cards do pipeline com JOINs pré-calculados';

-- 2. Índices compostos para otimizar as queries mais comuns
-- Índice composto para busca por pipeline_id + column_id (mais comum)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_pipeline_column 
ON public.pipeline_cards(pipeline_id, column_id);

-- Índice composto para busca por pipeline_id + column_id + created_at (com ordenação)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_pipeline_column_created 
ON public.pipeline_cards(pipeline_id, column_id, created_at DESC);

-- Índice para filtro de is_lab_test (usado para excluir cards de teste)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_is_lab_test 
ON public.pipeline_cards(is_lab_test) 
WHERE is_lab_test IS NOT TRUE;

-- Índice parcial para cards abertos (status mais comum para listagem)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_status_aberto 
ON public.pipeline_cards(pipeline_id, column_id, created_at DESC) 
WHERE status = 'aberto';

-- 3. Conceder permissões
GRANT SELECT ON public.pipeline_cards_list_view TO authenticated;
GRANT SELECT ON public.pipeline_cards_list_view TO service_role;

-- 4. Criar função RPC para buscar cards de forma otimizada (bypass RLS para service_role)
CREATE OR REPLACE FUNCTION public.get_pipeline_cards_lite(
  p_pipeline_id UUID,
  p_column_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_exclude_lab_test BOOLEAN DEFAULT TRUE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(cards)), '[]'::json) INTO v_result
  FROM (
    SELECT 
      id,
      pipeline_id,
      column_id,
      contact_id,
      conversation_id,
      responsible_user_id,
      description,
      value,
      status,
      tags,
      qualification,
      is_lab_test,
      created_at,
      updated_at,
      workspace_id,
      contact_name,
      contact_phone,
      contact_email,
      contact_profile_image_url,
      conversation_unread_count,
      conversation_assigned_user_id,
      conversation_agente_ativo,
      conversation_agent_active_id,
      responsible_user_name,
      responsible_user_avatar
    FROM pipeline_cards_list_view
    WHERE pipeline_id = p_pipeline_id
      AND (p_column_id IS NULL OR column_id = p_column_id)
      AND (NOT p_exclude_lab_test OR is_lab_test IS NOT TRUE)
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) cards;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_pipeline_cards_lite IS 'RPC otimizada para buscar cards do pipeline com dados pré-joinados';

-- 5. Conceder permissões para a função
GRANT EXECUTE ON FUNCTION public.get_pipeline_cards_lite TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_cards_lite TO service_role;

-- 6. Criar função para contar cards por coluna (útil para paginação)
CREATE OR REPLACE FUNCTION public.get_pipeline_cards_count(
  p_pipeline_id UUID,
  p_column_id UUID DEFAULT NULL,
  p_exclude_lab_test BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pipeline_cards
  WHERE pipeline_id = p_pipeline_id
    AND (p_column_id IS NULL OR column_id = p_column_id)
    AND (NOT p_exclude_lab_test OR is_lab_test IS NOT TRUE);

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_pipeline_cards_count IS 'RPC para contar cards do pipeline de forma otimizada';

GRANT EXECUTE ON FUNCTION public.get_pipeline_cards_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_cards_count TO service_role;
