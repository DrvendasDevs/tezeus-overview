-- Corrigir políticas RLS da tabela pipeline_actions para permitir múltiplas ações

-- 1. Remover políticas antigas
DROP POLICY IF EXISTS "Admins can manage pipeline actions" ON pipeline_actions;
DROP POLICY IF EXISTS "Users can view pipeline actions in their workspace" ON pipeline_actions;

-- 2. Criar nova política permissiva para INSERT (criar ações)
CREATE POLICY "Masters and admins can create pipeline actions"
ON pipeline_actions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
);

-- 3. Criar política para SELECT (visualizar ações)
CREATE POLICY "Users can view pipeline actions in their workspace"
ON pipeline_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'user'::system_profile)
    )
  )
);

-- 4. Criar política para UPDATE (atualizar ações)
CREATE POLICY "Masters and admins can update pipeline actions"
ON pipeline_actions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
);

-- 5. Criar política para DELETE (deletar ações)
CREATE POLICY "Masters and admins can delete pipeline actions"
ON pipeline_actions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
);

-- 6. Log para confirmar execução
DO $$
BEGIN
  RAISE NOTICE 'Políticas RLS de pipeline_actions atualizadas com sucesso';
END $$;