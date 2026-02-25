import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { Loader2 } from "lucide-react";

interface PipelineColumnSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnSelected: (pipelineId: string, pipelineName: string, columnId: string, columnName: string) => void;
  workspaceId?: string;
}

export function PipelineColumnSelectorModal({
  open,
  onOpenChange,
  onColumnSelected,
  workspaceId,
}: PipelineColumnSelectorModalProps) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  
  const { pipelines, isLoading: loadingPipelines } = usePipelines(workspaceId);
  const { columns, isLoading: loadingColumns } = usePipelineColumns(selectedPipelineId, workspaceId);

  // Reset column selection when pipeline changes
  useEffect(() => {
    setSelectedColumnId("");
  }, [selectedPipelineId]);

  // Reset selections when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedPipelineId("");
      setSelectedColumnId("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedPipelineId || !selectedColumnId) return;

    const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);
    const selectedColumn = columns.find((c) => c.id === selectedColumnId);
    
    if (selectedPipeline && selectedColumn) {
      onColumnSelected(
        selectedPipeline.id,
        selectedPipeline.name,
        selectedColumn.id,
        selectedColumn.name
      );
      setSelectedPipelineId("");
      setSelectedColumnId("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedPipelineId("");
    setSelectedColumnId("");
    onOpenChange(false);
  };

  const isLoading = loadingPipelines || loadingColumns;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Pipeline e Coluna</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Pipeline Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pipeline</label>
            <Select 
              value={selectedPipelineId} 
              onValueChange={setSelectedPipelineId}
              disabled={loadingPipelines}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Coluna</label>
            {loadingColumns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedColumnId}
                onValueChange={setSelectedColumnId}
                disabled={!selectedPipelineId || columns.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedPipelineId 
                      ? "Primeiro selecione um pipeline" 
                      : columns.length === 0
                      ? "Nenhuma coluna disponível"
                      : "Selecione uma coluna..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedPipelineId || !selectedColumnId || isLoading}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
