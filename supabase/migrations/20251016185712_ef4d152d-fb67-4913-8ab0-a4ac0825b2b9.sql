-- Permitir usuários criarem notificações para si mesmos
-- (necessário para testes e funcionalidades futuras)
CREATE POLICY "Users can create notifications for themselves"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = current_system_user_id());