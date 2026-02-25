-- Remover TODAS as políticas de pipeline_actions
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'pipeline_actions' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON pipeline_actions', pol.policyname);
    END LOOP;
END $$;

-- Criar novas políticas simplificadas
-- SELECT: membros do workspace podem ver
CREATE POLICY "pipeline_actions_select"
ON pipeline_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = pipeline_actions.pipeline_id
    AND wm.user_id = current_system_user_id()
  )
  OR
  EXISTS (
    SELECT 1 FROM system_users su
    WHERE su.id = current_system_user_id()
    AND su.profile = 'master'
  )
);

-- INSERT: masters e admins podem criar
CREATE POLICY "pipeline_actions_insert"
ON pipeline_actions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = pipeline_actions.pipeline_id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
  OR
  EXISTS (
    SELECT 1 FROM system_users su
    WHERE su.id = current_system_user_id()
    AND su.profile = 'master'
  )
);

-- UPDATE: masters e admins podem atualizar
CREATE POLICY "pipeline_actions_update"
ON pipeline_actions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = pipeline_actions.pipeline_id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
  OR
  EXISTS (
    SELECT 1 FROM system_users su
    WHERE su.id = current_system_user_id()
    AND su.profile = 'master'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = pipeline_actions.pipeline_id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
  OR
  EXISTS (
    SELECT 1 FROM system_users su
    WHERE su.id = current_system_user_id()
    AND su.profile = 'master'
  )
);

-- DELETE: masters e admins podem deletar
CREATE POLICY "pipeline_actions_delete"
ON pipeline_actions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM pipelines p
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = pipeline_actions.pipeline_id
    AND wm.user_id = current_system_user_id()
    AND wm.role IN ('admin', 'master')
  )
  OR
  EXISTS (
    SELECT 1 FROM system_users su
    WHERE su.id = current_system_user_id()
    AND su.profile = 'master'
  )
);