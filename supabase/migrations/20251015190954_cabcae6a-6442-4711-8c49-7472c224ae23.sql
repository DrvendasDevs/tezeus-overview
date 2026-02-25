-- Adicionar coluna para armazenar o evolution_short_key_id (22 chars)
-- Este ID é o keyId retornado pela Evolution API em messages.update webhooks
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS evolution_short_key_id TEXT;

-- Criar índice para busca rápida por evolution_short_key_id
CREATE INDEX IF NOT EXISTS idx_messages_evolution_short_key_id 
ON public.messages(evolution_short_key_id);

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.messages.evolution_short_key_id IS 
  'ID curto da Evolution API (22 caracteres) retornado no campo keyId dos webhooks messages.update. Usado para localizar mensagens em atualizações de ACK.';