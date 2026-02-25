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

-- Create the new is_workspace_member function with system_profile (without dropping the old one yet)
CREATE OR REPLACE FUNCTION public.is_workspace_member_new(p_workspace_id uuid, p_min_role system_profile DEFAULT 'user'::system_profile)
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

-- Update all RLS policies to use the new function
-- Conversations policies
DROP POLICY IF EXISTS conversations_insert ON public.conversations;
CREATE POLICY conversations_insert 
ON public.conversations 
FOR INSERT 
WITH CHECK (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS conversations_update ON public.conversations;
CREATE POLICY conversations_update 
ON public.conversations 
FOR UPDATE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS conversations_delete ON public.conversations;
CREATE POLICY conversations_delete 
ON public.conversations 
FOR DELETE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

-- Messages policies
DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert 
ON public.messages 
FOR INSERT 
WITH CHECK (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update 
ON public.messages 
FOR UPDATE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete 
ON public.messages 
FOR DELETE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

-- Contacts policies
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select 
ON public.contacts 
FOR SELECT 
USING (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert 
ON public.contacts 
FOR INSERT 
WITH CHECK (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update 
ON public.contacts 
FOR UPDATE 
USING (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete 
ON public.contacts 
FOR DELETE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

-- Tags policies
DROP POLICY IF EXISTS tags_select ON public.tags;
CREATE POLICY tags_select 
ON public.tags 
FOR SELECT 
USING (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS tags_insert ON public.tags;
CREATE POLICY tags_insert 
ON public.tags 
FOR INSERT 
WITH CHECK (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS tags_update ON public.tags;
CREATE POLICY tags_update 
ON public.tags 
FOR UPDATE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS tags_delete ON public.tags;
CREATE POLICY tags_delete 
ON public.tags 
FOR DELETE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

-- Evolution instance tokens policies
DROP POLICY IF EXISTS evolution_instance_tokens_select ON public.evolution_instance_tokens;
CREATE POLICY evolution_instance_tokens_select 
ON public.evolution_instance_tokens 
FOR SELECT 
USING (is_workspace_member_new(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS evolution_instance_tokens_insert ON public.evolution_instance_tokens;
CREATE POLICY evolution_instance_tokens_insert 
ON public.evolution_instance_tokens 
FOR INSERT 
WITH CHECK (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS evolution_instance_tokens_update ON public.evolution_instance_tokens;
CREATE POLICY evolution_instance_tokens_update 
ON public.evolution_instance_tokens 
FOR UPDATE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS evolution_instance_tokens_delete ON public.evolution_instance_tokens;
CREATE POLICY evolution_instance_tokens_delete 
ON public.evolution_instance_tokens 
FOR DELETE 
USING (is_workspace_member_new(workspace_id, 'admin'::system_profile));

-- Provider logs policies
DROP POLICY IF EXISTS provider_logs_select ON public.provider_logs;
CREATE POLICY provider_logs_select 
ON public.provider_logs 
FOR SELECT 
USING ((connection_id IS NULL) OR (EXISTS ( SELECT 1
   FROM connections c
  WHERE ((c.id = provider_logs.connection_id) AND is_workspace_member_new(c.workspace_id, 'user'::system_profile)))));

-- Now drop the old function and rename the new one
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, workspace_role) CASCADE;

-- Rename the new function to the correct name
ALTER FUNCTION public.is_workspace_member_new(uuid, system_profile) RENAME TO is_workspace_member;