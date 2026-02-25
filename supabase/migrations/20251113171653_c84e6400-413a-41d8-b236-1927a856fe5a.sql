-- Criar tabela para rastrear execuções de automações
CREATE TABLE IF NOT EXISTS public.automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.pipeline_cards(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.pipeline_columns(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.crm_column_automations(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Garantir que cada automação execute apenas uma vez por card em uma coluna
  UNIQUE(card_id, column_id, automation_id, trigger_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_automation_executions_card ON public.automation_executions(card_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_column ON public.automation_executions(column_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_workspace ON public.automation_executions(workspace_id);

-- RLS
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

-- Masters têm acesso total
CREATE POLICY "Masters have full access to automation executions"
  ON public.automation_executions
  FOR ALL
  USING (is_current_user_master());

-- Membros do workspace podem ver execuções
CREATE POLICY "Workspace members can view automation executions"
  ON public.automation_executions
  FOR SELECT
  USING (is_workspace_member(workspace_id, 'user'));

-- Service role pode inserir (via edge function)
CREATE POLICY "Service role can insert automation executions"
  ON public.automation_executions
  FOR INSERT
  WITH CHECK (true);