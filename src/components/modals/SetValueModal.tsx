import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SetValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: number) => void;
  currentValue?: number;
  isDarkMode?: boolean;
  canEdit?: boolean;
}

export function SetValueModal({
  isOpen,
  onClose,
  onSave,
  currentValue = 0,
  isDarkMode = false,
  canEdit = true
}: SetValueModalProps) {
  const [value, setValue] = useState(currentValue.toString());

  // Atualizar o valor quando o modal abre ou currentValue muda
  useEffect(() => {
    if (isOpen) {
      setValue(currentValue.toString());
    }
  }, [isOpen, currentValue]);

  const handleSave = () => {
    const numericValue = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    onSave(numericValue);
    onClose();
  };

  const handleCancel = () => {
    setValue(currentValue.toString());
    onClose();
  };

  const formatValue = (inputValue: string) => {
    // Remove tudo que não é número, vírgula ou ponto
    let cleaned = inputValue.replace(/[^\d,.-]/g, '');
    // Se tem vírgula, substitui por ponto para formatação
    cleaned = cleaned.replace(',', '.');
    return cleaned;
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatValue(e.target.value);
    setValue(formatted);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Preço</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">Preço do negócio</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="value"
                type="text"
                value={value}
                onChange={handleValueChange}
                placeholder="0"
                className="pl-10 dark:bg-[#1a1a1a] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                disabled={!canEdit}
                autoFocus
              />
            </div>
            {!canEdit && (
              <p className="text-xs text-muted-foreground mt-1">
                Desvincule o produto para editar o valor manualmente.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-yellow-600 hover:bg-yellow-50"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gray-500 hover:bg-gray-600 text-white"
            disabled={!canEdit}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}