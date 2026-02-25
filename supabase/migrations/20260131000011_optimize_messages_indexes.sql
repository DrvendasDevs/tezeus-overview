-- =============================================
-- Migração: Otimizar índices da tabela messages
-- =============================================
-- Garantir que os índices críticos existem para performance de carregamento de mensagens

-- Índice composto para busca paginada por workspace + conversation + created_at + id
-- Este índice é o mais importante para a query principal de carregamento de mensagens
CREATE INDEX IF NOT EXISTS idx_messages_workspace_conversation_created 
ON public.messages (workspace_id, conversation_id, created_at DESC, id DESC);

-- Índice para busca por conversation_id (já deve existir, mas garantir)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
ON public.messages(conversation_id);

-- Índice para busca por workspace_id (já deve existir, mas garantir)
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id 
ON public.messages(workspace_id);

-- Analyze na tabela para atualizar estatísticas
ANALYZE public.messages;

COMMENT ON INDEX idx_messages_workspace_conversation_created IS 'Índice otimizado para carregamento paginado de mensagens por workspace e conversa';
