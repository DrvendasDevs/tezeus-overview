-- Configurar REPLICA IDENTITY FULL para permitir realtime completo em pipeline_cards
ALTER TABLE pipeline_cards REPLICA IDENTITY FULL;
ALTER TABLE pipeline_columns REPLICA IDENTITY FULL;