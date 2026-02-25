-- Presets de filtros completos para Relatórios Avançados
-- Permite salvar todos os filtros (período, tags, status, agente, rankings, funis)
-- Apenas Admin/Master podem salvar, mas todos podem visualizar

CREATE TABLE IF NOT EXISTS public.report_filter_presets (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id UUID REFERENCES public.system_users(id),
  updated_by_id UUID REFERENCES public.system_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_report_filter_presets_updated_at ON public.report_filter_presets;
CREATE TRIGGER update_report_filter_presets_updated_at
  BEFORE UPDATE ON public.report_filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.report_filter_presets ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro do workspace pode visualizar
DROP POLICY IF EXISTS "report_filter_presets_select" ON public.report_filter_presets;
CREATE POLICY "report_filter_presets_select"
  ON public.report_filter_presets
  FOR SELECT
  USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- INSERT: apenas admin/master
DROP POLICY IF EXISTS "report_filter_presets_insert_admin" ON public.report_filter_presets;
CREATE POLICY "report_filter_presets_insert_admin"
  ON public.report_filter_presets
  FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- UPDATE: apenas admin/master
DROP POLICY IF EXISTS "report_filter_presets_update_admin" ON public.report_filter_presets;
CREATE POLICY "report_filter_presets_update_admin"
  ON public.report_filter_presets
  FOR UPDATE
  USING (is_workspace_member(workspace_id, 'admin'::system_profile))
  WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

-- DELETE: apenas admin/master
DROP POLICY IF EXISTS "report_filter_presets_delete_admin" ON public.report_filter_presets;
CREATE POLICY "report_filter_presets_delete_admin"
  ON public.report_filter_presets
  FOR DELETE
  USING (is_workspace_member(workspace_id, 'admin'::system_profile));

COMMENT ON TABLE public.report_filter_presets IS 'Configuração de filtros de relatórios por workspace. Inclui filtros de conversão, rankings e funis.';

-- Estrutura esperada do JSONB filters:
-- {
--   "customConv": { "periodPreset": "last30", "agent": "all", "tags": [], "status": "all" },
--   "teamConv": { "periodPreset": "last30", "agent": "all", "tags": [], "status": "all" },
--   "salesRanking": { "periodPreset": "last30" },
--   "workRanking": { "periodPreset": "last30" },
--   "funnels": [{ "id": "funnel-1", "name": "Funil 1", "filters": [] }]
-- }
