-- Fix RLS policies for conversations to ensure proper visibility and assignment updates

-- First, let's check and fix the conversations_select_by_role policy
-- The current policy seems correct but let's ensure it's working properly

-- Drop existing policies to recreate them with better logic
DROP POLICY IF EXISTS "conversations_select_by_role" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update_by_role" ON public.conversations;

-- Create improved SELECT policy for conversations
-- Users can see: their own conversations, unassigned conversations (if they're workspace members), all conversations (if admin/master)
CREATE POLICY "conversations_select_improved" ON public.conversations
FOR SELECT 
USING (
  -- Masters and Admins can see all conversations in their workspaces
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile)) OR
  -- Regular users can see:
  -- 1. Conversations assigned to them
  -- 2. Unassigned conversations (NULL assigned_user_id)
  ((NOT is_current_user_admin()) AND (NOT is_current_user_master()) AND 
   is_workspace_member(workspace_id, 'user'::system_profile) AND 
   (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL))
);

-- Create improved UPDATE policy for conversations
-- Users can update: their own conversations, unassigned conversations (for assignment), all conversations (if admin/master)
CREATE POLICY "conversations_update_improved" ON public.conversations
FOR UPDATE 
USING (
  -- Masters and Admins can update all conversations in their workspaces
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile)) OR
  -- Regular users can update:
  -- 1. Conversations assigned to them
  -- 2. Unassigned conversations (to assign to themselves)
  ((NOT is_current_user_admin()) AND (NOT is_current_user_master()) AND 
   is_workspace_member(workspace_id, 'user'::system_profile) AND 
   (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL))
);

-- Recreate the delete and insert policies with the same improved logic
DROP POLICY IF EXISTS "conversations_delete_by_role" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_by_role" ON public.conversations;

CREATE POLICY "conversations_delete_improved" ON public.conversations
FOR DELETE 
USING (
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile))
);

CREATE POLICY "conversations_insert_improved" ON public.conversations
FOR INSERT 
WITH CHECK (
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile))
);