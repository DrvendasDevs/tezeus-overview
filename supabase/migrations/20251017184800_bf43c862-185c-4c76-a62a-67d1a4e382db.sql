-- Habilitar RLS na tabela queue_users
ALTER TABLE public.queue_users ENABLE ROW LEVEL SECURITY;

-- Policy para permitir visualização de queue_users no workspace do usuário
CREATE POLICY "Users can view queue_users in their workspace"
ON public.queue_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);

-- Policy para permitir inserção de queue_users no workspace do usuário
CREATE POLICY "Users can insert queue_users in their workspace"
ON public.queue_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);

-- Policy para permitir update de queue_users no workspace do usuário
CREATE POLICY "Users can update queue_users in their workspace"
ON public.queue_users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);

-- Policy para permitir deleção de queue_users no workspace do usuário
CREATE POLICY "Users can delete queue_users in their workspace"
ON public.queue_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);