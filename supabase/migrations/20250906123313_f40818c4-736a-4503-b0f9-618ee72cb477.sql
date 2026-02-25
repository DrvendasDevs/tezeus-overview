-- Phase 1: Database Migration - Remove dependencies first

-- Step 1: Drop policies that depend on org functions/types
DROP POLICY IF EXISTS "orgs_select" ON public.orgs;
DROP POLICY IF EXISTS "orgs_update" ON public.orgs;
DROP POLICY IF EXISTS "orgs_insert" ON public.orgs;
DROP POLICY IF EXISTS "orgs_delete" ON public.orgs;

-- Step 2: Drop the is_member function
DROP FUNCTION IF EXISTS public.is_member(uuid, org_role);

-- Step 3: Drop org_role type
DROP TYPE IF EXISTS public.org_role;

-- Step 4: Drop org_members table
DROP TABLE IF EXISTS public.org_members;

-- Step 5: Rename orgs table to workspaces
ALTER TABLE public.orgs RENAME TO workspaces;

-- Step 6: Create workspace_members table
CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'colaborador',
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Step 7: Create is_workspace_member function
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role workspace_role DEFAULT 'colaborador'::workspace_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cur_user uuid;
  cur_role public.workspace_role;
BEGIN
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF p_min_role = 'colaborador' THEN
    RETURN TRUE;
  ELSIF p_min_role = 'gestor' THEN
    RETURN cur_role IN ('gestor','mentor_master');
  ELSIF p_min_role = 'mentor_master' THEN
    RETURN cur_role = 'mentor_master';
  END IF;

  RETURN FALSE;
END;
$$;

-- Step 8: Rename org_messaging_settings to workspace_messaging_settings
ALTER TABLE public.org_messaging_settings RENAME TO workspace_messaging_settings;
ALTER TABLE public.workspace_messaging_settings RENAME COLUMN org_id TO workspace_id;

-- Step 9: Update activities table
ALTER TABLE public.activities RENAME COLUMN org_id TO workspace_id;

-- Step 10: Create workspace-scoped connection functions
CREATE OR REPLACE FUNCTION public.create_connection(p_instance_name text, p_history_recovery text, p_workspace_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  connection_id UUID;
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
    p_workspace_id,
    'creating',
    p_metadata
  )
  RETURNING id INTO connection_id;
  
  RETURN connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_connections(p_workspace_id uuid)
RETURNS TABLE(id uuid, instance_name text, status text, qr_code text, phone_number text, history_recovery text, created_at timestamp with time zone, last_activity_at timestamp with time zone, workspace_id uuid, metadata jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
  WHERE c.workspace_id = p_workspace_id
  ORDER BY c.created_at DESC;
END;
$$;

-- Step 11: Enable RLS and create policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE USING (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_insert" ON public.workspaces
FOR INSERT WITH CHECK (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (public.is_workspace_member(id, 'colaborador'::workspace_role));

CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (public.is_workspace_member(id, 'gestor'::workspace_role));

-- Step 12: Enable RLS and create policies for workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

-- Step 13: Enable RLS and create policies for workspace_messaging_settings
ALTER TABLE public.workspace_messaging_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_messaging_settings_delete" ON public.workspace_messaging_settings
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_insert" ON public.workspace_messaging_settings
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_select" ON public.workspace_messaging_settings
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_messaging_settings_update" ON public.workspace_messaging_settings
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));