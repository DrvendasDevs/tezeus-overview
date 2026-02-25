-- Função auxiliar para atualizar apenas ignore_business_hours (bypass RLS com SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_automation_ignore_business_hours(
  p_automation_id uuid,
  p_ignore_business_hours boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crm_column_automations
  SET 
    ignore_business_hours = p_ignore_business_hours,
    updated_at = now()
  WHERE id = p_automation_id;
  
  RETURN FOUND;
END;
$$;

-- Atualizar função get_column_automations para incluir ignore_business_hours
-- Primeiro, dropar a função existente pois o tipo de retorno mudou
DROP FUNCTION IF EXISTS public.get_column_automations(uuid);

CREATE OR REPLACE FUNCTION public.get_column_automations(p_column_id uuid)
RETURNS TABLE (
  id uuid,
  column_id uuid,
  name text,
  description text,
  is_active boolean,
  ignore_business_hours boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.column_id,
    ca.name,
    ca.description,
    ca.is_active,
    ca.ignore_business_hours,
    ca.created_at,
    ca.updated_at
  FROM public.crm_column_automations ca
  WHERE ca.column_id = p_column_id
  ORDER BY ca.created_at ASC;
END;
$$;

-- Atualizar função update_column_automation para incluir ignore_business_hours
CREATE OR REPLACE FUNCTION update_column_automation(
  p_automation_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb,
  p_user_id uuid DEFAULT NULL,
  p_ignore_business_hours boolean DEFAULT NULL
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
    ignore_business_hours = COALESCE(p_ignore_business_hours, ignore_business_hours),
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

-- Atualizar função create_column_automation para incluir ignore_business_hours
CREATE OR REPLACE FUNCTION create_column_automation(
  p_column_id uuid,
  p_workspace_id uuid,
  p_name text,
  p_description text,
  p_triggers jsonb,
  p_actions jsonb,
  p_user_id uuid DEFAULT NULL,
  p_ignore_business_hours boolean DEFAULT false
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
    is_active,
    ignore_business_hours
  ) VALUES (
    p_column_id,
    p_workspace_id,
    p_name,
    p_description,
    true,
    COALESCE(p_ignore_business_hours, false)
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

