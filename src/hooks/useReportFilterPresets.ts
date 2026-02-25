import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

export type ReportFilterPresetItem = {
  type: "pipeline" | "column" | "team" | "tags" | "products" | "date" | "status" | "value";
  value: string;
  operator?: string;
};

export type ReportFunnelPreset = {
  id: string;
  name: string;
  filters: ReportFilterPresetItem[];
};

export type ReportFiltersData = {
  customConv?: {
    periodPreset?: string;
    agent?: string;
    tags?: string[];
    status?: string;
  };
  teamConv?: {
    periodPreset?: string;
    agent?: string;
    tags?: string[];
    status?: string;
  };
  salesRanking?: {
    periodPreset?: string;
    visibleUsers?: string[]; // IDs dos usuários visíveis no ranking (vazio = todos)
  };
  workRanking?: {
    periodPreset?: string;
    visibleUsers?: string[]; // IDs dos usuários visíveis no ranking (vazio = todos)
  };
  funnels?: ReportFunnelPreset[];
  // Conversões customizadas salvas pela empresa (admin/master)
  customConversions?: any[];
  teamConversions?: any[];
};

const DEFAULT_FILTERS: ReportFiltersData = {
  customConv: { periodPreset: "last30", agent: "all", tags: [], status: "all" },
  teamConv: { periodPreset: "last30", agent: "all", tags: [], status: "all" },
  salesRanking: { periodPreset: "last30", visibleUsers: [] },
  workRanking: { periodPreset: "last30", visibleUsers: [] },
  funnels: [{ id: "funnel-1", name: "Funil 1", filters: [] }],
};

export function useReportFilterPresets(workspaceIdProp?: string) {
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
  const [savedFilters, setSavedFilters] = useState<ReportFiltersData>(DEFAULT_FILTERS);

  const fetchPresets = useCallback(async () => {
    if (!workspaceId) {
      setSavedFilters(DEFAULT_FILTERS);
      return;
    }
    try {
      setLoading(true);
      const headers = getWorkspaceHeaders(workspaceId);
      
      const { data, error } = await supabase.functions.invoke("report-filter-presets", {
        method: "POST",
        headers,
        body: { workspaceId },
      });

      if (error) throw error;

      const filtersRaw = data?.filters as ReportFiltersData | null;
      if (!filtersRaw || typeof filtersRaw !== "object") {
        setSavedFilters(DEFAULT_FILTERS);
        return;
      }

      // Merge with defaults to ensure all properties exist
      const parsed: ReportFiltersData = {
        customConv: {
          periodPreset: filtersRaw.customConv?.periodPreset || "last30",
          agent: filtersRaw.customConv?.agent || "all",
          tags: Array.isArray(filtersRaw.customConv?.tags) ? filtersRaw.customConv.tags : [],
          status: filtersRaw.customConv?.status || "all",
        },
        teamConv: {
          periodPreset: filtersRaw.teamConv?.periodPreset || "last30",
          agent: filtersRaw.teamConv?.agent || "all",
          tags: Array.isArray(filtersRaw.teamConv?.tags) ? filtersRaw.teamConv.tags : [],
          status: filtersRaw.teamConv?.status || "all",
        },
        salesRanking: {
          periodPreset: filtersRaw.salesRanking?.periodPreset || "last30",
          visibleUsers: Array.isArray(filtersRaw.salesRanking?.visibleUsers) ? filtersRaw.salesRanking.visibleUsers : [],
        },
        workRanking: {
          periodPreset: filtersRaw.workRanking?.periodPreset || "last30",
          visibleUsers: Array.isArray(filtersRaw.workRanking?.visibleUsers) ? filtersRaw.workRanking.visibleUsers : [],
        },
        funnels: Array.isArray(filtersRaw.funnels) && filtersRaw.funnels.length > 0
          ? filtersRaw.funnels.map((f, idx) => ({
              id: String(f?.id || `funnel-${idx + 1}`),
              name: String(f?.name || `Funil ${idx + 1}`),
              filters: Array.isArray(f?.filters) ? f.filters : [],
            }))
          : DEFAULT_FILTERS.funnels,
        // Conversões customizadas salvas pela empresa
        customConversions: Array.isArray(filtersRaw.customConversions) ? filtersRaw.customConversions : [],
        teamConversions: Array.isArray(filtersRaw.teamConversions) ? filtersRaw.teamConversions : [],
      };

      setSavedFilters(parsed);
    } catch (e) {
      console.error("Erro ao carregar presets de filtros:", e);
      setSavedFilters(DEFAULT_FILTERS);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!user?.id) return;
    fetchPresets();
  }, [fetchPresets, user?.id]);

  const savePresets = useCallback(
    async (filters: ReportFiltersData) => {
      if (!workspaceId) return false;
      if (!canEdit) {
        toast({
          title: "Sem permissão",
          description: "Apenas Master/Admin podem salvar os filtros de relatório.",
          variant: "destructive",
        });
        return false;
      }
      try {
        setLoading(true);
        const headers = getWorkspaceHeaders(workspaceId);
        
        const { data, error } = await supabase.functions.invoke("report-filter-presets", {
          method: "POST",
          headers,
          body: { workspaceId, filters },
        });

        if (error) throw error;

        const saved = data?.filters as ReportFiltersData;
        if (saved) {
          setSavedFilters(saved);
        }
        
        toast({ title: "Salvo", description: "Filtros de relatório salvos para a empresa." });
        return true;
      } catch (e: any) {
        console.error("Erro ao salvar presets de filtros:", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível salvar os filtros.",
          variant: "destructive",
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canEdit, toast, workspaceId]
  );

  return useMemo(
    () => ({
      loading,
      canEdit,
      savedFilters,
      refetch: fetchPresets,
      savePresets,
    }),
    [loading, canEdit, savedFilters, fetchPresets, savePresets]
  );
}
