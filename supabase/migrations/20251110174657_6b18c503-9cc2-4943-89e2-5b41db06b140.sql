-- Otimizar realtime para conversations
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Remover policies antigas que podem estar bloqueando realtime
DROP POLICY IF EXISTS "conversations_select_by_workspace_member" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_by_role" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_improved" ON public.conversations;
DROP POLICY IF EXISTS "conversations_realtime_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_select_for_realtime" ON public.conversations;

-- Policy simples que permite membros do workspace ver conversas
CREATE POLICY "conversations_workspace_select"
ON public.conversations
FOR SELECT
USING (
  is_current_user_master() 
  OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);