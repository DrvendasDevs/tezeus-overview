-- =====================================================
-- CONFIGURAÇÃO COMPLETA DE REALTIME PARA PIPELINES
-- (Corrigido: tabelas já estão na publicação)
-- =====================================================

-- 1. Configurar REPLICA IDENTITY FULL para enviar dados completos nos eventos
ALTER TABLE pipeline_cards REPLICA IDENTITY FULL;
ALTER TABLE pipeline_columns REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE contact_tags REPLICA IDENTITY FULL;

-- 2. Criar índices para melhorar performance de queries realtime
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_pipeline_id 
  ON pipeline_cards(pipeline_id);
  
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_column_id 
  ON pipeline_cards(column_id);
  
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_contact_id 
  ON pipeline_cards(contact_id);
  
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_conversation_id 
  ON pipeline_cards(conversation_id);
  
CREATE INDEX IF NOT EXISTS idx_pipeline_columns_pipeline_id 
  ON pipeline_columns(pipeline_id);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id 
  ON conversations(workspace_id);

CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id 
  ON contact_tags(contact_id);