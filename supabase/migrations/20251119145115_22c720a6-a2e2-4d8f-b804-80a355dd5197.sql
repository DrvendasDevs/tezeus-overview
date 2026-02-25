-- Adicionar colunas para rastrear transferências de fila na tabela conversation_assignments
ALTER TABLE public.conversation_assignments
ADD COLUMN IF NOT EXISTS from_queue_id uuid REFERENCES public.queues(id),
ADD COLUMN IF NOT EXISTS to_queue_id uuid REFERENCES public.queues(id);

-- Criar índices para melhorar performance nas queries de histórico
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_from_queue ON public.conversation_assignments(from_queue_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_to_queue ON public.conversation_assignments(to_queue_id);

-- Comentários para documentação
COMMENT ON COLUMN public.conversation_assignments.from_queue_id IS 'ID da fila de origem quando action = queue_transfer';
COMMENT ON COLUMN public.conversation_assignments.to_queue_id IS 'ID da fila de destino quando action = queue_transfer';