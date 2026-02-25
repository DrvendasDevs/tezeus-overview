import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { logCreate } from "@/utils/auditLog";

const colors = [
  "#8B5CF6", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", 
  "#F97316", "#EC4899", "#6366F1", "#84CC16", "#06B6D4"
];

interface CriarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagCreated: () => void;
}

export function CriarTagModal({ isOpen, onClose, onTagCreated }: CriarTagModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da etiqueta é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWorkspace?.workspace_id) {
      toast({
        title: "Erro",
        description: "Workspace não selecionado.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          name: name.trim(),
          color: color,
          workspace_id: selectedWorkspace.workspace_id
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar log de auditoria
      console.log('🏷️ [CriarTag] Registrando log de auditoria:', {
        entityType: 'tag',
        entityId: newTag.id,
        entityName: newTag.name,
        workspaceId: selectedWorkspace.workspace_id
      });
      
      try {
        await logCreate(
          'tag',
          newTag.id,
          newTag.name,
          { name: newTag.name, color: newTag.color },
          selectedWorkspace.workspace_id
        );
        console.log('🏷️ [CriarTag] Log registrado com sucesso!');
      } catch (logError) {
        console.error('🏷️ [CriarTag] Erro ao registrar log:', logError);
      }

      toast({
        title: "Etiqueta criada",
        description: `A etiqueta "${name}" foi criada com sucesso.`,
      });

      // Reset form
      setName("");
      setColor("#8B5CF6");
      onTagCreated();
      onClose();
    } catch (error: any) {
      console.error('Erro ao criar tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setColor("#8B5CF6");
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-white">
              Criar Etiqueta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Campo Nome */}
            <div>
              <Label htmlFor="tagName" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Nome
              </Label>
              <Input
                id="tagName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite o nome da etiqueta"
                className="mt-1 bg-white border-gray-300 text-gray-900 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            {/* Seletor de Cor */}
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Cor
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start rounded-none dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]">
                    <div 
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: color }}
                    />
                    <Palette className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 bg-white dark:bg-[#1a1a1a] dark:border-gray-700">
                  <div className="grid grid-cols-5 gap-2">
                    {colors.map((colorOption) => (
                      <button
                        key={colorOption}
                        className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-400"
                        style={{ backgroundColor: colorOption }}
                        onClick={() => setColor(colorOption)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={isLoading}
              >
                {isLoading ? "Criando..." : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}