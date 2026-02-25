import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface DeletarPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pipelineName: string;
  isDeleting?: boolean;
}

export function DeletarPipelineModal({
  isOpen,
  onClose,
  onConfirm,
  pipelineName,
  isDeleting = false
}: DeletarPipelineModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Excluir Pipeline
            </DialogTitle>
          </div>
          <DialogDescription className="pt-4">
            Tem certeza que deseja excluir o pipeline <strong>"{pipelineName}"</strong>?
            <br /><br />
            <strong className="text-red-600">Esta ação não pode ser desfeita.</strong>
            <br /><br />
            Todos os negócios e colunas deste pipeline serão perdidos permanentemente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Excluindo..." : "Sim, excluir pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
