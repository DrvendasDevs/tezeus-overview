-- ============================================
-- SISTEMA DE AUDITORIA CENTRALIZADO
-- ============================================

-- 1. Criar tabela principal de auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.system_users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created 
ON public.audit_logs(workspace_id, created_at DESC);

-- 3. Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS - apenas masters e admins podem ver
CREATE POLICY "audit_logs_select_master" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.system_users su
      WHERE su.id = public.current_system_user_id()
      AND su.profile IN ('master', 'admin', 'gestor')
    )
  );

-- Service role pode inserir (para triggers e edge functions)
CREATE POLICY "audit_logs_insert_service" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- 5. Função helper para registrar auditoria
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_workspace_id UUID,
  p_user_id UUID,
  p_user_name TEXT,
  p_user_email TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT,
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
BEGIN
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
    p_user_name,
    p_user_email,
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

-- ============================================
-- TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ============================================

-- 6. Trigger para ai_agents
CREATE OR REPLACE FUNCTION public.audit_ai_agents_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_entity_name TEXT;
  v_workspace_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'agent.created';
    v_new_data := to_jsonb(NEW);
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_action, 'ai_agent', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'agent.updated';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    -- Só registrar se houve mudanças significativas
    IF OLD.name != NEW.name OR OLD.is_active != NEW.is_active OR 
       OLD.model != NEW.model OR OLD.system_instructions != NEW.system_instructions THEN
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_action, 'ai_agent', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'agent.deleted';
    v_old_data := to_jsonb(OLD);
    v_entity_name := OLD.name;
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_action, 'ai_agent', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_ai_agents ON public.ai_agents;
CREATE TRIGGER audit_ai_agents
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.audit_ai_agents_trigger();

-- 7. Trigger para system_users
CREATE OR REPLACE FUNCTION public.audit_system_users_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_entity_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'user.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'profile', NEW.profile,
      'status', NEW.status
    );
    v_entity_name := NEW.name;
    
    INSERT INTO public.audit_logs (
      action, entity_type, entity_id, entity_name, new_data,
      user_name, user_email
    ) VALUES (
      v_action, 'user', NEW.id::TEXT, v_entity_name, v_new_data,
      NEW.name, NEW.email
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'user.updated';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'email', OLD.email,
      'profile', OLD.profile,
      'status', OLD.status
    );
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'profile', NEW.profile,
      'status', NEW.status
    );
    v_entity_name := NEW.name;
    
    -- Só registrar se houve mudanças significativas
    IF OLD.name != NEW.name OR OLD.email != NEW.email OR 
       OLD.profile != NEW.profile OR OLD.status != NEW.status THEN
      INSERT INTO public.audit_logs (
        action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_action, 'user', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'user.deleted';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'email', OLD.email,
      'profile', OLD.profile,
      'status', OLD.status
    );
    v_entity_name := OLD.name;
    
    INSERT INTO public.audit_logs (
      action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_action, 'user', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_system_users ON public.system_users;
CREATE TRIGGER audit_system_users
  AFTER INSERT OR UPDATE OR DELETE ON public.system_users
  FOR EACH ROW EXECUTE FUNCTION public.audit_system_users_trigger();

-- 8. Trigger para connections
CREATE OR REPLACE FUNCTION public.audit_connections_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_entity_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'connection.created';
    v_new_data := jsonb_build_object(
      'instance_name', NEW.instance_name,
      'status', NEW.status,
      'phone_number', NEW.phone_number
    );
    v_entity_name := NEW.instance_name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_action, 'connection', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Registrar mudanças de status significativas
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'connected' THEN
        v_action := 'connection.connected';
      ELSIF NEW.status = 'disconnected' THEN
        v_action := 'connection.disconnected';
      ELSE
        v_action := 'connection.status_changed';
      END IF;
      
      v_old_data := jsonb_build_object('status', OLD.status);
      v_new_data := jsonb_build_object('status', NEW.status);
      v_entity_name := NEW.instance_name;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_action, 'connection', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'connection.deleted';
    v_old_data := jsonb_build_object(
      'instance_name', OLD.instance_name,
      'status', OLD.status,
      'phone_number', OLD.phone_number
    );
    v_entity_name := OLD.instance_name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_action, 'connection', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_connections ON public.connections;
CREATE TRIGGER audit_connections
  AFTER INSERT OR UPDATE OR DELETE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_connections_trigger();

-- 9. Trigger para queues
CREATE OR REPLACE FUNCTION public.audit_queues_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_entity_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'queue.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'description', NEW.description
    );
    v_entity_name := NEW.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_action, 'queue', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'queue.updated';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'description', OLD.description
    );
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'description', NEW.description
    );
    v_entity_name := NEW.name;
    
    IF OLD.name != NEW.name OR COALESCE(OLD.description, '') != COALESCE(NEW.description, '') THEN
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_action, 'queue', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'queue.deleted';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'description', OLD.description
    );
    v_entity_name := OLD.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_action, 'queue', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_queues ON public.queues;
