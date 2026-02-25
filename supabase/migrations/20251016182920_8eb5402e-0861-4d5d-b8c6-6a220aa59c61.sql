-- Ativar realtime completo para a tabela notifications
-- Isso permitirá que mudanças nas notificações sejam transmitidas em tempo real

-- 1. Adicionar tabela notifications à publicação do Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. Configurar REPLICA IDENTITY FULL para enviar todos os campos nos eventos UPDATE
-- Isso é necessário para que o realtime transmita dados completos, não apenas a chave primária
ALTER TABLE notifications REPLICA IDENTITY FULL;