-- Criar cron job para monitorar alertas de providers a cada 5 minutos
SELECT cron.schedule(
  'monitor-provider-alerts-every-5-min',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/monitor-provider-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);