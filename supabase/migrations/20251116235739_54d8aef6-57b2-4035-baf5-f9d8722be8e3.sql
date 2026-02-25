-- Modificar função check_automation_permission para aceitar user_id opcional
CREATE OR REPLACE FUNCTION check_automation_permission(
  p_automation_id uuid,
  p_permission text,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_user_id uuid;
BEGIN
  -- Usar user_id fornecido ou buscar do contexto
  v_user_id := COALESCE(
    p_user_id,
    nullif(current_setting('app.current_user_id', true), '')::uuid
  );
  
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar workspace_id da automação
  SELECT workspace_id INTO v_workspace_id
  FROM crm_column_automations
  WHERE id = p_automation_id;
  
  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se usuário é master
  IF EXISTS (
    SELECT 1 FROM system_users
    WHERE id = v_user_id AND profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Verificar se é membro do workspace
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = v_workspace_id 
      AND user_id = v_user_id
  );
END;
$$;

-- Modificar função update_column_automation
CREATE OR REPLACE FUNCTION update_column_automation(
  p_automation_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb,
  p_user_id uuid DEFAULT NULL
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
  -- Verificar permissão com user_id fornecido
  IF NOT check_automation_permission(p_automation_id, 'write', p_user_id) THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to update this automation';
  END IF;

  -- Atualizar dados principais da automação
  UPDATE crm_column_automations
  SET 
    name = p_name,
    description = p_description,
    updated_at = now()
  WHERE id = p_automation_id;

  -- Deletar triggers e actions existentes
  DELETE FROM crm_column_automation_triggers WHERE automation_id = p_automation_id;
  DELETE FROM crm_column_automation_actions WHERE automation_id = p_automation_id;

  -- Inserir novos triggers
  FOR v_trigger IN SELECT * FROM jsonb_array_elements(p_triggers)
  LOOP
    INSERT INTO crm_column_automation_triggers (
      automation_id,
      trigger_type,
      trigger_config
    ) VALUES (
      p_automation_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'::jsonb)
    );
  END LOOP;

  -- Inserir novas actions
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
  LOOP
    INSERT INTO crm_column_automation_actions (
      automation_id,
      action_type,
      action_config,
      action_order
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

-- Modificar função create_column_automation
CREATE OR REPLACE FUNCTION create_column_automation(
  p_column_id uuid,
  p_workspace_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb,
  p_user_id uuid DEFAULT NULL
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
  v_user_id uuid;
BEGIN
  -- Usar user_id fornecido ou buscar do contexto
  v_user_id := COALESCE(
    p_user_id,
    nullif(current_setting('app.current_user_id', true), '')::uuid
  );
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID not provided';
  END IF;

  -- Verificar se usuário tem permissão no workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM system_users
    WHERE id = v_user_id AND profile = 'master'
  ) THEN
    RAISE EXCEPTION 'Permission denied: User does not have access to this workspace';
  END IF;

  -- Criar automação
  INSERT INTO crm_column_automations (
    column_id,
    workspace_id,
    name,
    description,
    is_active
  ) VALUES (
    p_column_id,
    p_workspace_id,
    p_name,
    p_description,
    true
  ) RETURNING id INTO v_automation_id;

  -- Inserir triggers
  FOR v_trigger IN SELECT * FROM jsonb_array_elements(p_triggers)
  LOOP
    INSERT INTO crm_column_automation_triggers (
      automation_id,
      trigger_type,
      trigger_config
    ) VALUES (
      v_automation_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'::jsonb)
    );
  END LOOP;

  -- Inserir actions
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions)
  LOOP
    INSERT INTO crm_column_automation_actions (
      automation_id,
      action_type,
      action_config,
      action_order
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

-- Modificar função toggle_column_automation
CREATE OR REPLACE FUNCTION toggle_column_automation(
  p_automation_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status boolean;
BEGIN
  -- Verificar permissão com user_id fornecido
  IF NOT check_automation_permission(p_automation_id, 'write', p_user_id) THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to toggle this automation';
  END IF;

  -- Toggle is_active e retornar novo status
  UPDATE crm_column_automations
  SET 
    is_active = NOT is_active,
    updated_at = now()
  WHERE id = p_automation_id
  RETURNING is_active INTO v_new_status;

  RETURN v_new_status;
END;
$$;

-- Modificar função delete_column_automation
CREATE OR REPLACE FUNCTION delete_column_automation(
  p_automation_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar permissão com user_id fornecido
  IF NOT check_automation_permission(p_automation_id, 'write', p_user_id) THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to delete this automation';
  END IF;

  -- Deletar triggers e actions (cascade)
  DELETE FROM crm_column_automation_triggers WHERE automation_id = p_automation_id;
  DELETE FROM crm_column_automation_actions WHERE automation_id = p_automation_id;
  
  -- Deletar automação
  DELETE FROM crm_column_automations WHERE id = p_automation_id;
END;
$$;