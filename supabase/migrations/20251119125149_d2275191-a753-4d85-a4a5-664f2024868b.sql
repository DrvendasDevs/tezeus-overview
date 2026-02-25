-- Habilitar RLS na tabela queue_users (se ainda não estiver habilitado)
ALTER TABLE queue_users ENABLE ROW LEVEL SECURITY;

-- Política para permitir admins e masters verem usuários de filas do seu workspace
CREATE POLICY "queue_users_select_policy" 
ON queue_users 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);

-- Política para permitir admins e masters inserirem usuários em filas do seu workspace
CREATE POLICY "queue_users_insert_policy" 
ON queue_users 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'admin'::system_profile)
  )
);

-- Política para permitir admins e masters atualizarem usuários de filas do seu workspace
CREATE POLICY "queue_users_update_policy" 
ON queue_users 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'admin'::system_profile)
  )
);

-- Política para permitir admins e masters removerem usuários de filas do seu workspace
CREATE POLICY "queue_users_delete_policy" 
ON queue_users 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'admin'::system_profile)
  )
);