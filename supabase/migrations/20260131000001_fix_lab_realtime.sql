-- ============================================================================
-- Migration: Corrigir Realtime para tabelas do Laboratório
-- Descrição: Configura REPLICA IDENTITY e adiciona à publicação
-- ============================================================================

-- 1. Configurar REPLICA IDENTITY FULL para permitir filtros no Realtime
ALTER TABLE lab_messages REPLICA IDENTITY FULL;
ALTER TABLE lab_action_logs REPLICA IDENTITY FULL;
ALTER TABLE lab_sessions REPLICA IDENTITY FULL;

-- 2. Adicionar à publicação do Realtime (ignora erro se já existir)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE lab_messages;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'lab_messages já está na publicação';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE lab_action_logs;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'lab_action_logs já está na publicação';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE lab_sessions;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'lab_sessions já está na publicação';
END $$;
