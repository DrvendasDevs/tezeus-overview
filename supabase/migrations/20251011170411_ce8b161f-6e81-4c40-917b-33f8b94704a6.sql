-- Corrigir RLS para permitir realtime de pipeline_cards funcionar

-- 1. Remover política restritiva atual que bloqueia realtime
DROP POLICY IF EXISTS "Users can view pipeline cards based on responsibility_v4" ON pipeline_cards;

-- 2. Criar nova política permissiva para SELECT (necessária para realtime funcionar)
-- A filtragem por responsabilidade será feita no frontend
CREATE POLICY "Users can view all pipeline cards in their workspace"
ON pipeline_cards
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_cards.pipeline_id
      AND (
        is_current_user_master() 
        OR is_workspace_member(p.workspace_id, 'user'::system_profile)
      )
  )
);