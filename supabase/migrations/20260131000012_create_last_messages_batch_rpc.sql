-- =============================================
-- Migração: RPC para buscar últimas mensagens em batch
-- =============================================
-- Esta função otimiza o carregamento de conversas buscando as últimas mensagens
-- de múltiplas conversas em uma única query

CREATE OR REPLACE FUNCTION public.get_last_messages_batch(
  p_conversation_ids UUID[],
  p_workspace_id UUID
)
RETURNS TABLE (
  conversation_id UUID,
  content TEXT,
  message_type TEXT,
  sender_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.content,
    m.message_type::TEXT,
    m.sender_type::TEXT,
    m.created_at
  FROM messages m
  WHERE m.conversation_id = ANY(p_conversation_ids)
    AND m.workspace_id = p_workspace_id
  ORDER BY m.conversation_id, m.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_last_messages_batch IS 'Busca a última mensagem de cada conversa em batch para otimizar carregamento';

GRANT EXECUTE ON FUNCTION public.get_last_messages_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_messages_batch TO service_role;
