-- Remover constraint antigo se existir
ALTER TABLE pipeline_card_history 
DROP CONSTRAINT IF EXISTS pipeline_card_history_action_check;

-- Adicionar novo constraint com TODOS os valores (existentes + novos)
ALTER TABLE pipeline_card_history 
ADD CONSTRAINT pipeline_card_history_action_check 
CHECK (action IN (
  -- Valores existentes
  'card_assigned',
  'column_changed',
  'status_changed',
  -- Novos valores para tags
  'tag_added',
  'tag_removed',
  -- Outros valores úteis para o futuro
  'created',
  'updated',
  'deleted',
  'pipeline_changed',
  'value_changed',
  'product_changed',
  'responsible_changed'
));