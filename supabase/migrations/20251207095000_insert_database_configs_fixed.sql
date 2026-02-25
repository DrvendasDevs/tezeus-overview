-- Inserir configurações iniciais de bancos de dados
-- Versão corrigida que evita conflitos

-- Primeiro, limpar dados existentes se necessário (opcional - comente se não quiser limpar)
-- DELETE FROM public.database_configs WHERE name IN ('Base 1', 'Base 2');

-- Inserir Base 1 (2.1 tester) - marcada como ativa por padrão
-- Usar INSERT ... ON CONFLICT de forma individual
INSERT INTO public.database_configs (name, url, anon_key, project_id, is_active)
VALUES (
  'Base 1',
  'https://zdrgvdlfhrbynpkvtyhx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM',
  'zdrgvdlfhrbynpkvtyhx',
  true
)
ON CONFLICT (name) DO UPDATE 
SET url = EXCLUDED.url,
    anon_key = EXCLUDED.anon_key,
    project_id = EXCLUDED.project_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Inserir Base 2 (2.0 com clientes) - marcada como inativa
INSERT INTO public.database_configs (name, url, anon_key, project_id, is_active)
VALUES (
  'Base 2',
  'https://zldeaozqxjwvzgrblyrh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM',
  'zldeaozqxjwvzgrblyrh',
  false
)
ON CONFLICT (name) DO UPDATE 
SET url = EXCLUDED.url,
    anon_key = EXCLUDED.anon_key,
    project_id = EXCLUDED.project_id,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Garantir que apenas Base 1 esteja ativa (executar após os inserts)
UPDATE public.database_configs
SET is_active = false, updated_at = now()
WHERE name = 'Base 2' AND is_active = true
AND EXISTS (
  SELECT 1 FROM public.database_configs 
  WHERE name = 'Base 1' AND is_active = true
);

