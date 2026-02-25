-- Temporariamente permitir que service role bypass RLS em workspace_limits
DROP POLICY IF EXISTS "workspace_limits_manage" ON public.workspace_limits;
DROP POLICY IF EXISTS "workspace_limits_select" ON public.workspace_limits;

-- Criar nova política que permite service role e master users
CREATE POLICY "workspace_limits_service_and_master" 
ON public.workspace_limits
FOR ALL
USING (
  (auth.jwt() ->> 'role')::text = 'service_role' OR 
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'gestor'::workspace_role)
)
WITH CHECK (
  (auth.jwt() ->> 'role')::text = 'service_role' OR 
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'gestor'::workspace_role)
);