-- Criar tabela para armazenar ações de pipeline
CREATE TABLE pipeline_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  action_name TEXT NOT NULL,
  target_pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  target_column_id UUID NOT NULL REFERENCES pipeline_columns(id) ON DELETE CASCADE,
  deal_state TEXT NOT NULL CHECK (deal_state IN ('Ganho', 'Perda')),
  order_position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_pipeline_actions_pipeline ON pipeline_actions(pipeline_id);
CREATE INDEX idx_pipeline_actions_target_pipeline ON pipeline_actions(target_pipeline_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pipeline_actions_updated_at
  BEFORE UPDATE ON pipeline_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE pipeline_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver ações de pipelines do seu workspace
CREATE POLICY "Users can view pipeline actions in their workspace"
  ON pipeline_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_actions.pipeline_id
      AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'user'::system_profile))
    )
  );

-- Policy: Admins podem gerenciar ações de pipelines
CREATE POLICY "Admins can manage pipeline actions"
  ON pipeline_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_actions.pipeline_id
      AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_actions.pipeline_id
      AND (is_current_user_master() OR is_workspace_member(p.workspace_id, 'admin'::system_profile))
    )
  );