-- ============================================
-- TRIGGER DE AUDITORIA PARA ATIVIDADES
-- Registra criação, edição e exclusão de atividades
-- ============================================

-- Função de trigger para activities
CREATE OR REPLACE FUNCTION public.audit_activities_trigger()
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
  -- Buscar workspace_id através do contact_id
  IF TG_OP = 'DELETE' THEN
    SELECT workspace_id INTO v_workspace_id FROM contacts WHERE id = OLD.contact_id;
  ELSE
    SELECT workspace_id INTO v_workspace_id FROM contacts WHERE id = NEW.contact_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'activity.created';
    v_new_data := jsonb_build_object(
      'type', NEW.type,
      'subject', NEW.subject,
      'description', NEW.description,
      'scheduled_for', NEW.scheduled_for,
      'duration_minutes', NEW.duration_minutes,
      'contact_id', NEW.contact_id,
      'responsible_id', NEW.responsible_id,
      'is_completed', NEW.is_completed
    );
    v_entity_name := NEW.subject;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'activity', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Verificar se houve mudança relevante
    IF OLD.type IS DISTINCT FROM NEW.type 
       OR OLD.subject IS DISTINCT FROM NEW.subject 
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for
       OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
       OR OLD.responsible_id IS DISTINCT FROM NEW.responsible_id
       OR OLD.is_completed IS DISTINCT FROM NEW.is_completed THEN
      
      v_action := 'activity.updated';
      v_old_data := jsonb_build_object(
        'type', OLD.type, 
        'subject', OLD.subject, 
        'description', OLD.description,
        'scheduled_for', OLD.scheduled_for,
        'duration_minutes', OLD.duration_minutes,
        'responsible_id', OLD.responsible_id,
        'is_completed', OLD.is_completed
      );
      v_new_data := jsonb_build_object(
        'type', NEW.type, 
        'subject', NEW.subject, 
        'description', NEW.description,
        'scheduled_for', NEW.scheduled_for,
        'duration_minutes', NEW.duration_minutes,
        'responsible_id', NEW.responsible_id,
        'is_completed', NEW.is_completed
      );
      v_entity_name := NEW.subject;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_action, 'activity', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data, 'trigger'
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'activity.deleted';
    v_old_data := jsonb_build_object(
      'type', OLD.type, 
      'subject', OLD.subject, 
      'description', OLD.description,
      'scheduled_for', OLD.scheduled_for,
      'duration_minutes', OLD.duration_minutes,
      'contact_id', OLD.contact_id,
      'responsible_id', OLD.responsible_id
    );
    v_entity_name := OLD.subject;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'activity', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Dropar trigger existente se houver
DROP TRIGGER IF EXISTS audit_activities ON public.activities;

-- Criar trigger para INSERT, UPDATE e DELETE
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.audit_activities_trigger();

-- Comentário para documentação
COMMENT ON FUNCTION public.audit_activities_trigger() IS 'Trigger de auditoria para registrar criação, edição e exclusão de atividades';
