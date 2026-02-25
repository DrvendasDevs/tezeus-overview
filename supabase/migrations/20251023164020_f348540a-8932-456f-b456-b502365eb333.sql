-- 1. Remover política restritiva atual que bloqueia Realtime
DROP POLICY IF EXISTS "conversations_select_by_role" ON public.conversations;

-- 2. Criar nova política mais permissiva para membros do workspace
-- Todos os membros podem SELECT todas as conversas (filtro será feito no client)
CREATE POLICY "conversations_select_by_workspace_member" 
ON public.conversations 
FOR SELECT 
USING (
  -- Masters podem ver tudo
  is_current_user_master() 
  OR 
  -- Membros do workspace podem ver todas as conversas do workspace
  -- (filtro de assigned_user_id será feito no client-side)
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- 3. Validar que REPLICA IDENTITY FULL está ativo
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;