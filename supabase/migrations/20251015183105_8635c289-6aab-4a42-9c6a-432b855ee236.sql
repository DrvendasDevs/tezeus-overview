-- Ajustar política RLS da tabela queues para permitir que usuários comuns também criem filas
-- Atualmente só admins podem criar, vamos permitir que qualquer membro do workspace possa criar

-- Remover a política antiga de INSERT/UPDATE/DELETE (comando ALL)
DROP POLICY IF EXISTS "Admins can manage queues in their workspace" ON public.queues;

-- Criar novas políticas mais específicas

-- Admins podem fazer tudo
CREATE POLICY "Admins can manage queues in their workspace"
ON public.queues
FOR ALL
TO authenticated
USING (
  (workspace_id IS NULL) OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  (workspace_id IS NULL) OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Usuários comuns podem criar filas (INSERT)
CREATE POLICY "Users can create queues in their workspace"
ON public.queues
FOR INSERT
TO authenticated
WITH CHECK (
  (workspace_id IS NULL) OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Usuários comuns podem atualizar filas (UPDATE)
CREATE POLICY "Users can update queues in their workspace"
ON public.queues
FOR UPDATE
TO authenticated
USING (
  (workspace_id IS NULL) OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
)
WITH CHECK (
  (workspace_id IS NULL) OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);