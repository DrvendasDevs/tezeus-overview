-- ============================================
-- TRIGGERS DE AUDITORIA ADICIONAIS
-- Tags, Produtos, Mensagens Rápidas, Áudios, Mídias, Documentos, Funis
-- ============================================

-- 1. Trigger para TAGS (etiquetas)
CREATE OR REPLACE FUNCTION public.audit_tags_trigger()
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
    v_action := 'tag.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'color', NEW.color
    );
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'tag', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name OR OLD.color IS DISTINCT FROM NEW.color THEN
      v_action := 'tag.updated';
      v_old_data := jsonb_build_object('name', OLD.name, 'color', OLD.color);
      v_new_data := jsonb_build_object('name', NEW.name, 'color', NEW.color);
      v_entity_name := NEW.name;
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_action, 'tag', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data, 'trigger'
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'tag.deleted';
    v_old_data := jsonb_build_object('name', OLD.name, 'color', OLD.color);
    v_entity_name := OLD.name;
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'tag', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_tags ON public.tags;
CREATE TRIGGER audit_tags
  AFTER INSERT OR UPDATE OR DELETE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.audit_tags_trigger();

-- 2. Trigger para PRODUCTS (produtos)
CREATE OR REPLACE FUNCTION public.audit_products_trigger()
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
    v_action := 'product.created';
    v_new_data := jsonb_build_object(
      'name', NEW.name,
      'price', NEW.price,
      'is_active', NEW.is_active
    );
    v_entity_name := NEW.name;
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'product', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.name IS DISTINCT FROM NEW.name OR OLD.price IS DISTINCT FROM NEW.price OR OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_action := 'product.updated';
      v_old_data := jsonb_build_object('name', OLD.name, 'price', OLD.price, 'is_active', OLD.is_active);
      v_new_data := jsonb_build_object('name', NEW.name, 'price', NEW.price, 'is_active', NEW.is_active);
      v_entity_name := NEW.name;
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_action, 'product', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data, 'trigger'
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'product.deleted';
    v_old_data := jsonb_build_object('name', OLD.name, 'price', OLD.price, 'is_active', OLD.is_active);
    v_entity_name := OLD.name;
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'product', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_products ON public.products;
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_products_trigger();

-- 3. Trigger para QUICK_MESSAGES (mensagens rápidas)
CREATE OR REPLACE FUNCTION public.audit_quick_messages_trigger()
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
    v_action := 'quick_message.created';
    v_new_data := jsonb_build_object(
      'title', NEW.title,
      'shortcut', NEW.shortcut
    );
    v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Mensagem Rápida');
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_message', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.title IS DISTINCT FROM NEW.title OR OLD.content IS DISTINCT FROM NEW.content THEN
      v_action := 'quick_message.updated';
      v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
      v_new_data := jsonb_build_object('title', NEW.title, 'shortcut', NEW.shortcut);
      v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Mensagem Rápida');
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_action, 'quick_message', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data, 'trigger'
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'quick_message.deleted';
    v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
    v_entity_name := COALESCE(OLD.title, OLD.shortcut, 'Mensagem Rápida');
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_message', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_quick_messages ON public.quick_messages;
CREATE TRIGGER audit_quick_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.quick_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_messages_trigger();

-- 4. Trigger para QUICK_AUDIOS (áudios rápidos)
CREATE OR REPLACE FUNCTION public.audit_quick_audios_trigger()
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
    v_action := 'quick_audio.created';
    v_new_data := jsonb_build_object(
      'title', NEW.title,
      'shortcut', NEW.shortcut
    );
    v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Áudio Rápido');
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_audio', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'quick_audio.deleted';
    v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
    v_entity_name := COALESCE(OLD.title, OLD.shortcut, 'Áudio Rápido');
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_audio', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_quick_audios ON public.quick_audios;
CREATE TRIGGER audit_quick_audios
  AFTER INSERT OR DELETE ON public.quick_audios
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_audios_trigger();

