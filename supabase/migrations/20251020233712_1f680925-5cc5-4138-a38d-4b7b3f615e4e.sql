-- Alterar os valores padrão da tabela workspace_limits para 0
ALTER TABLE workspace_limits 
ALTER COLUMN connection_limit SET DEFAULT 0,
ALTER COLUMN user_limit SET DEFAULT 0;

-- Atualizar registros existentes que tenham os valores antigos de 1 e 5 para 0
-- (isso não afeta registros customizados pelo usuário)
UPDATE workspace_limits 
SET connection_limit = 0 
WHERE connection_limit = 1;

UPDATE workspace_limits 
SET user_limit = 0 
WHERE user_limit = 5;