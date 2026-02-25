import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  dealName?: string;
}

export function DeleteDealModal({ isOpen, onClose, onConfirm, dealName }: DeleteDealModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-white text-gray-900 border border-[#d4d4d4] rounded-none shadow-lg dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <AlertDialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2 text-primary-foreground">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Deletar Negócio
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-4 px-4">
          <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Esta ação não pode ser revertida.
          </AlertDialogDescription>
        </div>

        <AlertDialogFooter className="mt-0 flex justify-end gap-2 border-t border-[#d4d4d4] pt-4 bg-gray-50 dark:bg-[#050505] dark:border-gray-700">
          <AlertDialogCancel className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-none bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
