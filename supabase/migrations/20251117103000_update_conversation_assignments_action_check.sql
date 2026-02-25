-- Atualiza constraint de ação em conversation_assignments para permitir transferências
ALTER TABLE conversation_assignments
  DROP CONSTRAINT IF EXISTS conversation_assignments_action_check;

ALTER TABLE conversation_assignments
  ADD CONSTRAINT conversation_assignments_action_check
  CHECK (action IN ('accept', 'assign', 'unassign', 'transfer'));


