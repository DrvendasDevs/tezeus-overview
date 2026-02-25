import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useLossReasons } from "@/hooks/useLossReasons";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Mode = "lost" | "reopen";

type PipelineOption = { id: string; name: string };

interface DealStatusMoveModalConfirmPayload {
  pipelineId: string;
  columnId: string;
  // loss
  lossReasonId: string | null;
  lossComments: string;
}

interface DealStatusMoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  workspaceId: string;
  pipelines?: PipelineOption[];
  defaultPipelineId?: string;
  defaultColumnId?: string;
  isLoading?: boolean;
  onConfirm: (payload: DealStatusMoveModalConfirmPayload) => void;
}

export function DealStatusMoveModal({
  open,
  onOpenChange,
  mode,
  workspaceId,
  pipelines,
  defaultPipelineId,
  defaultColumnId,
  isLoading = false,
  onConfirm,
}: DealStatusMoveModalProps) {
  const isLost = mode === "lost";
  const title = isLost ? "Marcar como perdido" : "Reabrir oportunidade";

  const [pipelineId, setPipelineId] = useState<string>(defaultPipelineId || "");
  const [columnId, setColumnId] = useState<string>(defaultColumnId || "");
  const [pipelineOptions, setPipelineOptions] = useState<PipelineOption[]>(pipelines || []);

  // loss fields
  const { lossReasons, isLoading: loadingReasons } = useLossReasons(workspaceId);
  const [selectedReasonId, setSelectedReasonId] = useState<string>("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherReason, setOtherReason] = useState("");
  const [comments, setComments] = useState("");

  const { columns: pipelineColumns } = usePipelineColumns(pipelineId || null, workspaceId || null);

  useEffect(() => {
    if (!open) return;
    setPipelineId(defaultPipelineId || "");
    setColumnId(defaultPipelineId ? (defaultColumnId || "") : "");

    // reset loss fields when opening
    setSelectedReasonId("");
    setShowOtherInput(false);
    setOtherReason("");
    setComments("");
  }, [open, defaultPipelineId, defaultColumnId]);

  useEffect(() => {
    if (!open) return;
    if (!pipelineId) {
      setColumnId("");
      return;
    }
    if (pipelineId === (defaultPipelineId || "") && (defaultColumnId || "")) {
      setColumnId(defaultColumnId || "");
      return;
    }
    setColumnId("");
  }, [pipelineId, defaultColumnId, defaultPipelineId, open]);

  // Garantir que o select de pipelines sempre tenha opções (fallback: buscar no banco ao abrir)
  useEffect(() => {
    if (!open) return;
    const incoming = pipelines || [];
    if (incoming.length > 0) {
      setPipelineOptions(incoming);
      return;
    }

    const load = async () => {
      if (!workspaceId) return;
      try {
        const { data, error } = await supabase
          .from("pipelines")
          .select("id, name, is_active")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });
        if (error) throw error;
        const opts = (data || [])
          .filter((p: any) => p.is_active)
          .map((p: any) => ({ id: p.id, name: p.name })) as PipelineOption[];
        setPipelineOptions(opts);
      } catch (e) {
        console.error("Erro ao buscar pipelines (DealStatusMoveModal):", e);
        setPipelineOptions([]);
      }
    };
    void load();
  }, [open, pipelines, workspaceId]);

  // Se não veio default ainda e já temos opções, manter o padrão como pipeline atual (se chegar depois), senão não auto-seleciona.
  useEffect(() => {
    if (!open) return;
    if (defaultPipelineId) {
      setPipelineId(defaultPipelineId);
      return;
    }
  }, [defaultPipelineId, open]);

  const canConfirmLoss = useMemo(() => {
    if (!isLost) return true;
    if (!selectedReasonId) return false;
    if (selectedReasonId === "outros") return otherReason.trim().length > 0;
    return true;
  }, [isLost, otherReason, selectedReasonId]);

  const canConfirm = !!pipelineId && !!columnId && canConfirmLoss && !isLoading;

  const handleConfirm = () => {
    const lossReasonId = !isLost
      ? null
      : selectedReasonId === "outros"
        ? null
        : selectedReasonId || null;

    const lossComments = !isLost ? "" : (selectedReasonId === "outros" ? (otherReason || comments) : comments);

    onConfirm({
      pipelineId,
      columnId,
      lossReasonId,
      lossComments,
    });
  };

  const pipelineName = pipelineOptions.find((p) => p.id === pipelineId)?.name;
  const columnName = (pipelineColumns || []).find((c: any) => c.id === columnId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[520px] max-h-[85vh] p-0 gap-0 overflow-hidden border border-[#d4d4d4] dark:border-gray-700 shadow-lg sm:rounded-none bg-white dark:bg-[#111111]">
        <DialogHeader className="mx-0 mt-0 px-6 py-4 bg-primary text-primary-foreground border-b border-[#d4d4d4] dark:border-gray-700 rounded-t-none flex-shrink-0">
          <DialogTitle className="text-primary-foreground dark:text-white">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6 text-gray-900 dark:text-gray-100 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-200">Pipeline (destino)</Label>
              <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); }}>
                <SelectTrigger className="h-8 text-xs border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100 rounded-none">
                  <SelectValue placeholder="Selecione o pipeline">
                    {pipelineName || "Selecione o pipeline"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100">
                  {(pipelineOptions || []).length > 0 ? (
                    pipelineOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs cursor-pointer focus:bg-gray-100">
                        {p.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled className="text-xs">
                      Nenhum pipeline disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-200">Coluna (destino)</Label>
              <Select value={columnId} onValueChange={setColumnId} disabled={!pipelineId}>
                <SelectTrigger className="h-8 text-xs border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100 rounded-none disabled:opacity-60">
                  <SelectValue placeholder={pipelineId ? "Selecione a coluna" : "Selecione um pipeline"}>
                    {columnName || (pipelineId ? "Selecione a coluna" : "Selecione um pipeline")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100">
                  {(pipelineColumns || []).length > 0 ? (
                    (pipelineColumns as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs cursor-pointer focus:bg-gray-100">
                        {c.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled className="text-xs">
                      Nenhuma coluna disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLost && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-200">Motivo da perda</Label>
                <Select
                  value={selectedReasonId}
                  onValueChange={(value) => {
                    setSelectedReasonId(value);
                    setShowOtherInput(value === "outros");
                    if (value !== "outros") setOtherReason("");
                  }}
                  disabled={loadingReasons}
                >
                  <SelectTrigger className="h-8 text-xs border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100 rounded-none">
                    <SelectValue placeholder="Escolha um motivo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100">
                    {loadingReasons ? (
                      <SelectItem value="loading" disabled className="text-xs">
                        Carregando...
                      </SelectItem>
                    ) : (
                      <>
                        {lossReasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id} className="text-xs cursor-pointer focus:bg-gray-100">
                            {reason.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="outros" className="text-xs cursor-pointer focus:bg-gray-100">
                          Outro...
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {showOtherInput && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-200">Especifique o motivo</Label>
                  <Input
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                    placeholder="Digite o motivo da perda"
                    className="h-8 text-xs border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100 rounded-none"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-200">Comentários (opcional)</Label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Adicione detalhes sobre a perda..."
                  rows={3}
                  className="text-xs border-gray-300 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100 rounded-none resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Corrigir o layout do footer (DialogFooter padrão tem -mx/-mb e flex-col-reverse) */}
        <DialogFooter className="mx-0 mb-0 mt-0 flex flex-row items-center justify-end gap-2 bg-gray-50 dark:bg-[#181818] border-t border-[#d4d4d4] dark:border-gray-700">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-8 text-xs bg-white dark:bg-[#1c1c1c] border-gray-300 dark:border-gray-700 rounded-none"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "h-8 text-xs rounded-none border-transparent disabled:opacity-60",
              isLost ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Salvando...
              </>
            ) : isLost ? (
              "Confirmar perdido"
            ) : (
              "Confirmar reabertura"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