-- 5. Trigger para QUICK_MEDIA (mídias rápidas - imagens/vídeos)
CREATE OR REPLACE FUNCTION public.audit_quick_media_trigger()
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
    v_action := 'quick_media.created';
    v_new_data := jsonb_build_object(
      'title', NEW.title,
      'shortcut', NEW.shortcut,
      'media_type', NEW.media_type
    );
    v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Mídia Rápida');
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_media', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'quick_media.deleted';
    v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut, 'media_type', OLD.media_type);
    v_entity_name := COALESCE(OLD.title, OLD.shortcut, 'Mídia Rápida');
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_media', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_quick_media ON public.quick_media;
CREATE TRIGGER audit_quick_media
  AFTER INSERT OR DELETE ON public.quick_media
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_media_trigger();

-- 6. Trigger para QUICK_DOCUMENTS (documentos rápidos)
CREATE OR REPLACE FUNCTION public.audit_quick_documents_trigger()
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
    v_action := 'quick_document.created';
    v_new_data := jsonb_build_object(
      'title', NEW.title,
      'shortcut', NEW.shortcut
    );
    v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Documento Rápido');
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_document', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'quick_document.deleted';
    v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
    v_entity_name := COALESCE(OLD.title, OLD.shortcut, 'Documento Rápido');
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_document', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_quick_documents ON public.quick_documents;
CREATE TRIGGER audit_quick_documents
  AFTER INSERT OR DELETE ON public.quick_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_documents_trigger();

-- 7. Trigger para QUICK_FUNNELS (funis rápidos)
CREATE OR REPLACE FUNCTION public.audit_quick_funnels_trigger()
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
    v_action := 'quick_funnel.created';
    v_new_data := jsonb_build_object(
      'title', NEW.title,
      'shortcut', NEW.shortcut
    );
    v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Funil Rápido');
    v_workspace_id := NEW.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, new_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_funnel', NEW.id::TEXT, v_entity_name, v_new_data, 'trigger'
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_action := 'quick_funnel.updated';
      v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
      v_new_data := jsonb_build_object('title', NEW.title, 'shortcut', NEW.shortcut);
      v_entity_name := COALESCE(NEW.title, NEW.shortcut, 'Funil Rápido');
      v_workspace_id := NEW.workspace_id;
      
      INSERT INTO public.audit_logs (
        workspace_id, action, entity_type, entity_id, entity_name, old_data, new_data, source
      ) VALUES (
        v_workspace_id, v_action, 'quick_funnel', NEW.id::TEXT, v_entity_name, v_old_data, v_new_data, 'trigger'
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'quick_funnel.deleted';
    v_old_data := jsonb_build_object('title', OLD.title, 'shortcut', OLD.shortcut);
    v_entity_name := COALESCE(OLD.title, OLD.shortcut, 'Funil Rápido');
    v_workspace_id := OLD.workspace_id;
    
    INSERT INTO public.audit_logs (
      workspace_id, action, entity_type, entity_id, entity_name, old_data, source
    ) VALUES (
      v_workspace_id, v_action, 'quick_funnel', OLD.id::TEXT, v_entity_name, v_old_data, 'trigger'
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_quick_funnels ON public.quick_funnels;
CREATE TRIGGER audit_quick_funnels
  AFTER INSERT OR UPDATE OR DELETE ON public.quick_funnels
  FOR EACH ROW EXECUTE FUNCTION public.audit_quick_funnels_trigger();

-- Comentários
COMMENT ON FUNCTION public.audit_tags_trigger() IS 'Trigger de auditoria para tags/etiquetas';
COMMENT ON FUNCTION public.audit_products_trigger() IS 'Trigger de auditoria para produtos';
COMMENT ON FUNCTION public.audit_quick_messages_trigger() IS 'Trigger de auditoria para mensagens rápidas';
COMMENT ON FUNCTION public.audit_quick_audios_trigger() IS 'Trigger de auditoria para áudios rápidos';
COMMENT ON FUNCTION public.audit_quick_media_trigger() IS 'Trigger de auditoria para mídias rápidas (imagens/vídeos)';
COMMENT ON FUNCTION public.audit_quick_documents_trigger() IS 'Trigger de auditoria para documentos rápidos';
COMMENT ON FUNCTION public.audit_quick_funnels_trigger() IS 'Trigger de auditoria para funis rápidos';
