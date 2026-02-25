-- Ajusta restrições para permitir histórico de transferências de fila
ALTER TABLE public.conversation_assignments
  ALTER COLUMN changed_by DROP NOT NULL;

ALTER TABLE public.conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_action_check;

ALTER TABLE public.conversation_assignments
  ADD CONSTRAINT conversation_assignments_action_check
  CHECK (action IN ('accept', 'assign', 'unassign', 'transfer', 'queue_transfer'));

