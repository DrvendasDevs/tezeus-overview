-- ============================================
-- FIX: Habilitar triggers de auditoria
-- ============================================

-- Habilitar todos os triggers de auditoria
ALTER TABLE public.contacts ENABLE TRIGGER audit_contacts;
ALTER TABLE public.ai_agents ENABLE TRIGGER audit_ai_agents;
ALTER TABLE public.connections ENABLE TRIGGER audit_connections;
ALTER TABLE public.queues ENABLE TRIGGER audit_queues;
ALTER TABLE public.pipelines ENABLE TRIGGER audit_pipelines;
ALTER TABLE public.system_users ENABLE TRIGGER audit_system_users;
ALTER TABLE public.crm_column_automations ENABLE TRIGGER audit_automations;

-- Teste: inserir um log manualmente para verificar se funciona
DO $$
BEGIN
  INSERT INTO public.audit_logs (
    action, 
    entity_type, 
    entity_name, 
    new_data
  ) VALUES (
    'test.migration', 
    'system', 
    'Migration Test',
    jsonb_build_object('message', 'Triggers habilitados com sucesso')
  );
  
  RAISE NOTICE '✅ Teste de inserção em audit_logs bem sucedido!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Erro ao inserir em audit_logs: %', SQLERRM;
END $$;
