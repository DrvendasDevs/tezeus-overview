-- Criar tabela para motivos de perda
CREATE TABLE IF NOT EXISTS public.loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.loss_reasons ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view loss reasons in their workspace"
  ON public.loss_reasons FOR SELECT
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Admins can manage loss reasons"
  ON public.loss_reasons FOR ALL
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Adicionar campos ao pipeline_cards para registrar motivo de perda
ALTER TABLE public.pipeline_cards 
ADD COLUMN IF NOT EXISTS loss_reason_id UUID REFERENCES public.loss_reasons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS loss_comments TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_loss_reasons_workspace ON public.loss_reasons(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_loss_reason ON public.pipeline_cards(loss_reason_id);