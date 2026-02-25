-- Atualizar função update_column_automation para incluir p_ignore_business_hours
CREATE OR REPLACE FUNCTION public.update_column_automation(
  p_automation_id uuid, 
  p_name text, 
  p_description text, 
  p_triggers jsonb, 
  p_actions jsonb, 
  p_user_id uuid DEFAULT NULL::uuid, 
  p_ignore_business_hours boolean DEFAULT NULL::boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_trigger jsonb;
  v_action jsonb;
  v_action_order int := 0;
BEGIN
  -- Verificar permissão com user_id fornecido
  IF NOT check_automation_permission(p_automation_id, 'write', p_user_id) THEN
    RAISE EXCEPTION 'Permission denied: User does not have permission to update this automation';
  END IF;

  -- Atualizar dados principais da automação (incluindo ignore_business_hours)
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
$function$;