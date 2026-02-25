-- Fix RLS policies for workspace access - remove recursion issues

-- Drop existing problematic policies for workspace_members
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;

-- Create simple policy for workspace_members that allows users to see their own memberships
CREATE POLICY "workspace_members_select_own" ON public.workspace_members
FOR SELECT USING (user_id = public.current_system_user_id());

-- Drop existing problematic policies for workspaces
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;

-- Create simple policy for workspaces that allows users to see workspaces where they are members
CREATE POLICY "workspaces_select_members" ON public.workspaces
FOR SELECT USING (
  is_current_user_master() OR 
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.workspace_id = workspaces.id 
    AND wm.user_id = public.current_system_user_id()
  )
);