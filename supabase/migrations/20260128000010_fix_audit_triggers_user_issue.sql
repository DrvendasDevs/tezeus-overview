-- Desabilitar triggers de auditoria para usar logging via frontend
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_contacts') THEN
    ALTER TABLE public.contacts DISABLE TRIGGER audit_contacts;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_ai_agents') THEN
    ALTER TABLE public.ai_agents DISABLE TRIGGER audit_ai_agents;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_system_users') THEN
    ALTER TABLE public.system_users DISABLE TRIGGER audit_system_users;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_connections') THEN
    ALTER TABLE public.connections DISABLE TRIGGER audit_connections;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_queues') THEN
    ALTER TABLE public.queues DISABLE TRIGGER audit_queues;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_pipelines') THEN
    ALTER TABLE public.pipelines DISABLE TRIGGER audit_pipelines;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_crm_column_automations') THEN
    ALTER TABLE public.crm_column_automations DISABLE TRIGGER audit_crm_column_automations;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_tags') THEN
    ALTER TABLE public.tags DISABLE TRIGGER audit_tags;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_products') THEN
    ALTER TABLE public.products DISABLE TRIGGER audit_products;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_quick_messages') THEN
    ALTER TABLE public.quick_messages DISABLE TRIGGER audit_quick_messages;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_quick_audios') THEN
    ALTER TABLE public.quick_audios DISABLE TRIGGER audit_quick_audios;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_quick_media') THEN
    ALTER TABLE public.quick_media DISABLE TRIGGER audit_quick_media;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_quick_documents') THEN
    ALTER TABLE public.quick_documents DISABLE TRIGGER audit_quick_documents;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_quick_funnels') THEN
    ALTER TABLE public.quick_funnels DISABLE TRIGGER audit_quick_funnels;
  END IF;
END;
$$;
