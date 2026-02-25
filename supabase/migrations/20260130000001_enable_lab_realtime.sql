-- ===========================================
-- LABORATÓRIO DE IA - Habilitar Realtime
-- ===========================================

-- Habilitar Realtime para as tabelas do laboratório
-- Isso permite que o frontend receba atualizações em tempo real

-- Adicionar tabelas à publicação do Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE lab_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE lab_action_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE lab_sessions;
