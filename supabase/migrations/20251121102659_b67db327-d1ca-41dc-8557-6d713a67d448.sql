-- Atualizar constraint para aceitar Aberto, Ganho e Perda
ALTER TABLE pipeline_actions 
DROP CONSTRAINT IF EXISTS pipeline_actions_deal_state_check;

ALTER TABLE pipeline_actions 
ADD CONSTRAINT pipeline_actions_deal_state_check 
CHECK (deal_state IN ('Aberto', 'Ganho', 'Perda'));