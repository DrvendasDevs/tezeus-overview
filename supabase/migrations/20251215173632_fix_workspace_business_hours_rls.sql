-- Corrigir políticas RLS para workspace_business_hours
-- Esta migration corrige as políticas para funcionar corretamente com INSERT/UPDATE

-- Remover políticas antigas
DROP POLICY IF EXISTS "workspace_business_hours_master_all" ON public.workspace_business_hours;
DROP POLICY IF EXISTS "workspace_business_hours_admin_manage" ON public.workspace_business_hours;
DROP POLICY IF EXISTS "workspace_business_hours_user_read" ON public.workspace_business_hours;

-- Política para Masters: podem gerenciar todos os horários
-- Usa a função is_current_user_master() se existir, caso contrário verifica diretamente
DO $$
BEGIN
  -- Verificar se a função is_current_user_master existe
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_current_user_master'
  ) THEN
    -- Usar a função existente
    EXECUTE '
    CREATE POLICY "workspace_business_hours_master_all"
      ON public.workspace_business_hours
      FOR ALL
      TO authenticated
      USING (is_current_user_master())
      WITH CHECK (is_current_user_master())';
  ELSE
    -- Criar política alternativa verificando diretamente
    EXECUTE '
    CREATE POLICY "workspace_business_hours_master_all"
      ON public.workspace_business_hours
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 
          FROM public.system_users su 
          WHERE su.id = public.current_system_user_id() 
          AND su.profile = ''master''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 
          FROM public.system_users su 
          WHERE su.id = public.current_system_user_id() 
          AND su.profile = ''master''
        )
      )';
  END IF;
END $$;

-- Política para Admins: podem gerenciar horários do seu workspace
-- A função is_workspace_member já lida com workspace_id corretamente
CREATE POLICY "workspace_business_hours_admin_manage"
  ON public.workspace_business_hours
  FOR ALL
  TO authenticated
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Política para Usuários: podem visualizar horários do seu workspace
CREATE POLICY "workspace_business_hours_user_read"
  ON public.workspace_business_hours
  FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

