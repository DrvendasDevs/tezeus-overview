-- Corrigir função get_column_automations para incluir campo description
CREATE OR REPLACE FUNCTION public.get_column_automations(p_column_id uuid)
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

