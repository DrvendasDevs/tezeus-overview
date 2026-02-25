-- Remover TODAS as políticas RLS das tabelas de conversas
-- Mantém RLS desabilitado mas limpa as políticas antigas que estão bloqueando real-time

-- Conversations
DROP POLICY IF EXISTS "workspace_members_can_select_conversations" ON public.conversations;
DROP POLICY IF EXISTS "workspace_members_can_insert_conversations" ON public.conversations;
DROP POLICY IF EXISTS "workspace_members_can_update_conversations" ON public.conversations;

-- Messages
DROP POLICY IF EXISTS "workspace_members_can_select_messages" ON public.messages;
DROP POLICY IF EXISTS "workspace_members_can_insert_messages" ON public.messages;
DROP POLICY IF EXISTS "workspace_members_can_update_messages" ON public.messages;

-- Notifications
DROP POLICY IF EXISTS "users_can_view_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "workspace_members_can_view_notifications" ON public.notifications;
DROP POLICY IF EXISTS "workspace_members_can_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "workspace_members_can_update_notifications" ON public.notifications;