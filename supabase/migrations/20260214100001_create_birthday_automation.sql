-- Tabela de configuração de automação de aniversário por workspace
CREATE TABLE IF NOT EXISTS workspace_birthday_automation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  send_time time NOT NULL DEFAULT '09:00',
  message_template text NOT NULL DEFAULT 'Feliz aniversário, {{nome}}! 🎂',
  message_variations text[] DEFAULT '{}',
  connection_id uuid NULL,
  ignore_business_hours boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Tabela de execuções para evitar envios duplicados
CREATE TABLE IF NOT EXISTS birthday_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  year integer NOT NULL,
  status text DEFAULT 'sent',
  UNIQUE(workspace_id, contact_id, year)
);

-- RLS
ALTER TABLE workspace_birthday_automation ENABLE ROW LEVEL SECURITY;
ALTER TABLE birthday_automation_executions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para workspace_birthday_automation
CREATE POLICY "workspace_birthday_automation_select" ON workspace_birthday_automation
  FOR SELECT USING (true);

CREATE POLICY "workspace_birthday_automation_insert" ON workspace_birthday_automation
  FOR INSERT WITH CHECK (true);

CREATE POLICY "workspace_birthday_automation_update" ON workspace_birthday_automation
  FOR UPDATE USING (true);

CREATE POLICY "workspace_birthday_automation_delete" ON workspace_birthday_automation
  FOR DELETE USING (true);

-- Políticas RLS para birthday_automation_executions
CREATE POLICY "birthday_automation_executions_select" ON birthday_automation_executions
  FOR SELECT USING (true);

CREATE POLICY "birthday_automation_executions_insert" ON birthday_automation_executions
  FOR INSERT WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_birthday_automation_workspace ON workspace_birthday_automation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_birthday_executions_lookup ON birthday_automation_executions (workspace_id, contact_id, year);
