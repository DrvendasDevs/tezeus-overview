import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CriarPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nome: string) => void;
  isDarkMode?: boolean;
}

export function CriarPipelineModal({ isOpen, onClose, onSave, isDarkMode = false }: CriarPipelineModalProps) {
  const [nome, setNome] = useState("");

  const handleSave = () => {
    if (nome.trim()) {
      onSave(nome.trim());
      setNome("");
      onClose();
    }
  };

  const handleCancel = () => {
    setNome("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 shadow-sm rounded-none bg-white dark:bg-[#0f0f0f] ${isDarkMode ? 'dark' : ''}`}>
        <DialogHeader className="bg-primary p-4 rounded-none m-0 border-b border-[#d4d4d4] dark:border-gray-700">
          <DialogTitle className="text-primary-foreground dark:text-white text-base font-bold">
            Criar Pipeline
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="nome" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Nome do Pipeline *
            </Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome do pipeline"
              className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus-visible:ring-0 dark:placeholder:text-gray-500`}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 border-t border-[#d4d4d4] dark:border-gray-700 px-4 py-3">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!nome.trim()}
            className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}