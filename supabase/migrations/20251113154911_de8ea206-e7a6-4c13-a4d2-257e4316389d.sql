-- Adicionar coluna moved_to_column_at para rastrear quando o card foi movido para a coluna atual
ALTER TABLE pipeline_cards 
ADD COLUMN IF NOT EXISTS moved_to_column_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Atualizar cards existentes para usar a data de criação ou atualização como referência inicial
UPDATE pipeline_cards 
SET moved_to_column_at = COALESCE(updated_at, created_at)
WHERE moved_to_column_at IS NULL;

-- Criar função para atualizar moved_to_column_at quando a coluna mudar
CREATE OR REPLACE FUNCTION update_card_moved_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a coluna mudou, atualizar o timestamp
  IF NEW.column_id IS DISTINCT FROM OLD.column_id THEN
    NEW.moved_to_column_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar automaticamente quando mover o card
DROP TRIGGER IF EXISTS trigger_update_card_moved_at ON pipeline_cards;
CREATE TRIGGER trigger_update_card_moved_at
  BEFORE UPDATE ON pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_card_moved_at();

-- Criar cron job para verificar automações de tempo a cada minuto
SELECT cron.schedule(
  'check-pipeline-time-automations',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/pipeline-management/check-time-automations',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM"}'::jsonb
  ) as request_id;
  $$
);