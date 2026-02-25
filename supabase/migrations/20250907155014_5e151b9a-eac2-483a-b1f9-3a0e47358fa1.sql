-- Verificar e corrigir a atualização dos dados existentes na tabela workspace_members
-- A tabela já usa system_profile, então vamos atualizar os dados diretamente

UPDATE workspace_members SET role = 
  CASE 
    WHEN role::text = 'mentor_master' THEN 'master'::system_profile
    WHEN role::text = 'gestor' THEN 'admin'::system_profile
    WHEN role::text = 'colaborador' THEN 'user'::system_profile
    ELSE 'user'::system_profile
  END
WHERE role::text IN ('mentor_master', 'gestor', 'colaborador');

-- Recriar função is_workspace_member usando system_profile (que já existe)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_min_role system_profile DEFAULT 'user'::system_profile)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_user uuid;
  cur_role public.system_profile;
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
CREATE POLICY "workspaces_select" ON public.workspaces
FOR SELECT USING (
  is_current_user_master() OR is_workspace_member(id, 'user'::system_profile)
);

DROP POLICY IF EXISTS "workspaces_update" ON workspaces;
CREATE POLICY "workspaces_update" ON public.workspaces
FOR UPDATE USING (
  is_current_user_master() OR is_workspace_member(id, 'admin'::system_profile)
);

-- Atualizar policies de connections para permitir admin criar conexões
DROP POLICY IF EXISTS "connections_select_by_role" ON connections;
CREATE POLICY "connections_select_by_role" ON public.connections
FOR SELECT USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile) 
  OR (is_workspace_member(workspace_id, 'user'::system_profile) AND (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND connections.id = su.default_channel)))
);

DROP POLICY IF EXISTS "connections_insert_by_role" ON connections;
CREATE POLICY "connections_insert_by_role" ON public.connections
FOR INSERT WITH CHECK (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

DROP POLICY IF EXISTS "connections_update_by_role" ON connections;
CREATE POLICY "connections_update_by_role" ON public.connections
FOR UPDATE USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

DROP POLICY IF EXISTS "connections_delete_by_role" ON connections;
CREATE POLICY "connections_delete_by_role" ON public.connections
FOR DELETE USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Atualizar policies para permitir admin gerenciar workspace_members (criar usuários)
DROP POLICY IF EXISTS "workspace_members_select" ON workspace_members;
CREATE POLICY "workspace_members_select" ON public.workspace_members
FOR SELECT USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

DROP POLICY IF EXISTS "workspace_members_insert" ON workspace_members;
CREATE POLICY "workspace_members_insert" ON public.workspace_members
FOR INSERT WITH CHECK (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

DROP POLICY IF EXISTS "workspace_members_update" ON workspace_members;
CREATE POLICY "workspace_members_update" ON public.workspace_members
FOR UPDATE USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

DROP POLICY IF EXISTS "workspace_members_delete" ON workspace_members;
CREATE POLICY "workspace_members_delete" ON public.workspace_members
FOR DELETE USING (
  is_current_user_master() OR is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Atualizar policies de conversations para admin ver conversas
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON public.conversations
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    is_workspace_member(workspace_id, 'admin'::system_profile)
    OR (EXISTS (SELECT 1 FROM system_users su WHERE su.id = current_system_user_id() AND conversations.connection_id = su.default_channel))
  )
);

-- Atualizar policies de messages para admin ver mensagens
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND (
    is_workspace_member(workspace_id, 'admin'::system_profile)
    OR (EXISTS (SELECT 1 FROM (conversations c JOIN system_users su ON (su.id = current_system_user_id())) WHERE c.id = messages.conversation_id AND c.connection_id = su.default_channel))
  )
);

-- Atualizar policy de workspace_limits para admin ver limites
DROP POLICY IF EXISTS "workspace_limits_service_and_master" ON workspace_limits;
CREATE POLICY "workspace_limits_service_and_master" ON public.workspace_limits
FOR ALL USING (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  ((auth.jwt() ->> 'role'::text) = 'service_role'::text) 
  OR is_current_user_master() 
  OR is_workspace_member(workspace_id, 'admin'::system_profile)
);