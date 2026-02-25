-- Atualizar o API token correto para o workspace padrão
UPDATE evolution_instance_tokens 
SET token = '53BF9C125C14E977E85DB56879759'
WHERE workspace_id = '00000000-0000-0000-0000-000000000000' 
AND instance_name = '_master_config';

-- Se não existir o registro, criar um
INSERT INTO evolution_instance_tokens (workspace_id, instance_name, token, evolution_url)
SELECT '00000000-0000-0000-0000-000000000000', '_master_config', '53BF9C125C14E977E85DB56879759', 'https://evolution-evolution.upvzfg.easypanel.host'
WHERE NOT EXISTS (
  SELECT 1 FROM evolution_instance_tokens 
  WHERE workspace_id = '00000000-0000-0000-0000-000000000000' 
  AND instance_name = '_master_config'
);