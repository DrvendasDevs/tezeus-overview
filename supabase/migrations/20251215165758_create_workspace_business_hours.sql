-- Criar tabela de horários de funcionamento por workspace
CREATE TABLE IF NOT EXISTS public.workspace_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  -- 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, day_of_week)
);

-- Índice para busca rápida por workspace
CREATE INDEX IF NOT EXISTS idx_workspace_business_hours_workspace_id 
  ON public.workspace_business_hours(workspace_id);

-- Índice para busca por dia da semana
CREATE INDEX IF NOT EXISTS idx_workspace_business_hours_day 
  ON public.workspace_business_hours(workspace_id, day_of_week);

-- Comentários
COMMENT ON TABLE public.workspace_business_hours IS 'Horários de funcionamento por workspace para controlar envio de mensagens automáticas';
COMMENT ON COLUMN public.workspace_business_hours.day_of_week IS 'Dia da semana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado';
COMMENT ON COLUMN public.workspace_business_hours.is_enabled IS 'Se o dia está ativo para envio de mensagens';
COMMENT ON COLUMN public.workspace_business_hours.start_time IS 'Horário de início do funcionamento (formato TIME)';
COMMENT ON COLUMN public.workspace_business_hours.end_time IS 'Horário de fim do funcionamento (formato TIME)';

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_workspace_business_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_business_hours_updated_at
  BEFORE UPDATE ON public.workspace_business_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_business_hours_updated_at();

-- RLS Policies
ALTER TABLE public.workspace_business_hours ENABLE ROW LEVEL SECURITY;

-- Masters podem gerenciar todos os horários
CREATE POLICY "workspace_business_hours_master_all"
  ON public.workspace_business_hours
  FOR ALL
  TO authenticated
  USING (is_current_user_master())
  WITH CHECK (is_current_user_master());

-- Admins do workspace podem gerenciar
CREATE POLICY "workspace_business_hours_admin_manage"
  ON public.workspace_business_hours
  FOR ALL
  TO authenticated
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Usuários do workspace podem visualizar
CREATE POLICY "workspace_business_hours_user_read"
  ON public.workspace_business_hours
  FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

