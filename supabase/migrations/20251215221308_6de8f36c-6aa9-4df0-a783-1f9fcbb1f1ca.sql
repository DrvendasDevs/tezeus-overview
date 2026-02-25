-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Criar função que chama a edge function check-time-based-automations
CREATE OR REPLACE FUNCTION public.trigger_time_based_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Buscar URL e chave do Supabase
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Usar valores padrão se não configurados
  IF supabase_url IS NULL THEN
    supabase_url := 'https://zldeaozqxjwvzgrblyrh.supabase.co';
  END IF;
  
  IF service_role_key IS NULL THEN
    service_role_key := Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  END IF;
  
  -- Chamar a edge function via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/check-time-based-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'triggered_by', 'pg_cron',
      'timestamp', NOW()
    )
  );
  
  RAISE NOTICE 'Time-based automations check triggered at %', NOW();
END;
$$;

-- Remover job existente se houver
SELECT cron.unschedule('check-time-based-automations')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-time-based-automations'
);

-- Criar cron job para executar a cada minuto
SELECT cron.schedule(
  'check-time-based-automations',
  '* * * * *', -- A cada minuto
  $$SELECT public.trigger_time_based_automations()$$
);