-- Limpar histórico antigo de execuções do cron para destravar
TRUNCATE cron.job_run_details;

-- Recriar o job com a configuração correta
SELECT cron.unschedule('check-time-based-automations');

SELECT cron.schedule(
  'check-time-based-automations',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/check-time-based-automations',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM"}'::jsonb,
      body := '{"trigger":"cron"}'::jsonb
    ) AS request_id;
  $$
);