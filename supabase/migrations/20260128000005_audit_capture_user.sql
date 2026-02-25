-- ============================================
-- FIX: Capturar usuário executor nos triggers de auditoria
-- Usa current_system_user_id() para identificar quem fez a ação
-- ============================================

-- 1. Atualizar trigger de ai_agents
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'agent.created';
    v_new_data := to_jsonb(NEW);
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'ai_agent', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'agent.updated';
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    IF OLD.name != NEW.name OR OLD.is_active != NEW.is_active OR 
       OLD.model != NEW.model OR OLD.system_instructions != NEW.system_instructions THEN
      INSERT INTO public.audit_logs (
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'ai_agent', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'agent.deleted';
    v_old_data := to_jsonb(OLD);
    v_entity_name := OLD.name;
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'ai_agent', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 2. Atualizar trigger de system_users
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual (quem está fazendo a ação)
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

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
      user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_user_id, v_user_name, v_user_email, v_action, 'user', NEW.id::TEXT, v_entity_name, v_new_data
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
    
    IF OLD.name != NEW.name OR OLD.email != NEW.email OR 
       OLD.profile != NEW.profile OR OLD.status != NEW.status THEN
      INSERT INTO public.audit_logs (
        user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_user_id, v_user_name, v_user_email, v_action, 'user', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
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
      user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_user_id, v_user_name, v_user_email, v_action, 'user', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 3. Atualizar trigger de connections
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'connection.created';
    v_new_data := jsonb_build_object(
      'instance_name', NEW.instance_name,
      'status', NEW.status,
      'phone_number', NEW.phone_number
    );
    v_entity_name := NEW.instance_name;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'connection', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
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
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'connection', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
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
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'connection', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 4. Atualizar trigger de queues
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'queue.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'description', NEW.description
    );
    v_entity_name := NEW.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'queue', NEW.id::TEXT, v_entity_name, v_new_data
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
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'queue', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
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
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'queue', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 5. Atualizar trigger de pipelines
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'pipeline.created';
    v_new_data := jsonb_build_object('name', NEW.name);
    v_entity_name := NEW.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'pipeline', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name != NEW.name THEN
      v_action := 'pipeline.updated';
      v_old_data := jsonb_build_object('name', OLD.name);
      v_new_data := jsonb_build_object('name', NEW.name);
      v_entity_name := NEW.name;
      
      INSERT INTO public.audit_logs (
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        NEW.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'pipeline', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'pipeline.deleted';
    v_old_data := jsonb_build_object('name', OLD.name);
    v_entity_name := OLD.name;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      OLD.workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'pipeline', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 6. Atualizar trigger de contacts
CREATE OR REPLACE FUNCTION public.audit_contacts_trigger()
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'contact.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'phone', NEW.phone,
      'email', NEW.email
    );
    v_entity_name := COALESCE(NEW.name, NEW.phone);
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'contact', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name OR 
       OLD.phone IS DISTINCT FROM NEW.phone OR 
       OLD.email IS DISTINCT FROM NEW.email THEN
      v_action := 'contact.updated';
      v_old_data := jsonb_build_object(
        'name', OLD.name,
        'phone', OLD.phone,
        'email', OLD.email
      );
      v_new_data := jsonb_build_object(
        'name', NEW.name,
        'phone', NEW.phone,
        'email', NEW.email
      );
      v_entity_name := COALESCE(NEW.name, NEW.phone);
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.audit_logs (
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'contact', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'contact.deleted';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'phone', OLD.phone,
      'email', OLD.email
    );
    v_entity_name := COALESCE(OLD.name, OLD.phone);
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'contact', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 7. Atualizar trigger de automations
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
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

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
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', NEW.id::TEXT, NEW.name, v_new_data
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
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', NEW.id::TEXT, NEW.name, v_old_data, v_new_data
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
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', OLD.id::TEXT, OLD.name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Remover log de teste da migration anterior
DELETE FROM public.audit_logs WHERE action = 'test.migration';
