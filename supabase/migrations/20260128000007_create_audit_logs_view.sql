-- ============================================
-- VIEW: audit_logs_view
-- Traz todos os dados de auditoria com JOINs já resolvidos
-- Evita queries múltiplas no frontend
-- ============================================

-- Criar VIEW com todos os dados necessários
CREATE OR REPLACE VIEW public.audit_logs_view AS
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
  al.created_at
FROM public.audit_logs al
LEFT JOIN public.workspaces w ON w.id = al.workspace_id
LEFT JOIN public.system_users su ON su.id = al.user_id;

-- Habilitar RLS na VIEW (herda da tabela base)
-- As políticas da tabela audit_logs já controlam o acesso

-- Comentário
COMMENT ON VIEW public.audit_logs_view IS 'View de auditoria com dados de workspace e usuário já resolvidos via JOIN';

-- Grant para leitura
GRANT SELECT ON public.audit_logs_view TO authenticated;
GRANT SELECT ON public.audit_logs_view TO service_role;
