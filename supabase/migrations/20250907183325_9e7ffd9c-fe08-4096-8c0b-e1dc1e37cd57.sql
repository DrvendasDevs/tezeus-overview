-- Fix current_system_user_id function to use JWT metadata properly
CREATE OR REPLACE FUNCTION public.current_system_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_id uuid;
  user_email text;
BEGIN
  -- Try to get system_user_id from JWT first
  user_id := (auth.jwt() ->> 'system_user_id')::uuid;
  IF user_id IS NOT NULL THEN
    RETURN user_id;
  END IF;
  
  -- Fall back to system_email, then email
  user_email := COALESCE(
    auth.jwt() ->> 'system_email',
    auth.jwt() ->> 'email'
  );
  
  IF user_email IS NOT NULL THEN
    SELECT su.id INTO user_id
    FROM public.system_users su
    WHERE su.email = user_email
    LIMIT 1;
  END IF;
  
  RETURN user_id;
END;
$$;

-- Update is_current_user_master to use proper user identification
CREATE OR REPLACE FUNCTION public.is_current_user_master()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cur_user uuid;
BEGIN
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.id = cur_user 
    AND su.profile = 'master'
  );
END;
$$;

-- Update is_current_user_admin to use proper user identification
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cur_user uuid;
BEGIN
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.id = cur_user 
    AND su.profile IN ('admin', 'master')
  );
END;
$$;

-- Remove the old is_workspace_member function that uses workspace_role enum
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, workspace_role);

-- Update the is_workspace_member function to use system_profile enum properly
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role system_profile DEFAULT 'user'::system_profile)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cur_user uuid;
  cur_role public.system_profile;
BEGIN
  -- Get current user ID
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Master global access (via system_users profile)
  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check user role in workspace
  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy: master > admin > user
  IF p_min_role = 'user' THEN
    RETURN TRUE; -- any listed role works
  ELSIF p_min_role = 'admin' THEN
    RETURN cur_role IN ('admin','master');
  ELSIF p_min_role = 'master' THEN
    RETURN cur_role = 'master';
  END IF;

  RETURN FALSE;
END;
$$;