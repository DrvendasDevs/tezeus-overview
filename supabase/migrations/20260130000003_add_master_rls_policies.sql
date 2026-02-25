-- ============================================================================
-- Migration: Adicionar políticas RLS para usuário master
-- Descrição: Permite que usuários do tipo 'master' vejam todos os workspaces
--            e conexões para o funcionamento correto do Laboratório de IA
-- ============================================================================

-- 1. Política para workspaces: master pode ver todos
DO $$ 
BEGIN
  -- Dropar política antiga se existir
  DROP POLICY IF EXISTS "workspaces_master_select" ON workspaces;
  
  -- Criar nova política
  CREATE POLICY "workspaces_master_select" 
    ON workspaces 
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 
        FROM system_users 
        WHERE system_users.id = auth.uid() 
        AND system_users.profile = 'master'
      )
    );
    
  RAISE NOTICE 'Política workspaces_master_select criada com sucesso';
END $$;

-- 2. Política para connections: master pode ver todas
DO $$ 
BEGIN
  -- Dropar política antiga se existir
  DROP POLICY IF EXISTS "connections_master_select" ON connections;
  
  -- Criar nova política
  CREATE POLICY "connections_master_select" 
    ON connections 
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 
        FROM system_users 
        WHERE system_users.id = auth.uid() 
        AND system_users.profile = 'master'
      )
    );
    
  RAISE NOTICE 'Política connections_master_select criada com sucesso';
END $$;

-- 3. Verificar se as políticas foram criadas
DO $$
DECLARE
  ws_count INTEGER;
  conn_count INTEGER;
BEGIN
  -- Contar políticas de workspaces
  SELECT COUNT(*) INTO ws_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'workspaces'
  AND policyname LIKE '%master%';
  
  -- Contar políticas de connections
  SELECT COUNT(*) INTO conn_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'connections'
  AND policyname LIKE '%master%';
  
  RAISE NOTICE 'Políticas master para workspaces: %', ws_count;
  RAISE NOTICE 'Políticas master para connections: %', conn_count;
END $$;
