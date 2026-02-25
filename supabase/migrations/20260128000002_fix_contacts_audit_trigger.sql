-- ============================================
-- FIX: Trigger completo para contatos
-- Inclui INSERT, UPDATE e DELETE
-- ============================================

-- Remover trigger antigo (apenas DELETE)
DROP TRIGGER IF EXISTS audit_contacts_delete ON public.contacts;
DROP FUNCTION IF EXISTS public.audit_contacts_delete_trigger();

-- Criar trigger completo para contatos
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
BEGIN
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
      workspace_id, action, entity_type, entity_id, entity_name, new_data
    ) VALUES (
      v_workspace_id, v_action, 'contact', NEW.id::TEXT, v_entity_name, v_new_data
    );
    
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só registrar se houve mudanças significativas no nome, telefone ou email
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
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data
      ) VALUES (
        v_workspace_id, v_action, 'contact', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data
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
      workspace_id, action, entity_type, entity_id, entity_name, old_data
    ) VALUES (
      v_workspace_id, v_action, 'contact', OLD.id::TEXT, v_entity_name, v_old_data
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Criar trigger para INSERT, UPDATE e DELETE
DROP TRIGGER IF EXISTS audit_contacts ON public.contacts;
CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_contacts_trigger();

-- Atualizar labels de ações no comentário
COMMENT ON FUNCTION public.audit_contacts_trigger() IS 'Trigger de auditoria para contatos: criação, atualização e exclusão';
