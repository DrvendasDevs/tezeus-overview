-- Drop old RLS policies from workspaces that reference non-existent org_members
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;

-- Create correct RLS policies for workspaces table
-- Masters can see and manage all workspaces
-- Workspace members can see their own workspaces
-- Admins can create and manage workspaces they belong to

-- SELECT: Masters see all, members see their workspaces
CREATE POLICY "workspaces_select_by_role"
ON public.workspaces
FOR SELECT
USING (
  is_current_user_master() 
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
    AND wm.user_id = current_system_user_id()
  )
);

-- INSERT: Masters and admins can create workspaces
CREATE POLICY "workspaces_insert_by_role"
ON public.workspaces
FOR INSERT
WITH CHECK (
  is_current_user_master() 
  OR is_current_user_admin()
);

-- UPDATE: Masters can update all, members with admin role can update their workspace
CREATE POLICY "workspaces_update_by_role"
ON public.workspaces
FOR UPDATE
USING (
  is_current_user_master()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspaces.id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
);

-- DELETE: Only masters can delete workspaces
CREATE POLICY "workspaces_delete_by_role"
ON public.workspaces
FOR DELETE
USING (is_current_user_master());