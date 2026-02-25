-- =============================================
-- Migração: RPC unificada para carregamento do board do Pipeline
-- =============================================
-- Objetivo: Reduzir N+2 chamadas (1 colunas + N cards por coluna + 1 contagem)
-- para UMA ÚNICA chamada ao banco, usando a VIEW pipeline_cards_list_view
-- já existente para JOINs pré-calculados.
--
-- Retorna: { columns: [...], cards: [...], counts: { col_id: num } }

CREATE OR REPLACE FUNCTION public.get_pipeline_board(
  p_pipeline_id UUID,
  p_cards_per_column INTEGER DEFAULT 11,  -- 10+1 para detecção de hasMore
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
  SELECT json_build_object(
    -- 1) COLUNAS: todas as colunas do pipeline, ordenadas
    'columns', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', c.id,
          'pipeline_id', c.pipeline_id,
          'name', c.name,
          'color', c.color,
          'icon', c.icon,
          'order_position', c.order_position,
          'created_at', c.created_at,
          'permissions', c.permissions,
          'view_all_deals_permissions', c.view_all_deals_permissions,
          'is_offer_stage', c.is_offer_stage
        ) ORDER BY c.order_position ASC
      ), '[]'::json)
      FROM pipeline_columns c
      WHERE c.pipeline_id = p_pipeline_id
    ),

    -- 2) CARDS: primeira página de cada coluna usando a VIEW otimizada
    'cards', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', ranked.id,
          'pipeline_id', ranked.pipeline_id,
          'column_id', ranked.column_id,
          'contact_id', ranked.contact_id,
          'conversation_id', ranked.conversation_id,
          'responsible_user_id', ranked.responsible_user_id,
          'description', ranked.description,
          'value', ranked.value,
          'status', ranked.status,
          'tags', ranked.tags,
          'qualification', ranked.qualification,
          'is_lab_test', ranked.is_lab_test,
          'created_at', ranked.created_at,
          'updated_at', ranked.updated_at,
          'contact_name', ranked.contact_name,
          'contact_phone', ranked.contact_phone,
          'contact_email', ranked.contact_email,
          'contact_profile_image_url', ranked.contact_profile_image_url,
          'conversation_unread_count', ranked.conversation_unread_count,
          'conversation_assigned_user_id', ranked.conversation_assigned_user_id,
          'conversation_agente_ativo', ranked.conversation_agente_ativo,
          'conversation_agent_active_id', ranked.conversation_agent_active_id,
          'responsible_user_name', ranked.responsible_user_name,
          'responsible_user_avatar', ranked.responsible_user_avatar
        )
      ), '[]'::json)
      FROM (
        SELECT
          v.*,
          ROW_NUMBER() OVER (PARTITION BY v.column_id ORDER BY v.created_at DESC) AS rn
        FROM pipeline_cards_list_view v
        WHERE v.pipeline_id = p_pipeline_id
          AND (NOT p_exclude_lab_test OR v.is_lab_test IS NOT TRUE)
      ) ranked
      WHERE ranked.rn <= p_cards_per_column
    ),

    -- 3) CONTAGENS: total de cards por coluna (para indicadores de paginação)
    'counts', (
      SELECT COALESCE(json_object_agg(sub.column_id, sub.cnt), '{}'::json)
      FROM (
        SELECT pc.column_id, COUNT(*) AS cnt
        FROM pipeline_cards pc
        WHERE pc.pipeline_id = p_pipeline_id
          AND (NOT p_exclude_lab_test OR pc.is_lab_test IS NOT TRUE)
        GROUP BY pc.column_id
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_pipeline_board IS 'RPC unificada: retorna colunas + cards paginados + contagens em uma única chamada ao banco';

GRANT EXECUTE ON FUNCTION public.get_pipeline_board TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pipeline_board TO service_role;
