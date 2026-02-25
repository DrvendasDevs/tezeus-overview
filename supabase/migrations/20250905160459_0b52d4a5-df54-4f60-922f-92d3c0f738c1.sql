-- Create RPC functions to handle connection operations bypassing RLS

-- Function to create a new connection
CREATE OR REPLACE FUNCTION public.create_connection_anon(
  p_instance_name TEXT,
  p_history_recovery TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  connection_id UUID;
  fixed_workspace_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  INSERT INTO public.connections (
    instance_name,
    history_recovery,
    workspace_id,
    status,
    metadata
  ) VALUES (
    p_instance_name,
    p_history_recovery,
    fixed_workspace_id,
    'creating',
    p_metadata
  )
  RETURNING id INTO connection_id;
  
  RETURN connection_id;
END;
$$;

-- Function to update connection status
CREATE OR REPLACE FUNCTION public.update_connection_status_anon(
  p_connection_id UUID,
  p_status TEXT,
  p_qr_code TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.connections 
  SET 
    status = p_status,
    qr_code = COALESCE(p_qr_code, qr_code),
    phone_number = COALESCE(p_phone_number, phone_number),
    metadata = COALESCE(p_metadata, metadata),
    updated_at = NOW(),
    last_activity_at = NOW()
  WHERE id = p_connection_id;
END;
$$;

-- Function to delete a connection
CREATE OR REPLACE FUNCTION public.delete_connection_anon(
  p_connection_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.connections WHERE id = p_connection_id;
END;
$$;

-- Function to list connections
CREATE OR REPLACE FUNCTION public.list_connections_anon()
RETURNS TABLE (
  id UUID,
  instance_name TEXT,
  status TEXT,
  qr_code TEXT,
  phone_number TEXT,
  history_recovery TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  workspace_id UUID,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  fixed_workspace_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.instance_name,
    c.status,
    c.qr_code,
    c.phone_number,
    c.history_recovery,
    c.created_at,
    c.last_activity_at,
    c.workspace_id,
    c.metadata
  FROM public.connections c
  WHERE c.workspace_id = fixed_workspace_id
  ORDER BY c.created_at DESC;
END;
$$;