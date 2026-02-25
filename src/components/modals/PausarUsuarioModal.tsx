import { useState, useEffect } from "react";
import { CirclePause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PausarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPauseUser: (pauseOptions: { pauseConversations: boolean; pauseCalls: boolean }) => void;
  userName: string;
}

export function PausarUsuarioModal({ 
  isOpen, 
  onClose, 
  onPauseUser, 
  userName 
}: PausarUsuarioModalProps) {
  const [pauseConversations, setPauseConversations] = useState(false);
  const [pauseCalls, setPauseCalls] = useState(false);

  const isFormValid = pauseConversations || pauseCalls;

  useEffect(() => {
    if (!isOpen) {
      setPauseConversations(false);
      setPauseCalls(false);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid) {
      onPauseUser({ pauseConversations, pauseCalls });
      onClose();
    }
  };

  const handleCancel = () => {
    setPauseConversations(false);
    setPauseCalls(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md bg-white rounded-xl shadow-lg border border-border">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-foreground">
            <CirclePause className="h-5 w-5 text-muted-foreground" />
            Configurar Pausa - {userName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h6 className="text-sm font-medium text-foreground mb-4">
              Opções de Pausa
            </h6>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="pause-conversations"
                  checked={pauseConversations}
                  onCheckedChange={(checked) => setPauseConversations(!!checked)}
                  className="rounded-md"
                />
                <label 
                  htmlFor="pause-conversations" 
                  className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                >
                  Pausar recebimento de conversas
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="pause-calls"
                  checked={pauseCalls}
                  onCheckedChange={(checked) => setPauseCalls(!!checked)}
                  className="rounded-md"
                />
                <label 
                  htmlFor="pause-calls" 
                  className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
                >
                  Pausar recebimento de ligações
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 border-border text-muted-foreground hover:bg-muted/50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="yellow"
              disabled={!isFormValid}
              className="flex-1 rounded-xl font-medium"
            >
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}