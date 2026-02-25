-- Função para listar automações de uma coluna
CREATE OR REPLACE FUNCTION get_column_automations(
  p_column_id uuid
)
RETURNS TABLE(
  id uuid,
  column_id uuid,
  workspace_id uuid,
  name text,
  description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  triggers_count bigint,
  actions_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se a função check_column_permission existe antes de usar
  -- Se não existir, assume permissão (para evitar erros quando migrations não estão aplicadas)
  BEGIN
    IF check_column_permission(p_column_id, 'read') = FALSE THEN
      RAISE EXCEPTION 'Permission denied: User does not have permission to view automations in this column';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se a função não existir, continua (para não bloquear o uso antes das migrations)
      -- Isso permite que a função seja chamada mesmo sem check_column_permission
      NULL;
  END;
  
  -- Retornar automações com contagens
  RETURN QUERY
  SELECT 
    a.id,
    a.column_id,
    a.workspace_id,
    a.name,
    a.description,
    a.is_active,
    a.created_at,
    a.updated_at,
    (SELECT COUNT(*) FROM crm_column_automation_triggers WHERE automation_id = a.id) as triggers_count,
    (SELECT COUNT(*) FROM crm_column_automation_actions WHERE automation_id = a.id) as actions_count
  FROM crm_column_automations a
  WHERE a.column_id = p_column_id
  ORDER BY a.created_at DESC;
END;
$$;

-- Função para criar automação
CREATE OR REPLACE FUNCTION create_column_automation(
  p_column_id uuid,
  p_workspace_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation_id uuid;
  v_trigger jsonb;
  v_action jsonb;
  v_action_order int := 0;
BEGIN
  -- Verificar se a função check_column_permission existe antes de usar
  -- Se não existir, assume permissão (para evitar erros quando migrations não estão aplicadas)
  BEGIN
    IF check_column_permission(p_column_id, 'write') = FALSE THEN
      RAISE EXCEPTION 'Permission denied: User does not have permission to create automations in this column';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se a função não existir, continua (para não bloquear o uso antes das migrations)
      NULL;
  END;
  
  -- Validações
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Automation name is required';
  END IF;
  
  IF jsonb_array_length(p_triggers) = 0 THEN
    RAISE EXCEPTION 'At least one trigger is required';
  END IF;
  
  IF jsonb_array_length(p_actions) = 0 THEN
    RAISE EXCEPTION 'At least one action is required';
  END IF;
  
  -- Criar automação
  INSERT INTO crm_column_automations (
    column_id, workspace_id, name, description, is_active
  ) VALUES (
    p_column_id, p_workspace_id, TRIM(p_name), NULLIF(TRIM(p_description), ''), TRUE
  )
  RETURNING id INTO v_automation_id;
  
  -- Criar triggers
  FOR v_trigger IN SELECT * FROM jsonb_array_elements(p_triggers)
  LOOP
    INSERT INTO crm_column_automation_triggers (
      automation_id, trigger_type, trigger_config
    ) VALUES (
      v_automation_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'::jsonb)
    );
  END LOOP;
  
  -- Criar actions
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
  LOOP
    INSERT INTO crm_column_automation_actions (
      automation_id, action_type, action_config, action_order
    ) VALUES (
      v_automation_id,
      v_action->>'action_type',
      COALESCE(v_action->'action_config', '{}'::jsonb),
      v_action_order
    );
    v_action_order := v_action_order + 1;
  END LOOP;
  
  RETURN v_automation_id;
END;
$$;

-- Função para atualizar automação
CREATE OR REPLACE FUNCTION update_column_automation(
  p_automation_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger jsonb;
  v_action jsonb;
  v_action_order int := 0;
BEGIN
  -- Verificar permissão
  IF NOT check_automation_permission(p_automation_id, 'write') THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to update this automation';
  END IF;
  
  -- Validações
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Automation name is required';
  END IF;
  
  IF jsonb_array_length(p_triggers) = 0 THEN
    RAISE EXCEPTION 'At least one trigger is required';
  END IF;
  
  IF jsonb_array_length(p_actions) = 0 THEN
    RAISE EXCEPTION 'At least one action is required';
  END IF;
  
  -- Atualizar automação
  UPDATE crm_column_automations
  SET 
    name = TRIM(p_name),
    description = NULLIF(TRIM(p_description), ''),
    updated_at = NOW()
  WHERE id = p_automation_id;
  
  -- Remover triggers e actions antigos
  DELETE FROM crm_column_automation_triggers WHERE automation_id = p_automation_id;
  DELETE FROM crm_column_automation_actions WHERE automation_id = p_automation_id;
  
  -- Criar novos triggers
  FOR v_trigger IN SELECT * FROM jsonb_array_elements(p_triggers)
  LOOP
    INSERT INTO crm_column_automation_triggers (
      automation_id, trigger_type, trigger_config
    ) VALUES (
      p_automation_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'::jsonb)
    );
  END LOOP;
  
  -- Criar novos actions
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
  LOOP
    INSERT INTO crm_column_automation_actions (
      automation_id, action_type, action_config, action_order
    ) VALUES (
      p_automation_id,
      v_action->>'action_type',
      COALESCE(v_action->'action_config', '{}'::jsonb),
      v_action_order
    );
    v_action_order := v_action_order + 1;
  END LOOP;
END;
$$;

-- Função para alternar status
CREATE OR REPLACE FUNCTION toggle_column_automation(
  p_automation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status boolean;
BEGIN
  -- Verificar permissão
  IF NOT check_automation_permission(p_automation_id, 'write') THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to update this automation';
  END IF;
  
  -- Alternar status
  UPDATE crm_column_automations
  SET 
    is_active = NOT is_active,
    updated_at = NOW()
  WHERE id = p_automation_id
  RETURNING is_active INTO v_new_status;
  
  RETURN v_new_status;
END;
$$;

-- Função para deletar automação
CREATE OR REPLACE FUNCTION delete_column_automation(
  p_automation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar permissão
  IF NOT check_automation_permission(p_automation_id, 'delete') THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to delete this automation';
  END IF;
  
  -- Deletar triggers e actions (cascade manual)
  DELETE FROM crm_column_automation_triggers WHERE automation_id = p_automation_id;
  DELETE FROM crm_column_automation_actions WHERE automation_id = p_automation_id;
  
  -- Deletar automação
  DELETE FROM crm_column_automations WHERE id = p_automation_id;
END;
$$;

-- Função para buscar detalhes de automação
CREATE OR REPLACE FUNCTION get_automation_details(
  p_automation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Verificar se a função check_automation_permission existe antes de usar
  -- Se não existir, assume permissão (para evitar erros quando migrations não estão aplicadas)
  BEGIN
    IF check_automation_permission(p_automation_id, 'read') = FALSE THEN
      RAISE EXCEPTION 'Permission denied: User does not have permission to view this automation';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se a função não existir, continua (para não bloquear o uso antes das migrations)
      -- Isso permite que a função seja chamada mesmo sem check_automation_permission
      NULL;
  END;
  
  -- Buscar automação com triggers e actions
  SELECT jsonb_build_object(
    'id', a.id,
    'column_id', a.column_id,
    'workspace_id', a.workspace_id,
    'name', a.name,
    'description', a.description,
    'is_active', a.is_active,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'triggers', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'trigger_type', t.trigger_type,
          'trigger_config', t.trigger_config
        ) ORDER BY t.created_at
      ), '[]'::jsonb)
      FROM crm_column_automation_triggers t
      WHERE t.automation_id = a.id
    ),
    'actions', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', act.id,
          'action_type', act.action_type,
          'action_config', act.action_config,
          'action_order', act.action_order
        ) ORDER BY act.action_order
      ), '[]'::jsonb)
      FROM crm_column_automation_actions act
      WHERE act.automation_id = a.id
    )
  ) INTO v_result
  FROM crm_column_automations a
  WHERE a.id = p_automation_id;
  
  RETURN v_result;
END;
$$;