-- Drop existing restrictive policies on workspace_members if they exist
DROP POLICY IF EXISTS "workspace_members_select_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_own" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_own" ON public.workspace_members;

-- Create new permissive policies for workspace_members
-- Members can view other members in their workspace
CREATE POLICY "Members can view workspace members"
ON public.workspace_members
FOR SELECT
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Admins and masters can insert members
CREATE POLICY "Admins can add workspace members"
ON public.workspace_members
FOR INSERT
WITH CHECK (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Admins and masters can update members
CREATE POLICY "Admins can update workspace members"
ON public.workspace_members
FOR UPDATE
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Admins and masters can delete members
CREATE POLICY "Admins can delete workspace members"
ON public.workspace_members
FOR DELETE
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);