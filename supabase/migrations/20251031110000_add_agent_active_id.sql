-- Adicionar campo agent_active_id na tabela conversations
-- Este campo armazena o ID do agente IA ativo na conversa
-- Complementa o campo booleano agente_ativo existente

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS agent_active_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_conversations_agent_active_id 
ON public.conversations(agent_active_id) 
WHERE agent_active_id IS NOT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.conversations.agent_active_id IS 'ID do agente IA ativo nesta conversa. NULL quando nenhum agente está ativo. Complementa o campo agente_ativo (boolean).';

