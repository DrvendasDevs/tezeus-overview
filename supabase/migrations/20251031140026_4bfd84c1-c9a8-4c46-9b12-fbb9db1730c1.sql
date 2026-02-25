-- Função para verificar permissão em uma coluna
CREATE OR REPLACE FUNCTION check_column_permission(
  p_column_id uuid,
  p_operation text -- 'read', 'write', 'delete'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Buscar workspace_id da coluna via pipeline
  SELECT p.workspace_id INTO v_workspace_id
  FROM pipeline_columns pc
  JOIN pipelines p ON p.id = pc.pipeline_id
  WHERE pc.id = p_column_id;
  
  -- Masters sempre têm permissão
  IF is_current_user_master() THEN
    RETURN TRUE;
  END IF;
  
  -- Admins do workspace têm permissão
  IF is_workspace_member(v_workspace_id, 'admin'::system_profile) THEN
    RETURN TRUE;
  END IF;
  
  -- Users comuns só têm read
  IF p_operation = 'read' AND is_workspace_member(v_workspace_id, 'user'::system_profile) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- Função para verificar permissão em uma automação (via column_id)
CREATE OR REPLACE FUNCTION check_automation_permission(
  p_automation_id uuid,
  p_operation text -- 'read', 'write', 'delete'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column_id uuid;
BEGIN
  -- Buscar column_id da automação
  SELECT column_id INTO v_column_id
  FROM crm_column_automations
  WHERE id = p_automation_id;
  
  -- Delegar verificação para check_column_permission
  RETURN check_column_permission(v_column_id, p_operation);
END;
$$;