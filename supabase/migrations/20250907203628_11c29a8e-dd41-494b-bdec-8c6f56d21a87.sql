-- Update RLS policies for connections table to allow users to see their assigned connections
DROP POLICY IF EXISTS "connections_select_by_role" ON public.connections;

CREATE POLICY "connections_select_by_role" ON public.connections
FOR SELECT USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile) OR 
  (is_workspace_member(workspace_id, 'user'::system_profile) AND (
    -- User can see connections assigned to them
    EXISTS (
      SELECT 1 FROM system_users su 
      WHERE su.id = current_system_user_id() 
      AND connections.id = su.default_channel
    ) OR
    -- User can see connections from instance_user_assignments table
    EXISTS (
      SELECT 1 FROM instance_user_assignments iua
      WHERE iua.user_id = current_system_user_id()
      AND iua.instance = connections.instance_name
    )
  ))
);

-- Update RLS policies for conversations table to restrict visibility based on assignment
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;

CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    -- Admins and masters can see all conversations
    is_workspace_member(workspace_id, 'admin'::system_profile) OR
    -- Users can only see conversations from their assigned connections
    (EXISTS (
      SELECT 1 FROM system_users su 
      WHERE su.id = current_system_user_id() 
      AND conversations.connection_id = su.default_channel
    ) OR
    EXISTS (
      SELECT 1 FROM instance_user_assignments iua
      JOIN connections c ON c.instance_name = iua.instance
      WHERE iua.user_id = current_system_user_id()
      AND c.id = conversations.connection_id
    )) AND (
      -- If conversation is not assigned, anyone with connection access can see it
      conversations.assigned_user_id IS NULL OR
      -- If conversation is assigned, only assigned user, master, and admin can see it
      conversations.assigned_user_id = current_system_user_id() OR
      is_workspace_member(workspace_id, 'admin'::system_profile)
    )
  )
);

-- Update RLS policies for messages table to follow conversation visibility
DROP POLICY IF EXISTS "messages_select" ON public.messages;

CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    -- Check if user can see the conversation this message belongs to
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (
        is_workspace_member(c.workspace_id, 'admin'::system_profile) OR
        (
          (EXISTS (
            SELECT 1 FROM system_users su 
            WHERE su.id = current_system_user_id() 
            AND c.connection_id = su.default_channel
          ) OR
          EXISTS (
            SELECT 1 FROM instance_user_assignments iua
            JOIN connections conn ON conn.instance_name = iua.instance
            WHERE iua.user_id = current_system_user_id()
            AND conn.id = c.connection_id
          )) AND (
            c.assigned_user_id IS NULL OR
            c.assigned_user_id = current_system_user_id() OR
            is_workspace_member(c.workspace_id, 'admin'::system_profile)
          )
        )
      )
    )
  )
);

-- Add policy for updating conversations (accepting conversations)
DROP POLICY IF EXISTS "conversations_update" ON public.conversations;

CREATE POLICY "conversations_update" ON public.conversations
FOR UPDATE USING (
  is_workspace_member(workspace_id, 'admin'::system_profile) OR
  -- Users can accept conversations from their assigned connections
  (is_workspace_member(workspace_id, 'user'::system_profile) AND (
    EXISTS (
      SELECT 1 FROM system_users su 
      WHERE su.id = current_system_user_id() 
      AND conversations.connection_id = su.default_channel
    ) OR
    EXISTS (
      SELECT 1 FROM instance_user_assignments iua
      JOIN connections c ON c.instance_name = iua.instance
      WHERE iua.user_id = current_system_user_id()
      AND c.id = conversations.connection_id
    )
  ))
);

-- Create index for better performance on instance_user_assignments
CREATE INDEX IF NOT EXISTS idx_instance_user_assignments_user_instance 
ON instance_user_assignments(user_id, instance);

-- Create index for better performance on conversations assigned_user_id
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user 
ON conversations(assigned_user_id) WHERE assigned_user_id IS NOT NULL;