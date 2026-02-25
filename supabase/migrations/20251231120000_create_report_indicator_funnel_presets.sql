-- Presets de funis para "Relatórios Avançados" -> "Funil – Indicadores"
-- Armazena configuração padrão por empresa (workspace) e restringe edição a Admin/Master

CREATE TABLE IF NOT EXISTS public.report_indicator_funnel_presets (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  funnels JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_id UUID REFERENCES public.system_users(id),
  updated_by_id UUID REFERENCES public.system_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_report_indicator_funnel_presets_updated_at ON public.report_indicator_funnel_presets;
CREATE TRIGGER update_report_indicator_funnel_presets_updated_at
  BEFORE UPDATE ON public.report_indicator_funnel_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.report_indicator_funnel_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_indicator_funnel_presets_select" ON public.report_indicator_funnel_presets;
CREATE POLICY "report_indicator_funnel_presets_select"
  ON public.report_indicator_funnel_presets
  FOR SELECT
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

DROP POLICY IF EXISTS "report_indicator_funnel_presets_insert_admin" ON public.report_indicator_funnel_presets;
CREATE POLICY "report_indicator_funnel_presets_insert_admin"
  ON public.report_indicator_funnel_presets
  FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS "report_indicator_funnel_presets_update_admin" ON public.report_indicator_funnel_presets;
CREATE POLICY "report_indicator_funnel_presets_update_admin"
  ON public.report_indicator_funnel_presets
  FOR UPDATE
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

DROP POLICY IF EXISTS "report_indicator_funnel_presets_delete_admin" ON public.report_indicator_funnel_presets;
CREATE POLICY "report_indicator_funnel_presets_delete_admin"
  ON public.report_indicator_funnel_presets
  FOR DELETE
  USING (is_workspace_member(workspace_id, 'admin'::system_profile));

COMMENT ON TABLE public.report_indicator_funnel_presets IS 'Configuração padrão dos funis (múltiplos) usados no bloco Funil – Indicadores em Relatórios Avançados, por workspace.';


