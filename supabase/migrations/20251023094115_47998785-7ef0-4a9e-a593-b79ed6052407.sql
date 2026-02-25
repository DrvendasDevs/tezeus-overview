-- Fix RLS for admin users access to conversations and dashboard

-- Enable RLS on workspace_members (needed for admin checks)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Create policies for workspace_members to allow users to see their own memberships
CREATE POLICY "workspace_members_select_own" ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = current_system_user_id()
    OR is_current_user_master()
    OR is_current_user_admin()
  );

-- Ensure admin users can manage workspace members
CREATE POLICY "workspace_members_admin_manage" ON public.workspace_members
  FOR ALL
  TO authenticated
  USING (
    is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- Fix conversations policy for admin users
DROP POLICY IF EXISTS "conversations_allow_all" ON public.conversations;

CREATE POLICY "conversations_select_by_workspace" ON public.conversations
  FOR SELECT
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "conversations_insert_by_workspace" ON public.conversations
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "conversations_update_by_workspace" ON public.conversations
  FOR UPDATE
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "conversations_delete_by_admin" ON public.conversations
  FOR DELETE
  USING (
    is_workspace_member(workspace_id, 'admin'::system_profile)
  );

-- Fix messages policy for admin users  
DROP POLICY IF EXISTS "messages_allow_all" ON public.messages;

CREATE POLICY "messages_select_by_workspace" ON public.messages
  FOR SELECT
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

-- Ensure notifications table has proper RLS enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Fix contacts policy for admin users
DROP POLICY IF EXISTS "contacts_allow_all" ON public.contacts;

CREATE POLICY "contacts_select_by_workspace" ON public.contacts
  FOR SELECT
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_insert_by_workspace" ON public.contacts
  FOR INSERT
  WITH CHECK (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_update_by_workspace" ON public.contacts
  FOR UPDATE
  USING (
    is_workspace_member(workspace_id, 'user'::system_profile)
  );

CREATE POLICY "contacts_delete_by_admin" ON public.contacts
  FOR DELETE
  USING (
    is_workspace_member(workspace_id, 'admin'::system_profile)
  );