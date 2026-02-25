-- Remover todas as políticas RLS da tabela notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications for themselves" ON public.notifications;

-- Desabilitar RLS na tabela notifications
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;