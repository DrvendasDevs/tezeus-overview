import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

export type ReportIndicatorFilterItem = {
  type: "pipeline" | "column" | "team" | "tags" | "products" | "date" | "status" | "value";
  value: string;
  operator?: string;
};

export type ReportIndicatorFunnelPresetItem = {
  id: string;
  name: string;
  filters: ReportIndicatorFilterItem[];
};

const DEFAULT_FUNNELS: ReportIndicatorFunnelPresetItem[] = [
  { id: "funnel-1", name: "Funil 1", filters: [] },
];

export function useReportIndicatorFunnelPresets(workspaceIdProp?: string) {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();

  const workspaceId = workspaceIdProp || selectedWorkspace?.workspace_id || "";
  // Permitir edição para master, support e admin (incluindo gestor)
  // Também verifica o profile direto do usuário para garantir compatibilidade
  const userProfile = (user?.profile || "").toLowerCase();
  const canEdit = 
    userRole === "master" || 
    userRole === "support" || 
    userRole === "admin" ||
    userProfile === "master" ||
    userProfile === "mentor_master" ||
    userProfile === "admin" ||
    userProfile === "gestor";

  const [loading, setLoading] = useState(false);
  const [savedFunnels, setSavedFunnels] = useState<ReportIndicatorFunnelPresetItem[]>(DEFAULT_FUNNELS);

  const fetchPreset = useCallback(async () => {
    if (!workspaceId) {
      setSavedFunnels(DEFAULT_FUNNELS);
      return;
    }
    try {
      setLoading(true);
      const headers = getWorkspaceHeaders(workspaceId);
      // Use POST to keep Supabase invoke behavior consistent (and avoid gateway quirks with GET)
      const { data, error } = await supabase.functions.invoke("report-indicator-funnel-presets", {
        method: "POST",
        headers,
        body: { workspaceId },
      });

      if (error) throw error;

      const funnelsRaw = (data?.funnels ?? null) as any;
      if (!funnelsRaw || !Array.isArray(funnelsRaw) || funnelsRaw.length === 0) {
        setSavedFunnels(DEFAULT_FUNNELS);
        return;
      }

      // sanitização mínima
      const parsed: ReportIndicatorFunnelPresetItem[] = funnelsRaw
        .map((f: any, idx: number) => ({
          id: String(f?.id || `funnel-${idx + 1}`),
          name: String(f?.name || `Funil ${idx + 1}`),
          filters: Array.isArray(f?.filters) ? (f.filters as any) : [],
        }))
        .filter((f) => f.id);

      setSavedFunnels(parsed.length > 0 ? parsed : DEFAULT_FUNNELS);
    } catch (e) {
      console.error("Erro ao carregar preset de funis (indicadores):", e);
      setSavedFunnels(DEFAULT_FUNNELS);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!user?.id) return;
    fetchPreset();
  }, [fetchPreset, user?.id]);

  const savePreset = useCallback(
    async (funnels: ReportIndicatorFunnelPresetItem[]) => {
      if (!workspaceId) return false;
      if (!canEdit) {
        toast({
          title: "Sem permissão",
          description: "Apenas Master/Admin podem salvar os funis padrão.",
          variant: "destructive",
        });
        return false;
      }
      try {
        setLoading(true);
        const headers = getWorkspaceHeaders(workspaceId);
        const { data, error } = await supabase.functions.invoke("report-indicator-funnel-presets", {
          method: "POST",
          headers,
          body: { workspaceId, funnels },
        });

        if (error) throw error;

        const saved = (data?.funnels as any) || funnels;
        setSavedFunnels(saved.length > 0 ? saved : DEFAULT_FUNNELS);
        toast({ title: "Salvo", description: "Funis padrão atualizados." });
        return true;
      } catch (e: any) {
        console.error("Erro ao salvar preset de funis (indicadores):", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível salvar os funis padrão.",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canEdit, toast, user?.id, workspaceId]
  );

  return useMemo(
    () => ({
      loading,
      canEdit,
      savedFunnels,
      refetch: fetchPreset,
      savePreset,
    }),
    [loading, canEdit, savedFunnels, fetchPreset, savePreset]
  );
}


