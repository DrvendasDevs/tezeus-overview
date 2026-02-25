-- Criar tabela queue_users (relacionamento entre filas e usuários)
CREATE TABLE IF NOT EXISTS public.queue_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(queue_id, user_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_queue_users_queue_id ON public.queue_users(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_users_user_id ON public.queue_users(user_id);

-- Habilitar RLS
ALTER TABLE public.queue_users ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem gerenciar queue_users do seu workspace
CREATE POLICY "Users can manage queue_users in their workspace"
ON public.queue_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.queues q
    WHERE q.id = queue_users.queue_id
    AND is_workspace_member(q.workspace_id, 'user'::system_profile)
  )
);

-- Adicionar campo last_assigned_user_index na tabela queues
ALTER TABLE public.queues 
ADD COLUMN IF NOT EXISTS last_assigned_user_index INTEGER DEFAULT 0;