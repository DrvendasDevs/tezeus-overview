-- Atualizar enum workspace_role para usar as mesmas classificações do system_profile
DROP TYPE IF EXISTS workspace_role CASCADE;
CREATE TYPE workspace_role AS ENUM ('master', 'admin', 'user');

-- Atualizar dados existentes na tabela workspace_members
UPDATE workspace_members SET role = 
  CASE 
    WHEN role::text = 'mentor_master' THEN 'master'::workspace_role
    WHEN role::text = 'gestor' THEN 'admin'::workspace_role
    WHEN role::text = 'colaborador' THEN 'user'::workspace_role
    ELSE 'user'::workspace_role
  END;

-- Recriar função is_workspace_member com novos roles
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role workspace_role DEFAULT 'user'::workspace_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_user uuid;
  cur_role public.workspace_role;
BEGIN
  -- Se não há JWT/email, negar
  cur_user := public.current_system_user_id();
  IF cur_user IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Master global (via perfil system_users)
  IF EXISTS (
    SELECT 1 FROM public.system_users su
    WHERE su.id = cur_user AND su.profile = 'master'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Papel do usuário no workspace
  SELECT wm.role
  INTO cur_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = cur_user
  LIMIT 1;

  IF cur_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Hierarquia: master > admin > user
  IF p_min_role = 'user' THEN
    RETURN TRUE; -- qualquer papel listado atende
  ELSIF p_min_role = 'admin' THEN
    RETURN cur_role IN ('admin','master');
  ELSIF p_min_role = 'master' THEN
    RETURN cur_role = 'master';
  END IF;

  RETURN FALSE;
END;
$function$;

-- Recriar RLS policies com novos roles e permissões específicas para admin
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON workspaces;

CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (
  is_current_user_master() OR is_workspace_member(id, 'user'::workspace_role)
);

CREATE POLICY "workspaces_insert" ON public.workspaces
FOR INSERT WITH CHECK (
  is_current_user_master()
);

CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (
  is_current_user_master() OR is_workspace_member(id, 'admin'::workspace_role)
);

CREATE POLICY "workspaces_delete" ON public.workspaces
FOR DELETE USING (
  is_current_user_master()
);

-- Atualizar policies de connections para permitir admin criar conexões
DROP POLICY IF EXISTS "connections_select_by_role" ON connections;
DROP POLICY IF EXISTS "connections_insert_by_role" ON connections;
DROP POLICY IF EXISTS "connections_update_by_role" ON connections;
DROP POLICY IF EXISTS "connections_delete_by_role" ON connections;

CREATE POLICY "connections_select_by_role" ON public.connections
FOR SELECT USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role) 
  OR (is_workspace_member(workspace_id, 'user'::workspace_role) AND (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND connections.id = su.default_channel)))
);

CREATE POLICY "connections_insert_by_role" ON public.connections
FOR INSERT WITH CHECK (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

CREATE POLICY "connections_update_by_role" ON public.connections
FOR UPDATE USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

CREATE POLICY "connections_delete_by_role" ON public.connections
FOR DELETE USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

-- Atualizar policies para permitir admin gerenciar workspace_members (criar usuários)
DROP POLICY IF EXISTS "workspace_members_select" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_update" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete" ON workspace_members;

CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);

-- Atualizar demais policies para usar novos roles
DROP POLICY IF EXISTS "contacts_select" ON contacts;
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
DROP POLICY IF EXISTS "contacts_update" ON contacts;
DROP POLICY IF EXISTS "contacts_delete" ON contacts;

CREATE POLICY "contacts_select" ON public.contacts
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "contacts_insert" ON public.contacts
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "contacts_update" ON public.contacts
FOR UPDATE USING (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "contacts_delete" ON public.contacts
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

-- Atualizar policies de tags
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tags_insert" ON tags;
DROP POLICY IF EXISTS "tags_update" ON tags;
DROP POLICY IF EXISTS "tags_delete" ON tags;

CREATE POLICY "tags_select" ON public.tags
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "tags_insert" ON public.tags
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "tags_update" ON public.tags
FOR UPDATE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "tags_delete" ON public.tags
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

-- Atualizar policies de conversations
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "conversations_delete" ON conversations;

CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::workspace_role) AND (
    is_workspace_member(workspace_id, 'admin'::workspace_role)
    OR (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND conversations.connection_id = su.default_channel))
  )
);

CREATE POLICY "conversations_insert" ON public.conversations
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "conversations_update" ON public.conversations
FOR UPDATE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "conversations_delete" ON public.conversations
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

-- Atualizar policies de messages
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;

CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::workspace_role) AND (
    is_workspace_member(workspace_id, 'admin'::workspace_role)
    OR (EXISTS (SELECT 1 FROM (conversations c JOIN system_users su ON (su.id = current_system_user_id())) WHERE c.id = messages.conversation_id AND c.connection_id = su.default_channel))
  )
);

CREATE POLICY "messages_insert" ON public.messages
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "messages_update" ON public.messages
FOR UPDATE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "messages_delete" ON public.messages
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

-- Atualizar policies de evolution_instance_tokens
DROP POLICY IF EXISTS "evolution_instance_tokens_select" ON evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_insert" ON evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_update" ON evolution_instance_tokens;
DROP POLICY IF EXISTS "evolution_instance_tokens_delete" ON evolution_instance_tokens;

CREATE POLICY "evolution_instance_tokens_select" ON public.evolution_instance_tokens
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::workspace_role));

CREATE POLICY "evolution_instance_tokens_insert" ON public.evolution_instance_tokens
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "evolution_instance_tokens_update" ON public.evolution_instance_tokens
FOR UPDATE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

CREATE POLICY "evolution_instance_tokens_delete" ON public.evolution_instance_tokens
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::workspace_role));

-- Atualizar policy de workspace_limits
DROP POLICY IF EXISTS "workspace_limits_service_and_master" ON workspace_limits;

CREATE POLICY "workspace_limits_service_and_master" ON public.workspace_limits
FOR ALL USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role)
)
WITH CHECK (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::workspace_role)
);