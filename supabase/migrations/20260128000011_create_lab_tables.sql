-- ===========================================
-- LABORATÓRIO DE IA - Tabelas
-- ===========================================

-- Sessões de teste do laboratório
CREATE TABLE IF NOT EXISTS public.lab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES system_users(id),
  agent_id UUID REFERENCES ai_agents(id),
  workspace_id UUID REFERENCES workspaces(id),
  webhook_url TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT DEFAULT 'Contato de Teste',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens do laboratório (separadas das mensagens reais)
CREATE TABLE IF NOT EXISTS public.lab_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES lab_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de ações executadas pelo agente
CREATE TABLE IF NOT EXISTS public.lab_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES lab_sessions(id) ON DELETE CASCADE,
  message_content TEXT,
  action_type TEXT NOT NULL,
  action_params JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  error_message TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_sessions_user ON lab_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_sessions_workspace ON lab_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lab_messages_session ON lab_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_lab_action_logs_session ON lab_action_logs(session_id);

-- RLS Policies
ALTER TABLE lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_action_logs ENABLE ROW LEVEL SECURITY;

-- Política para lab_sessions - usuários master podem ver tudo
CREATE POLICY "lab_sessions_master_access" ON lab_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Política para lab_messages
CREATE POLICY "lab_messages_master_access" ON lab_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Política para lab_action_logs
CREATE POLICY "lab_action_logs_master_access" ON lab_action_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lab_sessions_updated_at
  BEFORE UPDATE ON lab_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_sessions_updated_at();
