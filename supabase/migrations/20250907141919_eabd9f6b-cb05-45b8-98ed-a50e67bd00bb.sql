-- Primeiro, vamos atualizar todas as policies que dependem da coluna role
-- para usar a nova nomenclatura

-- Remover o enum antigo se existir
DROP TYPE IF EXISTS public.workspace_role CASCADE;

-- Criar o novo enum para workspace roles alinhado com system_users profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_profile') THEN
    CREATE TYPE public.system_profile AS ENUM ('master', 'admin', 'user');
  END IF;
END $$;

-- Atualizar RLS policies da tabela connections
DROP POLICY IF EXISTS "connections_select_by_role" ON public.connections;
DROP POLICY IF EXISTS "connections_insert_by_role" ON public.connections;
DROP POLICY IF EXISTS "connections_update_by_role" ON public.connections;
DROP POLICY IF EXISTS "connections_delete_by_role" ON public.connections;

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
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;

CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = conversations.workspace_id AND wm.user_id = current_system_user_id() AND wm.role = ANY (ARRAY['admin'::system_profile, 'master'::system_profile]))) 
    OR (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND conversations.connection_id = su.default_channel))
  )
);

-- Atualizar RLS policies da tabela messages
DROP POLICY IF EXISTS "messages_select" ON public.messages;

CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messages.workspace_id AND wm.user_id = current_system_user_id() AND wm.role = ANY (ARRAY['admin'::system_profile, 'master'::system_profile]))) 
    OR (EXISTS (SELECT 1 FROM (conversations c JOIN system_users su ON (su.id = current_system_user_id())) WHERE c.id = messages.conversation_id AND c.connection_id = su.default_channel))
  )
);