-- Recriar as policies que foram removidas pela cascade
-- Atualizar RLS policies da tabela connections
CREATE POLICY "connections_select_by_role" ON public.connections
FOR SELECT USING (
  (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = current_system_user_id() AND wm.role = 'master'::system_profile)) 
  OR is_workspace_member(workspace_id, 'admin'::system_profile) 
  OR (is_workspace_member(workspace_id, 'user'::system_profile) AND (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND connections.id = su.default_channel)))
);

CREATE POLICY "connections_insert_by_role" ON public.connections
FOR INSERT WITH CHECK (
  (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = current_system_user_id() AND wm.role = 'master'::system_profile)) 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "connections_update_by_role" ON public.connections
FOR UPDATE USING (
  (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = current_system_user_id() AND wm.role = 'master'::system_profile)) 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "connections_delete_by_role" ON public.connections
FOR DELETE USING (
  (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = current_system_user_id() AND wm.role = 'master'::system_profile)) 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Atualizar RLS policies da tabela conversations
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversations.workspace_id AND wm.user_id = current_system_user_id() AND wm.role = ANY (ARRAY['admin'::system_profile, 'master'::system_profile]))) 
    OR (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND conversations.connection_id = su.default_channel))
  )
);

-- Atualizar RLS policies da tabela messages
CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messages.workspace_id AND wm.user_id = current_system_user_id() AND wm.role = ANY (ARRAY['admin'::system_profile, 'master'::system_profile]))) 
    OR (EXISTS (SELECT 1 FROM (conversations c JOIN system_users su ON (su.id = current_system_user_id())) WHERE c.id = messages.conversation_id AND c.connection_id = su.default_channel))
  )
);