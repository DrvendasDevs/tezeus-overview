-- Remove a constraint única que impede múltiplas execuções
-- Isso permite que automações "message_received" executem múltiplas vezes
ALTER TABLE automation_executions 
DROP CONSTRAINT IF EXISTS automation_executions_card_id_column_id_automation_id_trigg_key;

-- Adicionar índice para performance (sem unique)
CREATE INDEX IF NOT EXISTS idx_automation_executions_lookup 
ON automation_executions(card_id, column_id, automation_id, trigger_type, executed_at DESC);