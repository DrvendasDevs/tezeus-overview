-- ============================================
-- Fix: Auditoria de automações com origem correta
-- - Detectar system_user_id via JWT metadata
-- - Registrar source = 'frontend' quando ação vem do sistema
-- - Evitar duplicidade quando já houver log frontend recente
-- ============================================

-- 1) Melhorar detecção do usuário atual
CREATE OR REPLACE FUNCTION public.current_system_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims jsonb;
  v_user_id_text text;
BEGIN
  v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;

  v_user_id_text := COALESCE(
    NULLIF(current_setting('app.current_user_id', true), ''),
    NULLIF(v_claims->>'x-system-user-id', ''),
    NULLIF(v_claims->'user_metadata'->>'system_user_id', ''),
    NULLIF(v_claims->'app_metadata'->>'system_user_id', '')
  );

  IF v_user_id_text IS NULL OR v_user_id_text = '' THEN
    RETURN NULL;
  END IF;

  RETURN v_user_id_text::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.current_system_user_id() IS 'Retorna o system_user_id atual via contexto app ou JWT metadata';

-- 2) Ajustar trigger de automações para origem correta
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
  v_source TEXT;
  v_entity_id TEXT;
  v_existing_log_count INT;
BEGIN
  -- Capturar usuário atual
  v_user_id := public.current_system_user_id();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email
    FROM public.system_users WHERE id = v_user_id;
  END IF;

  v_source := CASE WHEN v_user_id IS NULL THEN 'trigger' ELSE 'frontend' END;

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
    v_entity_id := NEW.id::TEXT;

    -- Evitar duplicidade se o frontend já registrou
    IF v_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_log_count
      FROM public.audit_logs
      WHERE entity_type = 'automation'
        AND entity_id = v_entity_id
        AND action = v_action
        AND source = 'frontend'
        AND created_at > NOW() - INTERVAL '10 seconds';
      IF v_existing_log_count > 0 THEN
        RETURN NEW;
      END IF;
    END IF;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', v_entity_id, NEW.name, v_new_data, v_source
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
    v_entity_id := NEW.id::TEXT;
    
    IF OLD.name != NEW.name OR OLD.is_active != NEW.is_active THEN
      IF v_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_existing_log_count
        FROM public.audit_logs
        WHERE entity_type = 'automation'
          AND entity_id = v_entity_id
          AND action = v_action
          AND source = 'frontend'
          AND created_at > NOW() - INTERVAL '10 seconds';
        IF v_existing_log_count > 0 THEN
          RETURN NEW;
        END IF;
      END IF;

      INSERT INTO public.audit_logs (
        workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', v_entity_id, NEW.name, v_old_data, v_new_data, v_source
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'automation.deleted';
    v_old_data := jsonb_build_object(
      'name', OLD.name,
      'is_active', OLD.is_active
    );
    v_entity_id := OLD.id::TEXT;

    IF v_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_log_count
      FROM public.audit_logs
      WHERE entity_type = 'automation'
        AND entity_id = v_entity_id
        AND action = v_action
        AND source = 'frontend'
        AND created_at > NOW() - INTERVAL '10 seconds';
      IF v_existing_log_count > 0 THEN
        RETURN OLD;
      END IF;
    END IF;
    
    INSERT INTO public.audit_logs (
      workspace_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_user_id, v_user_name, v_user_email, v_action, 'automation', v_entity_id, OLD.name, v_old_data, v_source
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.audit_automations_trigger() IS 'Trigger de auditoria para automações com origem correta e deduplicação de logs do frontend';
