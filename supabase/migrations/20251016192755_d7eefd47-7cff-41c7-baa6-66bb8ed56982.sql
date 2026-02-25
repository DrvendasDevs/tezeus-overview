-- Habilitar Row Level Security na tabela notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Configurar REPLICA IDENTITY FULL para capturar todas as mudanças
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Criar política RLS para permitir que usuários vejam apenas suas próprias notificações
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = current_system_user_id());

-- Criar política RLS para permitir inserção de notificações pelo sistema
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Criar política RLS para permitir atualização de notificações pelo próprio usuário
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = current_system_user_id());