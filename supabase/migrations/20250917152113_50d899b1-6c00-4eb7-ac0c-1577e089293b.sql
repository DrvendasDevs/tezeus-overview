-- Criar índices críticos para performance otimizada
CREATE INDEX IF NOT EXISTS idx_messages_wid_cid_created_id 
  ON public.messages (workspace_id, conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_wid_last 
  ON public.conversations (workspace_id, last_activity_at DESC NULLS LAST, id DESC);

-- Política RLS simplificada para messages (melhor performance no realtime)
DROP POLICY IF EXISTS "messages_select" ON public.messages;

CREATE POLICY "messages_select_simplified" ON public.messages
FOR SELECT USING (
  is_workspace_member(workspace_id, 'user'::system_profile)
  AND (
    -- Admin/Master vê tudo do workspace
    is_workspace_member(workspace_id, 'admin'::system_profile)
    OR
    -- User só vê suas conversas
    EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = conversation_id 
      AND (c.assigned_user_id = current_system_user_id() OR c.assigned_user_id IS NULL)
    )
  )
);