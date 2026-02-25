-- ============================================
-- AUDITORIA HÍBRIDA: Adicionar campo source
-- Permite diferenciar ações do frontend vs diretas no banco
-- ============================================

-- 1. Adicionar campo source na tabela audit_logs
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'trigger';

-- Comentário
COMMENT ON COLUMN public.audit_logs.source IS 'Origem do log: frontend (via sistema) ou trigger (direto no banco)';

-- 2. Atualizar função RPC para aceitar source
CREATE OR REPLACE FUNCTION public.register_audit_log_with_user(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_source TEXT DEFAULT 'frontend'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Buscar dados do usuário
  IF p_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs (
    workspace_id,
    user_id,
    user_name,
    user_email,
    action,
    entity_type,
    entity_id,
    entity_name,
    old_data,
    new_data,
    metadata,
    source
  ) VALUES (
    p_workspace_id,
    p_user_id,
    v_user_name,
    v_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_data,
    p_new_data,
    p_metadata,
    p_source
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 3. Atualizar VIEW para incluir source
DROP VIEW IF EXISTS public.audit_logs_view;
CREATE VIEW public.audit_logs_view AS
SELECT 
  al.id,
  al.workspace_id,
  w.name AS workspace_name,
  al.user_id,
  COALESCE(al.user_name, su.name) AS user_name,
  COALESCE(al.user_email, su.email) AS user_email,
  al.action,
  al.entity_type,
  al.entity_id,
  al.entity_name,
  al.old_data,
  al.new_data,
  al.metadata,
  al.ip_address,
  al.user_agent,
  al.source,
  al.created_at
FROM public.audit_logs al
LEFT JOIN public.workspaces w ON w.id = al.workspace_id
LEFT JOIN public.system_users su ON su.id = al.user_id;

-- Grant para a VIEW
GRANT SELECT ON public.audit_logs_view TO authenticated;
GRANT SELECT ON public.audit_logs_view TO service_role;

-- 4. Reativar triggers (que capturam ações diretas no banco)
ALTER TABLE public.contacts ENABLE TRIGGER audit_contacts;
ALTER TABLE public.ai_agents ENABLE TRIGGER audit_ai_agents;
ALTER TABLE public.connections ENABLE TRIGGER audit_connections;
ALTER TABLE public.queues ENABLE TRIGGER audit_queues;
ALTER TABLE public.pipelines ENABLE TRIGGER audit_pipelines;
ALTER TABLE public.system_users ENABLE TRIGGER audit_system_users;
ALTER TABLE public.crm_column_automations ENABLE TRIGGER audit_automations;

-- 5. Atualizar triggers para usar source = 'trigger'
-- (Os triggers já inserem sem source, então o DEFAULT 'trigger' será usado)

-- 6. Marcar logs antigos como 'legacy' para diferenciar
UPDATE public.audit_logs 
SET source = 'legacy' 
WHERE source IS NULL OR source = 'trigger';
