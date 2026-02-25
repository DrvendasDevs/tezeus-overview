-- Adicionar RLS policies para notificações
-- Permitir que masters e admins vejam TODAS as notificações do workspace
-- Permitir que users vejam apenas as suas próprias notificações

-- Primeiro, habilitar RLS se não estiver habilitado
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_all" ON public.notifications;

-- Masters e Admins podem ver TODAS as notificações do workspace
CREATE POLICY "notifications_select_all"
ON public.notifications
FOR SELECT
USING (
  is_current_user_master() 
  OR 
  (is_current_user_admin() AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = notifications.workspace_id
    AND wm.user_id = current_system_user_id()
  ))
  OR
  user_id = current_system_user_id()
);

-- Masters e Admins podem atualizar TODAS as notificações do workspace
-- Users podem atualizar apenas suas próprias notificações
CREATE POLICY "notifications_update_all"
ON public.notifications
FOR UPDATE
USING (
  is_current_user_master() 
  OR 
  (is_current_user_admin() AND EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = notifications.workspace_id
    AND wm.user_id = current_system_user_id()
  ))
  OR
  user_id = current_system_user_id()
);

-- Permitir inserção apenas pelo sistema/service role
CREATE POLICY "notifications_insert_service"
ON public.notifications
FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role')::text = 'service_role'
);
