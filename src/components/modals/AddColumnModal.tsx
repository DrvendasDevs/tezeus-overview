import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddColumnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn: (name: string, color: string, icon: string) => void;
  isDarkMode?: boolean;
}

export function AddColumnModal({ open, onOpenChange, onAddColumn, isDarkMode = false }: AddColumnModalProps) {
  const [name, setName] = useState("");
  const icon = "Circle";
  const color = "#ff0000";

  const handleSubmit = () => {
    if (name.trim()) {
      console.log('🔍 Criando coluna com dados:', { name: name.trim(), color, icon });
      onAddColumn(name.trim(), color, icon);
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`sm:max-w-md p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 shadow-sm rounded-none bg-white dark:bg-[#0f0f0f] overflow-hidden overflow-y-auto text-card-foreground ${isDarkMode ? 'dark' : ''}`}>
          <DialogHeader className="bg-primary p-4 rounded-none m-0 border-b border-[#d4d4d4] dark:border-gray-700">
            <DialogTitle className="text-primary-foreground dark:text-white text-base font-bold">
              Adicionar Etapa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="column-name" className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-xs font-bold text-gray-700 dark:text-gray-200">
                Nome da Etapa *
              </Label>
              <Input
                id="column-name"
                placeholder="Digite o nome da etapa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex w-full border px-3 py-2 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus-visible:ring-0 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#d4d4d4] dark:border-gray-700 px-4 py-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 px-4 py-2"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 dark:bg-primary dark:hover:bg-primary/90"
              disabled={!name.trim()}
            >
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}