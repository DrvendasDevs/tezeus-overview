
-- 1) Adicionar a coluna de instância Evolution na conversa
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS evolution_instance text;

-- 2) Índice opcional para facilitar filtros/relatórios por instância
CREATE INDEX IF NOT EXISTS idx_conversations_evolution_instance
  ON public.conversations (evolution_instance);
