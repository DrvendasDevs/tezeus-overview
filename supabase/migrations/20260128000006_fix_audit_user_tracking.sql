-- ============================================
-- FIX DEFINITIVO: Auditoria com user_id explícito
-- Remove dependência de contexto de sessão (que não funciona com pool de conexões)
-- ============================================

-- 1. Criar função RPC para registrar auditoria do frontend
CREATE OR REPLACE FUNCTION public.register_audit_log(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Obter usuário atual da sessão (definido pelo RLS/JWT)
  v_user_id := public.current_system_user_id();
  
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
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
    metadata
  ) VALUES (
    p_workspace_id,
    v_user_id,
    v_user_name,
    v_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_name,
    p_old_data,
    p_new_data,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 2. Criar função RPC para registrar auditoria COM user_id explícito
-- Esta é a função principal que o frontend deve usar
CREATE OR REPLACE FUNCTION public.register_audit_log_with_user(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
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
    metadata
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
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 3. Desabilitar triggers automáticos (que não conseguem identificar o usuário corretamente)
-- Os logs serão registrados explicitamente pelo frontend
ALTER TABLE public.contacts DISABLE TRIGGER audit_contacts;
ALTER TABLE public.ai_agents DISABLE TRIGGER audit_ai_agents;
ALTER TABLE public.connections DISABLE TRIGGER audit_connections;
ALTER TABLE public.queues DISABLE TRIGGER audit_queues;
ALTER TABLE public.pipelines DISABLE TRIGGER audit_pipelines;
ALTER TABLE public.system_users DISABLE TRIGGER audit_system_users;
ALTER TABLE public.crm_column_automations DISABLE TRIGGER audit_automations;

-- 4. Comentários
COMMENT ON FUNCTION public.register_audit_log_with_user IS 'Registra log de auditoria com user_id explícito - usar no frontend para garantir identificação correta do executor';
