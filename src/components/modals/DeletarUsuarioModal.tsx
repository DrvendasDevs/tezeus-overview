import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeletarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  isDarkMode?: boolean;
}

export function DeletarUsuarioModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  userName,
  isDarkMode = false 
}: DeletarUsuarioModalProps) {
  const handleConfirm = async () => {
    await Promise.resolve(onConfirm());
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Só reagir ao fechamento (evita fechar imediatamente ao abrir)
        if (!open) onClose();
      }}
    >
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900",
        "dark:bg-[#111111] dark:border-gray-700 dark:text-gray-100"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold flex items-center gap-2",
            isDarkMode ? "text-white" : "text-gray-900",
            "dark:text-gray-100"
          )}>
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Excluir {userName}?
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className={cn(
            "text-sm",
            isDarkMode ? "text-gray-300" : "text-gray-600",
            "dark:text-gray-300"
          )}>
            <strong>Atenção!</strong> Todos os dados do usuário serão perdidos. Os atendimentos abertos deste usuário serão movidos para a fila.
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className={cn(
              isDarkMode 
                ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100",
              "dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}