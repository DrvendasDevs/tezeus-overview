-- ============================================================================
-- Migração: Adicionar coluna provider_moment para ordenação real de mensagens
-- ============================================================================
-- Problema: O provider (ZAPI/Evolution) pode reenviar mensagens, entregar fora 
-- de ordem ou com atraso. O campo created_at representa quando a mensagem 
-- chegou no sistema, não quando foi enviada no WhatsApp.
--
-- Solução: Usar o campo webhook_data.momment (timestamp Unix em ms) do provider
-- que representa o momento real da mensagem no WhatsApp.
-- ============================================================================

-- 1. Adicionar coluna provider_moment (BIGINT para suportar timestamp em ms)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS provider_moment BIGINT;

-- 2. Criar índice para ordenação eficiente por provider_moment
CREATE INDEX IF NOT EXISTS idx_messages_provider_moment 
ON messages(conversation_id, provider_moment ASC);

-- 3. Criar índice composto para paginação (provider_moment + id)
CREATE INDEX IF NOT EXISTS idx_messages_provider_moment_pagination
ON messages(conversation_id, provider_moment DESC, id DESC);

-- 4. Preencher provider_moment para mensagens existentes usando created_at convertido
-- (fallback seguro para histórico)
UPDATE messages 
SET provider_moment = EXTRACT(EPOCH FROM created_at) * 1000
WHERE provider_moment IS NULL;

-- 5. Comentário na coluna para documentação
COMMENT ON COLUMN messages.provider_moment IS 
'Timestamp Unix em milissegundos do momento real da mensagem no WhatsApp (webhook_data.momment). Usado para ordenação correta da conversa.';
