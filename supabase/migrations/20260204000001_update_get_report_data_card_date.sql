-- Alinha o filtro de período do RPC `get_report_data` com o conceito de "data do card" usado nos rankings:
-- usa COALESCE(updated_at, created_at) e também retorna updated_at no JSON.

CREATE OR REPLACE FUNCTION public.get_report_data(
  p_workspace_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_is_user_scoped BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cards JSON;
  v_contacts JSON;
  v_activities JSON;
  v_conversations JSON;
  v_pipeline_ids UUID[];
BEGIN
  -- Buscar IDs dos pipelines do workspace
  SELECT ARRAY_AGG(id) INTO v_pipeline_ids
  FROM pipelines
  WHERE workspace_id = p_workspace_id;
  
  -- Se não houver pipelines, retornar vazio
  IF v_pipeline_ids IS NULL OR array_length(v_pipeline_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'cards', '[]'::json,
      'contacts', '[]'::json,
      'activities', '[]'::json,
      'conversations', '[]'::json
    );
  END IF;

  -- Cards (filtra por "data operacional": updated_at com fallback para created_at)
  SELECT COALESCE(json_agg(json_build_object(
    'id', pc.id,
    'pipeline_id', pc.pipeline_id,
    'column_id', pc.column_id,
    'contact_id', pc.contact_id,
    'responsible_user_id', pc.responsible_user_id,
    'status', pc.status,
    'qualification', pc.qualification,
    'value', pc.value,
    'created_at', pc.created_at,
    'updated_at', pc.updated_at
  )), '[]'::json) INTO v_cards
  FROM pipeline_cards pc
  WHERE pc.pipeline_id = ANY(v_pipeline_ids)
    AND (pc.is_lab_test IS NOT TRUE)
    AND (p_from IS NULL OR COALESCE(pc.updated_at, pc.created_at) >= p_from)
    AND (p_to IS NULL OR COALESCE(pc.updated_at, pc.created_at) <= p_to);

  -- Contacts
  SELECT COALESCE(json_agg(json_build_object(
    'id', c.id,
    'created_at', c.created_at
  )), '[]'::json) INTO v_contacts
  FROM contacts c
  WHERE c.workspace_id = p_workspace_id
    AND (c.is_lab_test IS NOT TRUE)
    AND (p_from IS NULL OR c.created_at >= p_from)
    AND (p_to IS NULL OR c.created_at <= p_to);

  -- Activities
  SELECT COALESCE(json_agg(json_build_object(
    'id', a.id,
    'contact_id', a.contact_id,
    'responsible_id', a.responsible_id,
    'type', a.type,
    'created_at', a.created_at,
    'scheduled_for', a.scheduled_for,
    'completed_at', a.completed_at
  )), '[]'::json) INTO v_activities
  FROM activities a
  WHERE a.workspace_id = p_workspace_id
    AND (
      (p_from IS NULL AND p_to IS NULL)
      OR (a.scheduled_for >= p_from AND a.scheduled_for <= p_to)
      OR (a.completed_at >= p_from AND a.completed_at <= p_to)
      OR (a.created_at >= p_from AND a.created_at <= p_to)
    )
    AND (NOT p_is_user_scoped OR a.responsible_id = p_user_id);

  -- Conversations
  SELECT COALESCE(json_agg(json_build_object(
    'id', cv.id,
    'contact_id', cv.contact_id,
    'assigned_user_id', cv.assigned_user_id,
    'created_at', cv.created_at
  )), '[]'::json) INTO v_conversations
  FROM conversations cv
  WHERE cv.workspace_id = p_workspace_id
    AND (cv.is_lab_test IS NOT TRUE)
    AND (p_from IS NULL OR cv.created_at >= p_from)
    AND (p_to IS NULL OR cv.created_at <= p_to)
    AND (NOT p_is_user_scoped OR cv.assigned_user_id = p_user_id);

  RETURN json_build_object(
    'cards', v_cards,
    'contacts', v_contacts,
    'activities', v_activities,
    'conversations', v_conversations
  );
END;
$$;

COMMENT ON FUNCTION public.get_report_data IS 'RPC otimizada para buscar todos os dados do relatório em uma única chamada (card_date = COALESCE(updated_at, created_at))';

GRANT EXECUTE ON FUNCTION public.get_report_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_data TO anon;

