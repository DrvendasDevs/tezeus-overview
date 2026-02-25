-- First update all RLS policies to use system_profile enum instead of workspace_role
-- Update conversations policies
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_delete" ON public.conversations;

CREATE POLICY "conversations_select" 
ON public.conversations 
FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND 
  (is_workspace_member(workspace_id, 'admin'::system_profile) OR 
   (EXISTS (
     SELECT 1 FROM system_users su
     WHERE su.id = current_system_user_id() 
     AND conversations.connection_id = su.default_channel
   )))
);

CREATE POLICY "conversations_insert" 
ON public.conversations 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "conversations_update" 
ON public.conversations 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "conversations_delete" 
ON public.conversations 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Update messages policies
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;

CREATE POLICY "messages_select" 
ON public.messages 
FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND 
  (is_workspace_member(workspace_id, 'admin'::system_profile) OR 
   (EXISTS (
     SELECT 1 FROM conversations c
     JOIN system_users su ON su.id = current_system_user_id()
     WHERE c.id = messages.conversation_id 
     AND c.connection_id = su.default_channel
   )))
);

CREATE POLICY "messages_insert" 
ON public.messages 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "messages_update" 
ON public.messages 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "messages_delete" 
ON public.messages 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Update contacts policies
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_update" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;

CREATE POLICY "contacts_select" 
ON public.contacts 
FOR SELECT 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "contacts_insert" 
ON public.contacts 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "contacts_update" 
ON public.contacts 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "contacts_delete" 
ON public.contacts 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Update tags policies
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_insert" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;
DROP POLICY IF EXISTS "tags_delete" ON public.tags;

CREATE POLICY "tags_select" 
ON public.tags 
FOR SELECT 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "tags_insert" 
ON public.tags 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "tags_update" 
ON public.tags 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "tags_delete" 
ON public.tags 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Update evolution_instance_tokens policies
DROP POLICY IF EXISTS "evolution_instance_tokens_select" ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_insert" ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_update" ON public.evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_delete" ON public.evolution_instance_tokens;

CREATE POLICY "evolution_instance_tokens_select" 
ON public.evolution_instance_tokens 
FOR SELECT 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "evolution_instance_tokens_insert" 
ON public.evolution_instance_tokens 
FOR INSERT 
WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "evolution_instance_tokens_update" 
ON public.evolution_instance_tokens 
FOR UPDATE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "evolution_instance_tokens_delete" 
ON public.evolution_instance_tokens 
FOR DELETE 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Update provider_logs policies
DROP POLICY IF EXISTS "provider_logs_select" ON public.provider_logs;

CREATE POLICY "provider_logs_select" 
ON public.provider_logs 
FOR SELECT 
USING (
  connection_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM connections c
    WHERE c.id = provider_logs.connection_id 
    AND is_workspace_member(c.workspace_id, 'user'::system_profile)
  )
);