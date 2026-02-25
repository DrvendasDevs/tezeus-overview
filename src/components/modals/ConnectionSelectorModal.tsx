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
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { Loader2 } from "lucide-react";

interface ConnectionSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectionSelected: (connectionId: string, connectionName: string) => void;
  workspaceId?: string;
}

export function ConnectionSelectorModal({
  open,
  onOpenChange,
  onConnectionSelected,
  workspaceId,
}: ConnectionSelectorModalProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const { connections, isLoading } = useWorkspaceConnections(workspaceId || "");

  useEffect(() => {
    if (!open) {
      setSelectedConnectionId("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (!selectedConnectionId) return;
    
    const selectedConnection = connections.find(c => c.id === selectedConnectionId);
    if (selectedConnection) {
      onConnectionSelected(selectedConnection.id, selectedConnection.instance_name);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'close':
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Conexão</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(connection.status)}`}
                      />
                      <span>{connection.instance_name}</span>
                      {connection.phone_number && (
                        <span className="text-xs text-muted-foreground">
                          ({connection.phone_number})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedConnectionId || isLoading}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
