-- Cron jobs para automações de aniversário e datas sazonais
-- Executa a cada minuto para verificar se é hora de enviar

-- Remover crons anteriores se existirem (evitar duplicatas)
DO $$
BEGIN
  PERFORM cron.unschedule('check-birthday-automations-every-1min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-seasonal-automations-every-1min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Birthday automations cron
SELECT cron.schedule(
  'check-birthday-automations-every-1min',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zdrgvdlfhrbynpkvtyhx.supabase.co/functions/v1/check-birthday-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM"}'::jsonb,
      body := '{"trigger":"cron"}'::jsonb
    ) AS request_id;
  $$
);

-- Seasonal automations cron
SELECT cron.schedule(
  'check-seasonal-automations-every-1min',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zdrgvdlfhrbynpkvtyhx.supabase.co/functions/v1/check-seasonal-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM"}'::jsonb,
      body := '{"trigger":"cron"}'::jsonb
    ) AS request_id;
  $$
);
