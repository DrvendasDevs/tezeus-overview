import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useAuth } from "@/hooks/useAuth";

export type ReportUserSettingsPayload = {
  funnels?: any[];
  customConversions?: any[];
  teamConversions?: any[];
  customConversionsFilter?: any;
  teamConversionsFilter?: any;
  globalFilter?: any;
};

export function useReportUserSettings(workspaceId?: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ReportUserSettingsPayload | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!workspaceId || !user?.id) {
      setSettings(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const headers = getWorkspaceHeaders(workspaceId);
      const { data, error } = await supabase.functions.invoke("report-user-settings", {
        method: "POST",
        headers,
        body: { workspaceId },
      });
      if (error) throw error;
      const raw = (data as any)?.settings ?? null;
      setSettings(raw && typeof raw === "object" ? (raw as ReportUserSettingsPayload) : null);
    } catch (e) {
      console.error("Erro ao carregar report-user-settings:", e);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, user?.id]);

  const saveSettings = useCallback(
    async (next: ReportUserSettingsPayload) => {
      if (!workspaceId || !user?.id) return false;
      try {
        setLoading(true);
        const headers = getWorkspaceHeaders(workspaceId);
        const { data, error } = await supabase.functions.invoke("report-user-settings", {
          method: "POST",
          headers,
          body: { workspaceId, settings: next },
        });
        if (error) throw error;
        const saved = (data as any)?.settings ?? next;
        setSettings(saved);
        return true;
      } catch (e) {
        console.error("Erro ao salvar report-user-settings:", e);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, user?.id]
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return useMemo(
    () => ({
      loading,
      settings,
      refetch: fetchSettings,
      saveSettings,
      setSettings,
    }),
    [loading, settings, fetchSettings, saveSettings]
  );
}


