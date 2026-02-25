-- Remove ALL old org-related policies that reference is_member() function
DROP POLICY IF EXISTS "orgs_select" ON public.workspaces;
DROP POLICY IF EXISTS "orgs_insert" ON public.workspaces;
DROP POLICY IF EXISTS "orgs_update" ON public.workspaces;
DROP POLICY IF EXISTS "orgs_delete" ON public.workspaces;

-- Also remove duplicate workspaces_select_members if exists
DROP POLICY IF EXISTS "workspaces_select_members" ON public.workspaces;

-- Enable RLS if not already enabled
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;