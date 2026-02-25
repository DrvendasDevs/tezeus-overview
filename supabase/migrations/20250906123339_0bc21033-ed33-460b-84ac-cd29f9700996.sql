-- Phase 1: Database Migration - Rename org to workspace (Drop with CASCADE)

-- Step 1: Drop all policies on org_members table first
DROP POLICY IF EXISTS "org_members_select" ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert" ON public.org_members;
DROP POLICY IF EXISTS "org_members_update" ON public.org_members;
DROP POLICY IF EXISTS "org_members_delete" ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert_admin_can_create_user" ON public.org_members;

-- Step 2: Now drop the function and type
DROP FUNCTION IF EXISTS public.is_member(uuid, org_role) CASCADE;
DROP TYPE IF EXISTS public.org_role CASCADE;

-- Step 3: Rename orgs table to workspaces
ALTER TABLE public.orgs RENAME TO workspaces;

-- Step 4: Create workspace_members table (workspace_role enum already exists)
CREATE TABLE public.workspace_members_final (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'colaborador',
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Step 5: Migrate data from org_members to workspace_members_final
INSERT INTO public.workspace_members_final (workspace_id, user_id, role, created_at)
SELECT 
  org_id as workspace_id,
  user_id,
  CASE 
    WHEN role = 'USER' THEN 'colaborador'::workspace_role
    WHEN role = 'ADMIN' THEN 'gestor'::workspace_role
    WHEN role = 'OWNER' THEN 'mentor_master'::workspace_role
  END as role,
  created_at
FROM public.org_members;

-- Step 6: Drop old org_members table and rename new one
DROP TABLE public.org_members CASCADE;
ALTER TABLE public.workspace_members_final RENAME TO workspace_members;

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

  -- Master global (via perfil)
  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Papel do usuário no workspace
  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Hierarquia: mentor_master > gestor > colaborador
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

-- Step 10: Update workspaces_view
DROP VIEW IF EXISTS public.workspaces_view;
CREATE VIEW public.workspaces_view AS
SELECT 
  w.id as workspace_id,
  w.name,
  w.cnpj,
  w.slug,
  w.created_at,
  w.updated_at,
  COALESCE(c.connections_count, 0) as connections_count
FROM public.workspaces w
LEFT JOIN (
  SELECT 
    workspace_id, 
    COUNT(*) as connections_count
  FROM public.connections 
  GROUP BY workspace_id
) c ON w.id = c.workspace_id
ORDER BY w.created_at DESC;

-- Step 11: Create workspace-scoped connection functions
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

-- Step 12: Enable RLS and create policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE USING (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_insert" ON public.workspaces
FOR INSERT WITH CHECK (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (public.is_workspace_member(id, 'colaborador'::workspace_role));

CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (public.is_workspace_member(id, 'gestor'::workspace_role));

-- Step 13: Enable RLS and create policies for workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

-- Step 14: Enable RLS and create policies for workspace_messaging_settings
ALTER TABLE public.workspace_messaging_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_messaging_settings_delete" ON public.workspace_messaging_settings
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_insert" ON public.workspace_messaging_settings
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_select" ON public.workspace_messaging_settings
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_messaging_settings_update" ON public.workspace_messaging_settings
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));