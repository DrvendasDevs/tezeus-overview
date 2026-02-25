-- Atualiza cron job para verificar automações de tempo a cada 1 minuto
SELECT cron.unschedule('check-time-automations-every-5min');

SELECT cron.schedule(
  'check-time-automations-every-1min',
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

