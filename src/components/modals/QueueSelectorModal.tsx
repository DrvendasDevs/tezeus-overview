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
import { Badge } from "@/components/ui/badge";
import { useQueues } from "@/hooks/useQueues";
import { Loader2 } from "lucide-react";

interface QueueSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQueueSelected: (queueId: string, queueName: string) => void;
  workspaceId?: string;
}

export function QueueSelectorModal({
  open,
  onOpenChange,
  onQueueSelected,
  workspaceId,
}: QueueSelectorModalProps) {
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const { queues, loading } = useQueues(workspaceId, true); // 🔧 includeInactive: true para mostrar todas as filas

  useEffect(() => {
    if (!open) {
      setSelectedQueueId("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedQueueId) return;
    
    const selectedQueue = queues.find(q => q.id === selectedQueueId);
    if (selectedQueue) {
      onQueueSelected(selectedQueue.id, selectedQueue.name);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#0b0b0b] text-gray-900 dark:text-gray-100 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="dark:text-gray-100">Selecionar Fila</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground dark:text-gray-400" />
            </div>
          ) : (
            <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
              <SelectTrigger className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400">
                <SelectValue placeholder="Selecione uma fila" />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                {queues.map((queue) => (
                  <SelectItem 
                    key={queue.id} 
                    value={queue.id}
                    className="dark:focus:bg-gray-700 dark:text-gray-200"
                  >
                    <div className="flex items-center gap-2">
                      {queue.color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: queue.color }}
                        />
                      )}
                      <span>{queue.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedQueueId || loading}
            className="dark:bg-primary dark:hover:bg-primary/90"
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
