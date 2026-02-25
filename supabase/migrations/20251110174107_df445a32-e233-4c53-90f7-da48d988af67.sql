-- Drop e recriar função get_column_automations com assinatura correta
DROP FUNCTION IF EXISTS public.get_column_automations(uuid);

CREATE FUNCTION public.get_column_automations(p_column_id uuid)
RETURNS TABLE (
  id uuid,
  column_id uuid,
  name text,
  description text,
  is_active boolean,
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
    ca.created_at,
    ca.updated_at
  FROM public.crm_column_automations ca
  WHERE ca.column_id = p_column_id
  ORDER BY ca.created_at ASC;
END;
$$;

-- Criar função get_automation_details
CREATE OR REPLACE FUNCTION public.get_automation_details(p_automation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'triggers', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'trigger_type', t.trigger_type,
          'trigger_config', t.trigger_config
        ) ORDER BY t.created_at
      )
      FROM public.crm_column_automation_triggers t
      WHERE t.automation_id = p_automation_id), '[]'::jsonb
    ),
    'actions', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'action_type', a.action_type,
          'action_order', a.action_order,
          'action_config', a.action_config
        ) ORDER BY a.action_order
      )
      FROM public.crm_column_automation_actions a
      WHERE a.automation_id = p_automation_id), '[]'::jsonb
    )
  ) INTO result;
  
  RETURN result;
END;
$$;