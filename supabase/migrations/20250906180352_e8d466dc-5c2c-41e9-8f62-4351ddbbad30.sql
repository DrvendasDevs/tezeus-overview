-- Primeiro, vamos ajustar as políticas da tabela connections para respeitar as regras
DROP POLICY IF EXISTS "connections_insert" ON public.connections;
DROP POLICY IF EXISTS "connections_select" ON public.connections;
DROP POLICY IF EXISTS "connections_update" ON public.connections;
DROP POLICY IF EXISTS "connections_delete" ON public.connections;

-- Política de SELECT: mentor_master vê tudo, gestor vê apenas seu workspace
CREATE POLICY "connections_select_by_role" 
ON public.connections
FOR SELECT
USING (
  -- Mentor master vê tudo
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.user_id = current_system_user_id() 
    AND wm.role = 'mentor_master'
  ) OR
  -- Gestor vê apenas seu workspace
  is_workspace_member(workspace_id, 'gestor'::workspace_role) OR
  -- Colaborador vê apenas conexões do seu canal padrão
  (
    is_workspace_member(workspace_id, 'colaborador'::workspace_role) AND
    EXISTS (
      SELECT 1 FROM public.system_users su
      WHERE su.id = current_system_user_id() 
      AND connections.id = su.default_channel
    )
  )
);

-- Política de INSERT: mentor_master pode criar em qualquer workspace, gestor apenas no seu
CREATE POLICY "connections_insert_by_role" 
ON public.connections
FOR INSERT
WITH CHECK (
  -- Mentor master pode criar em qualquer workspace
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.user_id = current_system_user_id() 
    AND wm.role = 'mentor_master'
  ) OR
  -- Gestor pode criar apenas no seu workspace
  is_workspace_member(workspace_id, 'gestor'::workspace_role)
);

-- Política de UPDATE: mentor_master pode atualizar tudo, gestor apenas seu workspace
CREATE POLICY "connections_update_by_role" 
ON public.connections
FOR UPDATE
USING (
  -- Mentor master pode atualizar tudo
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.user_id = current_system_user_id() 
    AND wm.role = 'mentor_master'
  ) OR
  -- Gestor pode atualizar apenas seu workspace
  is_workspace_member(workspace_id, 'gestor'::workspace_role)
);

-- Política de DELETE: mentor_master pode deletar tudo, gestor apenas seu workspace
CREATE POLICY "connections_delete_by_role" 
ON public.connections
FOR DELETE
USING (
  -- Mentor master pode deletar tudo
  EXISTS (
    SELECT 1 FROM public.workspace_members wm 
    WHERE wm.user_id = current_system_user_id() 
    AND wm.role = 'mentor_master'
  ) OR
  -- Gestor pode deletar apenas seu workspace
  is_workspace_member(workspace_id, 'gestor'::workspace_role)
);