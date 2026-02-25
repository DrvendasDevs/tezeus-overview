-- ===========================================
-- LABORATÓRIO DE IA - Configurações
-- ===========================================

-- Tabela para configurações do laboratório
CREATE TABLE IF NOT EXISTS public.lab_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão para webhook URL
INSERT INTO lab_settings (key, value, description)
VALUES ('default_webhook_url', '', 'URL padrão do webhook N8N para o laboratório')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE lab_settings ENABLE ROW LEVEL SECURITY;

-- Política para lab_settings - apenas master pode acessar
CREATE POLICY "lab_settings_master_access" ON lab_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER lab_settings_updated_at
  BEFORE UPDATE ON lab_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_sessions_updated_at();
