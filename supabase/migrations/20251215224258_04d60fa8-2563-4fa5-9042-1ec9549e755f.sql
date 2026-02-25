-- Remover o cron job com URL errada
SELECT cron.unschedule('check-time-based-automations');

-- Recriar com a URL correta do projeto atual
SELECT cron.schedule(
  'check-time-based-automations',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zdrgvdlfhrbynpkvtyhx.supabase.co/functions/v1/check-time-based-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM"}'::jsonb,
      body := '{"trigger":"cron"}'::jsonb
    ) AS request_id;
  $$
);