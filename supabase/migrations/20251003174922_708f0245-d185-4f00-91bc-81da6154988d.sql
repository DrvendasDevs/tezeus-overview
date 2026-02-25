-- PASSO 1: Identificar e manter apenas o card mais recente de cada duplicata
-- Deletar cards duplicados (mesmo contact_id + pipeline_id com status 'aberto')

WITH duplicates AS (
  SELECT 
    id,
    contact_id,
    pipeline_id,
    ROW_NUMBER() OVER (
      PARTITION BY contact_id, pipeline_id 
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM pipeline_cards
  WHERE status = 'aberto'
)
DELETE FROM pipeline_cards
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- PASSO 2: Criar índice único para garantir que cada contato tenha apenas 1 card ABERTO por pipeline
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_contact_pipeline_open 
ON pipeline_cards(contact_id, pipeline_id) 
WHERE status = 'aberto';

-- Adicionar comentário explicativo
COMMENT ON INDEX idx_unique_contact_pipeline_open IS 
'Garante que cada contato tenha apenas um card aberto por pipeline, prevenindo duplicações';
