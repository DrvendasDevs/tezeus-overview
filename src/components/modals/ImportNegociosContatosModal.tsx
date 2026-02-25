import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImportNegociosContatos } from '@/components/modules/master/ImportNegociosContatos';
import { X } from 'lucide-react';

interface ImportNegociosContatosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

export function ImportNegociosContatosModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
}: ImportNegociosContatosModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground">
            <span>Importar Negócios e Contatos</span>
            <span className="text-sm font-normal opacity-90">
              - {workspaceName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <ImportNegociosContatos
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onImportComplete={() => {
              // Fechar modal após importação bem-sucedida (opcional)
              // onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}


