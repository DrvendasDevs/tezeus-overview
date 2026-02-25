-- Atualizar conversas existentes para associar à conexão disponível
UPDATE public.conversations 
SET connection_id = 'faa3bae2-04ba-4626-a679-5c84a17f5d8c'
WHERE workspace_id = '9379d213-8df0-47a8-a1b0-9d71e036fa5d' 
AND connection_id IS NULL;