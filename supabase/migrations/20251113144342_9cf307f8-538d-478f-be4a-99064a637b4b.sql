-- Criar tabela para controlar execuções de automações
CREATE TABLE IF NOT EXISTS public.crm_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.crm_column_automations(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.pipeline_columns(id) ON DELETE CASCADE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_type TEXT NOT NULL DEFAULT 'time_in_column',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(automation_id, card_id, column_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_executions_automation_id ON public.crm_automation_executions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_card_id ON public.crm_automation_executions(card_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_executed_at ON public.crm_automation_executions(executed_at);

-- RLS policies
ALTER TABLE public.crm_automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation executions in their workspace"
  ON public.crm_automation_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pipeline_cards pc
      JOIN public.pipelines p ON p.id = pc.pipeline_id
      WHERE pc.id = crm_automation_executions.card_id
      AND is_workspace_member(p.workspace_id, 'user')
    )
  );

CREATE POLICY "System can insert automation executions"
  ON public.crm_automation_executions FOR INSERT
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.crm_automation_executions IS 'Registra execuções de automações para evitar duplicações';
COMMENT ON COLUMN public.crm_automation_executions.execution_type IS 'Tipo de execução: time_in_column, on_enter, etc';