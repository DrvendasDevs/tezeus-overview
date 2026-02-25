-- Ativar RLS em todas as tabelas que estão sem RLS habilitado
ALTER TABLE public.ai_agent_knowledge_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instance_user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_user_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_webhook_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_webhook_settings ENABLE ROW LEVEL SECURITY;