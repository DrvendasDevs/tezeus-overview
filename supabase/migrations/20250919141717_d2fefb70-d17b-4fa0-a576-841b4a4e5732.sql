-- Atualizar política de SELECT para conversações para permitir acesso melhor
DROP POLICY IF EXISTS "conversations_select_improved" ON conversations;

CREATE POLICY "conversations_select_improved" ON conversations 
FOR SELECT 
USING (
  -- Master vê tudo se for membro do workspace
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) 
  OR 
  -- Admin vê tudo no workspace se for admin
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile))
  OR
  -- Usuários normais veem suas conversas OU conversas não atribuídas
  (is_workspace_member(workspace_id, 'user'::system_profile) AND 
   (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL))
);