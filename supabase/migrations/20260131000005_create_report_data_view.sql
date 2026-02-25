-- =============================================
-- Migração: Criar VIEWs e RPC otimizadas para Relatórios
-- =============================================
-- Objetivo: Melhorar a performance e estabilidade do carregamento dos dados de relatórios
-- através de VIEWs e uma RPC SECURITY DEFINER que consolida múltiplas queries.

-- 1. VIEW para cards de pipeline com dados essenciais
CREATE OR REPLACE VIEW public.report_pipeline_cards_view AS
SELECT 
  pc.id,
  pc.pipeline_id,
  pc.column_id,
  pc.contact_id,
  pc.responsible_user_id,
  pc.status,
  pc.qualification,
  pc.value,
  pc.created_at,
  pc.updated_at,
  pc.closed_at,
  pc.won_at,
  p.workspace_id
FROM public.pipeline_cards pc
INNER JOIN public.pipelines p ON p.id = pc.pipeline_id
WHERE pc.is_lab_test IS NOT TRUE;

COMMENT ON VIEW public.report_pipeline_cards_view IS 'View otimizada para relatórios de cards do pipeline';

-- 2. VIEW para atividades
CREATE OR REPLACE VIEW public.report_activities_view AS
SELECT 
  a.id,
  a.contact_id,
  a.responsible_id,
  a.type,
  a.created_at,
  a.scheduled_for,
  a.completed_at,
  a.is_completed,
  a.workspace_id
FROM public.activities a;

COMMENT ON VIEW public.report_activities_view IS 'View otimizada para relatórios de atividades';

-- 3. VIEW para conversas
CREATE OR REPLACE VIEW public.report_conversations_view AS
SELECT 
  c.id,
  c.contact_id,
  c.assigned_user_id,
  c.created_at,
  c.workspace_id,
  c.status
FROM public.conversations c
WHERE c.is_lab_test IS NOT TRUE;

COMMENT ON VIEW public.report_conversations_view IS 'View otimizada para relatórios de conversas';

-- 4. VIEW para contatos
CREATE OR REPLACE VIEW public.report_contacts_view AS
SELECT 
  c.id,
  c.created_at,
  c.workspace_id
FROM public.contacts c
WHERE c.is_lab_test IS NOT TRUE;

COMMENT ON VIEW public.report_contacts_view IS 'View otimizada para relatórios de contatos';

-- 5. RPC consolidada para buscar dados do relatório de uma vez
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

  -- Cards
  SELECT COALESCE(json_agg(json_build_object(
    'id', pc.id,
    'pipeline_id', pc.pipeline_id,
    'column_id', pc.column_id,
    'contact_id', pc.contact_id,
    'responsible_user_id', pc.responsible_user_id,
    'status', pc.status,
    'qualification', pc.qualification,
    'value', pc.value,
    'created_at', pc.created_at
  )), '[]'::json) INTO v_cards
  FROM pipeline_cards pc
  WHERE pc.pipeline_id = ANY(v_pipeline_ids)
    AND (pc.is_lab_test IS NOT TRUE)
    AND (p_from IS NULL OR pc.created_at >= p_from)
    AND (p_to IS NULL OR pc.created_at <= p_to);

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

COMMENT ON FUNCTION public.get_report_data IS 'RPC otimizada para buscar todos os dados do relatório em uma única chamada';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.get_report_data TO authenticated;
GRANT SELECT ON public.report_pipeline_cards_view TO authenticated;
GRANT SELECT ON public.report_activities_view TO authenticated;
GRANT SELECT ON public.report_conversations_view TO authenticated;
GRANT SELECT ON public.report_contacts_view TO authenticated;

-- Criar índices para otimizar as queries (se não existirem)
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_created_at ON pipeline_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_pipeline_workspace ON pipeline_cards(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_created ON contacts(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_dates ON activities(workspace_id, scheduled_for, completed_at, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_created ON conversations(workspace_id, created_at);
