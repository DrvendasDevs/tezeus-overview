import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeletarTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletarTicketModal({ isOpen, onClose, onConfirm }: DeletarTicketModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-primary-foreground dark:text-white">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Deletar Contato
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Atenção!</strong> Todas as mensagens relacionadas ao contato serão perdidas.
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 border-t border-[#d4d4d4] pt-4 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-red-600 text-white hover:bg-red-700 rounded-none"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}