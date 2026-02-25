-- Remover foreign key constraint do changed_by se existir
-- (pode estar apontando para auth.users, mas o sistema usa system_users)
ALTER TABLE pipeline_card_history 
DROP CONSTRAINT IF EXISTS pipeline_card_history_changed_by_fkey;

-- Se necessário, podemos adicionar uma nova constraint para system_users
-- Mas por enquanto, vamos deixar sem constraint para permitir flexibilidade
-- O sistema já armazena o ID do system_users no metadata

