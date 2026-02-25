-- Atualiza função get_automation_details para considerar card_history quando faltarem triggers
CREATE OR REPLACE FUNCTION public.get_automation_details(p_automation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automation jsonb;
  v_triggers jsonb;
  v_actions jsonb;
BEGIN
  SELECT row_to_json(ca.*)::jsonb
    INTO v_automation
  FROM crm_column_automations ca
  WHERE ca.id = p_automation_id;

  IF v_automation IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(row_to_json(trigger_row))
    INTO v_triggers
  FROM (
    SELECT *
    FROM crm_column_automation_triggers
    WHERE automation_id = p_automation_id
  ) AS trigger_row;

  SELECT jsonb_agg(row_to_json(action_row))
    INTO v_actions
  FROM (
    SELECT *
    FROM crm_column_automation_actions
    WHERE automation_id = p_automation_id
    ORDER BY action_order
  ) AS action_row;

  v_automation := v_automation || jsonb_build_object(
    'triggers', COALESCE(v_triggers, '[]'::jsonb),
    'actions',  COALESCE(v_actions, '[]'::jsonb)
  );

  RETURN v_automation;
END;
$$;

