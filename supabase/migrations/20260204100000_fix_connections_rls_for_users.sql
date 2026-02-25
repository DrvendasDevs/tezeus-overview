-- ============================================================================
-- Migration: Corrigir política RLS de connections para usuários
-- Descrição: Permite que todos os membros do workspace vejam as conexões
--            disponíveis (necessário para iniciar conversas)
-- ============================================================================

-- Dropar política antiga
DROP POLICY IF EXISTS "connections_select_by_role" ON public.connections;

-- Criar nova política mais permissiva para SELECT
-- Todos os membros do workspace podem VER as conexões (necessário para iniciar conversas)
-- Apenas admin/master podem criar/atualizar/deletar
CREATE POLICY "connections_select_by_role" ON public.connections
FOR SELECT USING (
  is_current_user_master() 
  OR is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Verificar se a política foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'connections' 
    AND policyname = 'connections_select_by_role'
  ) THEN
    RAISE NOTICE '✅ Política connections_select_by_role atualizada com sucesso';
  ELSE
    RAISE WARNING '❌ Falha ao criar política connections_select_by_role';
  END IF;
END $$;
