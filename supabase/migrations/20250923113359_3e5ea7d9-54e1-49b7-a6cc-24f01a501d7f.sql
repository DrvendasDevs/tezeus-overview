-- Verificar e corrigir política RLS para pipeline_columns
-- Primeiro, vamos debugar as políticas existentes

-- Verificar se o usuário tem permissão master
SELECT is_current_user_master() as is_master, current_system_user_id() as user_id;

-- Verificar se o usuário é membro do workspace
SELECT is_workspace_member('9379d213-8df0-47a8-a1b0-9d71e036fa5d'::uuid, 'admin'::system_profile) as is_workspace_admin;

-- Verificar política atual
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'pipeline_columns';

-- Recriar política para pipeline_columns com melhor debug
DROP POLICY IF EXISTS "Masters and admins can manage pipeline columns in their workspa" ON pipeline_columns;

CREATE POLICY "pipeline_columns_manage_by_workspace_admin" 
ON pipeline_columns 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_columns.pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pipelines p 
    WHERE p.id = pipeline_id 
    AND (
      is_current_user_master() 
      OR is_workspace_member(p.workspace_id, 'admin'::system_profile)
    )
  )
);