CREATE TRIGGER audit_queues
  AFTER INSERT OR UPDATE OR DELETE ON public.queues
  FOR EACH ROW EXECUTE FUNCTION public.audit_queues_trigger();

-- 10. Trigger para pipelines
CREATE OR REPLACE FUNCTION public.audit_pipelines_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_entity_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'pipeline.created';
    v_new_data := jsonb_build_object('name', NEW.name);
    v_entity_name := NEW.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_action, 'pipeline', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name != NEW.name THEN
      v_action := 'pipeline.updated';
      v_old_data := jsonb_build_object('name', OLD.name);
      v_new_data := jsonb_build_object('name', NEW.name);
      v_entity_name := NEW.name;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_action, 'pipeline', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'pipeline.deleted';
    v_old_data := jsonb_build_object('name', OLD.name);
    v_entity_name := OLD.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_action, 'pipeline', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_pipelines ON public.pipelines;
CREATE TRIGGER audit_pipelines
  AFTER INSERT OR UPDATE OR DELETE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION public.audit_pipelines_trigger();

-- 11. Trigger para contacts (apenas DELETE)
CREATE OR REPLACE FUNCTION public.audit_contacts_delete_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    workspace_id, action, entity_type, entity_id, entity_name, old_data
  ) VALUES (
    OLD.workspace_id, 
    'contact.deleted', 
    'contact', 
    OLD.id::TEXT, 
    COALESCE(OLD.name, OLD.phone),
    jsonb_build_object(
      'name', OLD.name,
      'phone', OLD.phone,
      'email', OLD.email
    )
  );
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_contacts_delete ON public.contacts;
CREATE TRIGGER audit_contacts_delete
  AFTER DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_contacts_delete_trigger();

-- 12. Trigger para crm_column_automations
CREATE OR REPLACE FUNCTION public.audit_automations_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_workspace_id UUID;
BEGIN
  -- Buscar workspace_id via pipeline_column -> pipeline
  IF TG_OP = 'DELETE' THEN
    SELECT p.workspace_id INTO v_workspace_id
    FROM public.pipeline_columns pc
    JOIN public.pipelines p ON p.id = pc.pipeline_id
    WHERE pc.id = OLD.column_id;
  ELSE
    SELECT p.workspace_id INTO v_workspace_id
    FROM public.pipeline_columns pc
    JOIN public.pipelines p ON p.id = pc.pipeline_id
    WHERE pc.id = NEW.column_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'automation.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'is_active', NEW.is_active
    );
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_action, 'automation', NEW.id::TEXT, NEW.name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'automation.updated';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'is_active', OLD.is_active
    );
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'is_active', NEW.is_active
    );
    
    IF OLD.name != NEW.name OR OLD.is_active != NEW.is_active THEN
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_action, 'automation', NEW.id::TEXT, NEW.name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'automation.deleted';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'is_active', OLD.is_active
    );
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_action, 'automation', OLD.id::TEXT, OLD.name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_automations ON public.crm_column_automations;
CREATE TRIGGER audit_automations
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_column_automations
  FOR EACH ROW EXECUTE FUNCTION public.audit_automations_trigger();

-- 13. Comentários
COMMENT ON TABLE public.audit_logs IS 'Sistema centralizado de auditoria para rastrear todas as ações críticas do sistema';
COMMENT ON COLUMN public.audit_logs.action IS 'Tipo da ação: entity.action (ex: agent.deleted, user.created)';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'Tipo da entidade: ai_agent, user, connection, queue, pipeline, contact, automation';
COMMENT ON COLUMN public.audit_logs.old_data IS 'Estado anterior da entidade (para updates e deletes)';
COMMENT ON COLUMN public.audit_logs.new_data IS 'Novo estado da entidade (para inserts e updates)';
