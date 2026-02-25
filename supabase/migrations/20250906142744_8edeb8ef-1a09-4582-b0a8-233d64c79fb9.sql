-- Update RLS policies for messages table to restrict colaboradores to their assigned connection
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" 
ON messages 
FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'colaborador'::workspace_role) AND (
    -- Gestor and mentor_master can see all workspace messages
    EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = messages.workspace_id 
      AND wm.user_id = current_system_user_id() 
      AND wm.role IN ('gestor', 'mentor_master')
    )
    OR 
    -- Colaboradores can only see messages from conversations linked to their assigned connection
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN system_users su ON su.id = current_system_user_id()
      WHERE c.id = messages.conversation_id
      AND c.connection_id = su.default_channel
    )
  )
);

-- Update RLS policies for conversations table to restrict colaboradores to their assigned connection  
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select"
ON conversations 
FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'colaborador'::workspace_role) AND (
    -- Gestor and mentor_master can see all workspace conversations
    EXISTS (
      SELECT 1 FROM workspace_members wm 
      WHERE wm.workspace_id = conversations.workspace_id 
      AND wm.user_id = current_system_user_id() 
      AND wm.role IN ('gestor', 'mentor_master')
    )
    OR 
    -- Colaboradores can only see conversations from their assigned connection
    EXISTS (
      SELECT 1 FROM system_users su
      WHERE su.id = current_system_user_id()
      AND conversations.connection_id = su.default_channel
    )
  )
);