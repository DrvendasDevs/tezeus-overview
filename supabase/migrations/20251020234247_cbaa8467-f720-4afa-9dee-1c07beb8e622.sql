-- Remover todas as políticas RLS da tabela workspace_limits
DROP POLICY IF EXISTS "workspace_limits_service_and_master" ON workspace_limits;

-- Desabilitar RLS na tabela workspace_limits
ALTER TABLE workspace_limits DISABLE ROW LEVEL SECURITY;