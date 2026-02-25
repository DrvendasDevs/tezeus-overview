-- Corrigir políticas RLS para workspace_business_hours - Versão 2
-- Esta migration usa uma abordagem mais direta verificando workspace_members explicitamente

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "workspace_business_hours_master_all" ON public.workspace_business_hours;
DROP POLICY IF EXISTS "workspace_business_hours_admin_manage" ON public.workspace_business_hours;
DROP POLICY IF EXISTS "workspace_business_hours_user_read" ON public.workspace_business_hours;

-- Política 1: Masters podem fazer tudo
CREATE POLICY "workspace_business_hours_master_all"
  ON public.workspace_business_hours
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.system_users su 
      WHERE su.id = public.current_system_user_id() 
      AND su.profile = 'master'
    )
  );

-- Política 2: Admins podem gerenciar (INSERT, UPDATE, DELETE)
-- Para INSERT/UPDATE, verifica o workspace_id da linha sendo inserida/atualizada
CREATE POLICY "workspace_business_hours_admin_insert"
  ON public.workspace_business_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.system_users su ON su.id = wm.user_id
      WHERE wm.workspace_id = workspace_business_hours.workspace_id
      AND wm.user_id = public.current_system_user_id()
      AND (
        su.profile = 'admin' OR su.profile = 'master'
      )
    )
  );

CREATE POLICY "workspace_business_hours_admin_update"
  ON public.workspace_business_hours
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.system_users su ON su.id = wm.user_id
      WHERE wm.workspace_id = workspace_business_hours.workspace_id
      AND wm.user_id = public.current_system_user_id()
      AND (
        su.profile = 'admin' OR su.profile = 'master'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.system_users su ON su.id = wm.user_id
      WHERE wm.workspace_id = workspace_business_hours.workspace_id
      AND wm.user_id = public.current_system_user_id()
      AND (
        su.profile = 'admin' OR su.profile = 'master'
      )
    )
  );

CREATE POLICY "workspace_business_hours_admin_delete"
  ON public.workspace_business_hours
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      JOIN public.system_users su ON su.id = wm.user_id
      WHERE wm.workspace_id = workspace_business_hours.workspace_id
      AND wm.user_id = public.current_system_user_id()
      AND (
        su.profile = 'admin' OR su.profile = 'master'
      )
    )
  );

-- Política 3: Usuários podem visualizar
CREATE POLICY "workspace_business_hours_user_read"
  ON public.workspace_business_hours
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_business_hours.workspace_id
      AND wm.user_id = public.current_system_user_id()
    )
  );

