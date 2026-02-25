import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClearConversationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ClearConversationsModal({ isOpen, onClose, onConfirm }: ClearConversationsModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  const handleConfirm = async () => {
    if (confirmText !== 'LIMPAR TUDO') return;
    
    setIsClearing(true);
    try {
      await onConfirm();
      setConfirmText('');
      onClose();
    } catch (error) {
      console.error('Erro ao limpar conversas:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleClose = () => {
    if (isClearing) return;
    setConfirmText('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Limpar Todas as Conversas
          </DialogTitle>
          <DialogDescription className="text-left space-y-2">
            <p>
              <strong>Esta ação é irreversível!</strong>
            </p>
            <p>
              Todas as conversas e mensagens serão permanentemente removidas.
              Os contatos serão preservados.
            </p>
            <p>
              Para confirmar, digite <strong>"LIMPAR TUDO"</strong> abaixo:
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite: LIMPAR TUDO"
            disabled={isClearing}
            className="text-center"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isClearing}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmText !== 'LIMPAR TUDO' || isClearing}
          >
            {isClearing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Limpando...
              </>
            ) : (
              'Confirmar Limpeza'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}