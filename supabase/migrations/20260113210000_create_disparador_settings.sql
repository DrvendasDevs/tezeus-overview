-- Cria tabela para armazenar configurações do módulo Disparador
-- Isso permite configurar a URL do webhook do n8n sem depender de secrets/env vars

CREATE TABLE IF NOT EXISTS public.disparador_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por chave
CREATE INDEX IF NOT EXISTS idx_disparador_settings_key ON public.disparador_settings(key);

-- RLS
ALTER TABLE public.disparador_settings ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode ler/escrever (Edge Functions usam service role)
CREATE POLICY "Service role full access to disparador_settings"
  ON public.disparador_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Inserir configuração padrão (vazia - usuário deve preencher)
INSERT INTO public.disparador_settings (key, value, description)
VALUES (
  'n8n_webhook_url',
  '',
  'URL do webhook do n8n para disparo de campanhas. Exemplo: https://seu-n8n.com/webhook/xxx'
)
ON CONFLICT (key) DO NOTHING;

-- Comentário na tabela
COMMENT ON TABLE public.disparador_settings IS 'Configurações globais do módulo Disparador';
COMMENT ON COLUMN public.disparador_settings.key IS 'Chave única da configuração';
COMMENT ON COLUMN public.disparador_settings.value IS 'Valor da configuração';
