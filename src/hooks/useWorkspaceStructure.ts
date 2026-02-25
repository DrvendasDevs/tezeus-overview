import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useToast } from "@/hooks/use-toast";
import { Pipeline, PipelineColumn } from "@/hooks/usePipelines";
import { useQueues } from "@/hooks/useQueues";

interface WorkspaceTag {
  id: string;
  name: string;
  color: string;
}

interface UseWorkspaceStructureResult {
  pipelines: Pipeline[];
  columns: PipelineColumn[];
  tags: WorkspaceTag[];
  loadingPipelines: boolean;
  loadingColumns: boolean;
  loadingTags: boolean;
  loadColumns: (pipelineId: string) => Promise<void>;
  queues: ReturnType<typeof useQueues>["queues"];
  loadingQueues: boolean;
}

/**
 * Hook genérico para carregar estrutura de um workspace:
 * pipelines, colunas (do pipeline selecionado), filas e tags.
 *
 * Pensado para reutilizar a mesma lógica da tela de WorkspaceApiKeys
 * em outros contextos (ex: painel MASTER / Busca por IDs).
 */
export function useWorkspaceStructure(
  workspaceId?: string | null
): UseWorkspaceStructureResult {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [tags, setTags] = useState<WorkspaceTag[]>([]);

  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  // Filas reutilizando hook existente
  const { queues, loading: loadingQueues } = useQueues(workspaceId || undefined);

  const loadPipelines = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoadingPipelines(true);
      const headers = getHeaders(workspaceId);

      const { data, error } = await supabase.functions.invoke(
        "pipeline-management/pipelines",
        {
          method: "GET",
          headers,
        }
      );

      if (error) throw error;

      setPipelines(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar pipelines (useWorkspaceStructure):", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines",
        variant: "destructive",
      });
    } finally {
      setLoadingPipelines(false);
    }
  }, [workspaceId, getHeaders, toast]);

  const loadColumns = useCallback(
    async (pipelineId: string) => {
      if (!workspaceId || !pipelineId) return;

      try {
        setLoadingColumns(true);
        const headers = getHeaders(workspaceId);

        const { data, error } = await supabase.functions.invoke(
          `pipeline-management/columns?pipeline_id=${pipelineId}`,
          {
            method: "GET",
            headers,
          }
        );

        if (error) throw error;

        setColumns(data || []);
      } catch (error: any) {
        console.error("Erro ao carregar colunas (useWorkspaceStructure):", error);
        toast({
          title: "Erro",
          description: "Erro ao carregar colunas",
          variant: "destructive",
        });
      } finally {
        setLoadingColumns(false);
      }
    },
    [workspaceId, getHeaders, toast]
  );

  const loadTags = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoadingTags(true);
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("name");

      if (error) throw error;

      setTags(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar tags (useWorkspaceStructure):", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tags",
        variant: "destructive",
      });
    } finally {
      setLoadingTags(false);
    }
  }, [workspaceId, toast]);

  // Recarregar quando workspaceId mudar
  useEffect(() => {
    // Sempre limpar colunas ao trocar de workspace para evitar dados “fantasma”
    setColumns([]);

    if (!workspaceId) {
      setPipelines([]);
      setTags([]);
      return;
    }

    loadPipelines();
    loadTags();
  }, [workspaceId, loadPipelines, loadTags]);

  return {
    pipelines,
    columns,
    tags,
    loadingPipelines,
    loadingColumns,
    loadingTags,
    loadColumns,
    queues,
    loadingQueues,
  };
}


