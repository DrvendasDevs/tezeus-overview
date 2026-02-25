-- ============================================================================
-- Migration: Criar RPC para carregar dados do Laboratório (bypass RLS)
-- Descrição: Função que retorna workspaces, agentes e conexões para o Lab
-- ============================================================================

-- Função para carregar dados do laboratório (bypass RLS com SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_lab_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'workspaces', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', w.id,
        'name', w.name
      ) ORDER BY w.name), '[]'::json)
      FROM workspaces w
    ),
    'agents', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', a.id,
        'name', a.name,
        'workspace_id', a.workspace_id,
        'workspace_name', w.name
      ) ORDER BY a.name), '[]'::json)
      FROM ai_agents a
      LEFT JOIN workspaces w ON w.id = a.workspace_id
      WHERE a.is_active = true
    ),
    'connections', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', c.id,
        'instance_name', c.instance_name,
        'phone_number', c.phone_number,
        'status', c.status,
        'workspace_id', c.workspace_id,
        'workspace_name', w.name,
        'metadata', c.metadata,
        'default_pipeline_id', c.default_pipeline_id,
        'default_column_id', c.default_column_id,
        'queue_id', c.queue_id
      ) ORDER BY c.instance_name), '[]'::json)
      FROM connections c
      LEFT JOIN workspaces w ON w.id = c.workspace_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Dar permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION get_lab_data() TO authenticated;

-- Comentário para documentação
COMMENT ON FUNCTION get_lab_data() IS 'Retorna dados necessários para o Laboratório de IA (workspaces, agentes ativos e conexões). Usa SECURITY DEFINER para bypass de RLS.';
