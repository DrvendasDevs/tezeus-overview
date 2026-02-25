-- Tabela de datas sazonais por workspace
CREATE TABLE IF NOT EXISTS workspace_seasonal_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  day integer NOT NULL CHECK (day BETWEEN 1 AND 31),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  is_enabled boolean NOT NULL DEFAULT true,
  is_predefined boolean NOT NULL DEFAULT false,
  send_time time NOT NULL DEFAULT '09:00',
  message_template text NOT NULL,
  message_variations text[] DEFAULT '{}',
  connection_id uuid NULL,
  ignore_business_hours boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de execuções para evitar envios duplicados
CREATE TABLE IF NOT EXISTS seasonal_automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seasonal_date_id uuid NOT NULL REFERENCES workspace_seasonal_dates(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  year integer NOT NULL,
  status text DEFAULT 'sent',
  UNIQUE(seasonal_date_id, contact_id, year)
);

-- RLS
ALTER TABLE workspace_seasonal_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_automation_executions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para workspace_seasonal_dates
CREATE POLICY "workspace_seasonal_dates_select" ON workspace_seasonal_dates
  FOR SELECT USING (true);

CREATE POLICY "workspace_seasonal_dates_insert" ON workspace_seasonal_dates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "workspace_seasonal_dates_update" ON workspace_seasonal_dates
  FOR UPDATE USING (true);

CREATE POLICY "workspace_seasonal_dates_delete" ON workspace_seasonal_dates
  FOR DELETE USING (true);

-- Políticas RLS para seasonal_automation_executions
CREATE POLICY "seasonal_automation_executions_select" ON seasonal_automation_executions
  FOR SELECT USING (true);

CREATE POLICY "seasonal_automation_executions_insert" ON seasonal_automation_executions
  FOR INSERT WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_seasonal_dates_workspace ON workspace_seasonal_dates (workspace_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_dates_lookup ON workspace_seasonal_dates (month, day, is_enabled);
CREATE INDEX IF NOT EXISTS idx_seasonal_executions_lookup ON seasonal_automation_executions (seasonal_date_id, contact_id, year);
