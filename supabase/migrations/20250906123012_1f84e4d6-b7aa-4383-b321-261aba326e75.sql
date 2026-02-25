-- Phase 1: Database Migration - Rename org to workspace

-- Step 1: Rename orgs table to workspaces
ALTER TABLE public.orgs RENAME TO workspaces;

-- Step 2: Create new workspace_role enum
CREATE TYPE public.workspace_role AS ENUM ('colaborador', 'gestor', 'mentor_master');

-- Step 3: Create new workspace_members table
CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role workspace_role NOT NULL DEFAULT 'colaborador',
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Step 4: Migrate data from org_members to workspace_members
INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at)
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

-- Step 5: Drop old org_members table and org_role enum
DROP TABLE public.org_members;
DROP TYPE public.org_role;

-- Step 6: Create is_workspace_member function
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
  -- Se não há JWT/email, negar
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
  -- usuário satisfaz se seu papel >= p_min_role
  IF p_min_role = 'colaborador' THEN
    RETURN TRUE; -- qualquer papel listado atende
  ELSIF p_min_role = 'gestor' THEN
    RETURN cur_role IN ('gestor','mentor_master');
  ELSIF p_min_role = 'mentor_master' THEN
    RETURN cur_role = 'mentor_master';
  END IF;

  RETURN FALSE;
END;
$$;

-- Step 7: Drop old is_member function
DROP FUNCTION IF EXISTS public.is_member(uuid, org_role);

-- Step 8: Rename org_messaging_settings to workspace_messaging_settings
CREATE TABLE public.workspace_messaging_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  connection_limit integer NOT NULL DEFAULT 1,
  default_instance text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Migrate data from org_messaging_settings
INSERT INTO public.workspace_messaging_settings (workspace_id, connection_limit, default_instance, created_at, updated_at)
SELECT org_id as workspace_id, connection_limit, default_instance, created_at, updated_at
FROM public.org_messaging_settings;

-- Drop old table
DROP TABLE public.org_messaging_settings;

-- Step 9: Update activities table org_id to workspace_id
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

-- Step 11: Create RPCs for workspace-scoped operations
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

-- Step 12: Create RLS policies for workspaces
CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE USING (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_insert" ON public.workspaces
FOR INSERT WITH CHECK (public.is_workspace_member(id, 'mentor_master'::workspace_role));

CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (public.is_workspace_member(id, 'colaborador'::workspace_role));

CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (public.is_workspace_member(id, 'gestor'::workspace_role));

-- Step 13: Create RLS policies for workspace_members
CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

-- Step 14: Create RLS policies for workspace_messaging_settings
CREATE POLICY "workspace_messaging_settings_delete" ON public.workspace_messaging_settings
FOR DELETE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_insert" ON public.workspace_messaging_settings
FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

CREATE POLICY "workspace_messaging_settings_select" ON public.workspace_messaging_settings
FOR SELECT USING (public.is_workspace_member(workspace_id, 'colaborador'::workspace_role));

CREATE POLICY "workspace_messaging_settings_update" ON public.workspace_messaging_settings
FOR UPDATE USING (public.is_workspace_member(workspace_id, 'gestor'::workspace_role));

-- Step 15: Enable RLS on new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messaging_settings ENABLE ROW LEVEL SECURITY;