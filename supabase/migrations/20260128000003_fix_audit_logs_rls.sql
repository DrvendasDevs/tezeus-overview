-- ============================================
-- FIX: Políticas RLS para audit_logs
-- Garantir que triggers SECURITY DEFINER possam inserir
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "audit_logs_select_master" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_service" ON public.audit_logs;

-- Política de SELECT - apenas masters, admins e gestores podem ver
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.system_users su
      WHERE su.id = public.current_system_user_id()
      AND su.profile IN ('master', 'admin', 'gestor')
    )
  );

-- Política de INSERT - permitir inserção para triggers (SECURITY DEFINER bypass RLS)
-- Como os triggers usam SECURITY DEFINER, precisamos de uma política mais permissiva
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- IMPORTANTE: Garantir que service_role possa bypass RLS
-- E que triggers SECURITY DEFINER funcionem
GRANT INSERT ON public.audit_logs TO authenticated;
GRANT INSERT ON public.audit_logs TO service_role;
GRANT SELECT ON public.audit_logs TO authenticated;

-- Verificar se os triggers existem e estão ativos
DO $$
BEGIN
  -- Verificar trigger de contatos
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_contacts' 
    AND tgrelid = 'public.contacts'::regclass
  ) THEN
    RAISE NOTICE 'AVISO: Trigger audit_contacts não encontrado na tabela contacts';
  END IF;
  
  -- Verificar trigger de ai_agents
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'audit_ai_agents' 
    AND tgrelid = 'public.ai_agents'::regclass
  ) THEN
    RAISE NOTICE 'AVISO: Trigger audit_ai_agents não encontrado na tabela ai_agents';
  END IF;
END $$;
