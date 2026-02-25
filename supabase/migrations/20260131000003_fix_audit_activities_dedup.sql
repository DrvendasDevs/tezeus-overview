-- =============================================
-- Migração: Corrigir trigger de auditoria de atividades para evitar duplicação
-- =============================================
-- Problema: Quando uma operação é feita pelo frontend, ela registra a auditoria via RPC (source='frontend')
-- e também dispara o trigger que registra com source='trigger', causando duplicação.
-- Solução: O trigger verifica se já existe um log recente (últimos 10 segundos) para a mesma entidade e ação.
-- Se existir, o trigger não cria um novo log.

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
  v_entity_id TEXT;
  v_existing_log_count INT;
BEGIN
  -- Determinar workspace_id a partir do contato
  IF TG_OP = 'DELETE' THEN
    SELECT workspace_id INTO v_workspace_id FROM contacts WHERE id = OLD.contact_id;
    v_entity_id := OLD.id::TEXT;
  ELSE
    SELECT workspace_id INTO v_workspace_id FROM contacts WHERE id = NEW.contact_id;
    v_entity_id := NEW.id::TEXT;
  END IF;

  -- Determinar a ação
  IF TG_OP = 'INSERT' THEN
    v_action := 'activity.created';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'activity.updated';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'activity.deleted';
  END IF;

  -- Verificar se já existe um log recente do frontend para esta entidade e ação
  -- Se existir, não criar duplicata via trigger
  SELECT COUNT(*) INTO v_existing_log_count
  FROM public.audit_logs
  WHERE entity_type = 'activity'
    AND entity_id = v_entity_id
    AND action = v_action
    AND source = 'frontend'
    AND created_at > NOW() - INTERVAL '10 seconds';

  IF v_existing_log_count > 0 THEN
    -- Já existe log do frontend, não duplicar
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Processar a operação normalmente se não houver duplicata
  IF TG_OP = 'INSERT' THEN
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
    
    INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, entity_name, new_data, source)
    VALUES (v_workspace_id, v_action, 'activity', v_entity_id, v_entity_name, v_new_data, 'trigger');
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só auditar se houve mudança significativa
    IF OLD.type IS DISTINCT FROM NEW.type
       OR OLD.subject IS DISTINCT FROM NEW.subject
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for
       OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
       OR OLD.responsible_id IS DISTINCT FROM NEW.responsible_id
       OR OLD.is_completed IS DISTINCT FROM NEW.is_completed
    THEN
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
      
      INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source)
      VALUES (v_workspace_id, v_action, 'activity', v_entity_id, v_entity_name, v_old_data, v_new_data, 'trigger');
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
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
    
    INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, entity_name, old_data, source)
    VALUES (v_workspace_id, v_action, 'activity', v_entity_id, v_entity_name, v_old_data, 'trigger');
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Recriar o trigger se necessário
DROP TRIGGER IF EXISTS audit_activities ON public.activities;
CREATE TRIGGER audit_activities
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_activities_trigger();

COMMENT ON FUNCTION public.audit_activities_trigger() IS 'Trigger de auditoria para atividades com deduplicação. Não cria log duplicado quando já existe um log recente do frontend.';
