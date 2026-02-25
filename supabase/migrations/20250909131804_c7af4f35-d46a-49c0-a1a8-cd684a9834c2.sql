-- Adicionar campos necessários se não existirem
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

-- Atualizar RLS policies para conversations
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_delete" ON conversations;

-- Policy para SELECT - implementa as regras de visibilidade
CREATE POLICY "conversations_select_by_role" ON conversations FOR SELECT USING (
  -- Master: vê tudo do workspace selecionado
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  
  -- Admin: vê tudo do seu workspace
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile)) OR
  
  -- User: vê apenas atribuídas a ele OU não atribuídas do seu workspace
  (NOT is_current_user_admin() AND NOT is_current_user_master() AND 
   is_workspace_member(workspace_id, 'user'::system_profile) AND 
   (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL))
);

-- Policy para UPDATE - aceitar conversas e outras atualizações
CREATE POLICY "conversations_update_by_role" ON conversations FOR UPDATE USING (
  -- Master: pode atualizar tudo do workspace selecionado
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  
  -- Admin: pode atualizar tudo do seu workspace
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile)) OR
  
  -- User: pode atualizar conversas atribuídas a ele ou aceitar não atribuídas
  (NOT is_current_user_admin() AND NOT is_current_user_master() AND 
   is_workspace_member(workspace_id, 'user'::system_profile) AND 
   (assigned_user_id = current_system_user_id() OR assigned_user_id IS NULL))
);

-- Policy para INSERT - apenas admin/master podem criar
CREATE POLICY "conversations_insert_by_role" ON conversations FOR INSERT WITH CHECK (
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile))
);

-- Policy para DELETE - apenas admin/master podem deletar
CREATE POLICY "conversations_delete_by_role" ON conversations FOR DELETE USING (
  (is_current_user_master() AND is_workspace_member(workspace_id, 'user'::system_profile)) OR
  (is_current_user_admin() AND is_workspace_member(workspace_id, 'admin'::system_profile))
);

-- Criar tabela de auditoria para atribuições
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_assigned_user_id UUID,
  to_assigned_user_id UUID,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('accept', 'assign', 'unassign'))
);

-- RLS para tabela de auditoria
ALTER TABLE conversation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_assignments_select" ON conversation_assignments FOR SELECT USING (
  -- Master: vê tudo
  is_current_user_master() OR
  -- Admin: vê do seu workspace
  (is_current_user_admin() AND EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_id AND is_workspace_member(c.workspace_id, 'admin'::system_profile)
  )) OR
  -- User: vê apenas relacionadas a ele
  (to_assigned_user_id = current_system_user_id() OR from_assigned_user_id = current_system_user_id() OR changed_by = current_system_user_id())
);

CREATE POLICY "conversation_assignments_insert" ON conversation_assignments FOR INSERT WITH CHECK (
  changed_by = current_system_user_id()
);