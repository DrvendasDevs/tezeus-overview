-- Remover políticas antigas de pipeline_actions
DROP POLICY IF EXISTS "Masters and admins can create pipeline actions" ON pipeline_actions;
DROP POLICY IF EXISTS "Masters and admins can delete pipeline actions" ON pipeline_actions;
DROP POLICY IF EXISTS "Masters and admins can update pipeline actions" ON pipeline_actions;
DROP POLICY IF EXISTS "Users can view pipeline actions in their workspace" ON pipeline_actions;

-- Criar novas políticas que funcionam tanto com edge functions quanto com cliente direto
-- Política de SELECT: qualquer usuário que tenha acesso ao workspace pode ver as ações
CREATE POLICY "Users can view pipeline actions"
ON pipeline_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id
    AND (
      -- Master global
      EXISTS (
        SELECT 1 FROM system_users su
        WHERE su.id = current_system_user_id()
        AND su.profile = 'master'
      )
      OR
      -- Membro do workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = current_system_user_id()
      )
    )
  )
);

-- Política de INSERT: masters e admins podem criar
CREATE POLICY "Masters and admins can create pipeline actions"
ON pipeline_actions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id
    AND (
      -- Master global
      EXISTS (
        SELECT 1 FROM system_users su
        WHERE su.id = current_system_user_id()
        AND su.profile = 'master'
      )
      OR
      -- Admin do workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = current_system_user_id()
        AND wm.role IN ('admin', 'master')
      )
    )
  )
);

-- Política de UPDATE: masters e admins podem atualizar
CREATE POLICY "Masters and admins can update pipeline actions"
ON pipeline_actions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id
    AND (
      -- Master global
      EXISTS (
        SELECT 1 FROM system_users su
        WHERE su.id = current_system_user_id()
        AND su.profile = 'master'
      )
      OR
      -- Admin do workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = current_system_user_id()
        AND wm.role IN ('admin', 'master')
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id
    AND (
      -- Master global
      EXISTS (
        SELECT 1 FROM system_users su
        WHERE su.id = current_system_user_id()
        AND su.profile = 'master'
      )
      OR
      -- Admin do workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = current_system_user_id()
        AND wm.role IN ('admin', 'master')
      )
    )
  )
);

-- Política de DELETE: masters e admins podem deletar
CREATE POLICY "Masters and admins can delete pipeline actions"
ON pipeline_actions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    WHERE p.id = pipeline_actions.pipeline_id
    AND (
      -- Master global
      EXISTS (
        SELECT 1 FROM system_users su
        WHERE su.id = current_system_user_id()
        AND su.profile = 'master'
      )
      OR
      -- Admin do workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = p.workspace_id
        AND wm.user_id = current_system_user_id()
        AND wm.role IN ('admin', 'master')
      )
    )
  )
);