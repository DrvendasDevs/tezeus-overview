-- Verificar e garantir que o cron job de automações de tempo está ativo
-- Esta migration verifica se o cron job existe e o recria se necessário

-- Remover cron jobs antigos se existirem
DO $$
BEGIN
  PERFORM cron.unschedule('check-time-automations-every-5min');
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Cron job check-time-automations-every-5min não encontrado (ok)';
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-pipeline-time-automations');
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Cron job check-pipeline-time-automations não encontrado (ok)';
END $$;

-- Verificar se o cron job atual existe
DO $$
DECLARE
  cron_job_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'check-time-automations-every-1min'
  ) INTO cron_job_exists;

  IF NOT cron_job_exists THEN
    RAISE NOTICE '📅 Cron job check-time-automations-every-1min não encontrado. Criando...';
  ELSE
    RAISE NOTICE '✅ Cron job check-time-automations-every-1min já existe';
  END IF;
END $$;

-- Criar/recriar o cron job (usando valores hardcoded por enquanto)
-- NOTA: Em produção, estes valores devem vir de variáveis de ambiente
SELECT cron.schedule(
  'check-time-automations-every-1min',
  '* * * * *', -- A cada minuto
  $$
  SELECT
    net.http_post(
      url := 'https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/check-time-based-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM"}'::jsonb,
      body := '{"trigger":"cron"}'::jsonb
    ) AS request_id;
  $$
) ON CONFLICT (jobname) DO NOTHING;

