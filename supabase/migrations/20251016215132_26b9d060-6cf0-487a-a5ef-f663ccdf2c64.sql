-- Remover todas as policies da tabela notifications
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

-- Desabilitar RLS completamente na tabela notifications
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;