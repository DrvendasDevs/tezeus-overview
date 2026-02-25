import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, GripVertical } from "lucide-react";
import { useWorkspaceContactFields } from "@/hooks/useWorkspaceContactFields";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface ConfigurarCamposObrigatoriosModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

function SortableFieldItem({ field, onRemove }: { field: any; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 bg-muted/30 border border-border/40 rounded-lg group dark:bg-[#1a1a1a] dark:border-gray-700",
        isDragging && "opacity-50",
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium dark:text-gray-100">{field.field_name}</p>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-gray-600 dark:text-gray-300 dark:hover:bg-[#2a2a2a]"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ConfigurarCamposObrigatoriosModal({
  open,
  onClose,
  workspaceId,
}: ConfigurarCamposObrigatoriosModalProps) {
  const [newFieldName, setNewFieldName] = useState("");
  const { fields, addField, removeField, reorderFields } = useWorkspaceContactFields(workspaceId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;

    const success = await addField(newFieldName.trim());
    if (success) {
      setNewFieldName("");
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);

      const reordered = arrayMove(fields, oldIndex, newIndex);
      reorderFields(reordered);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <DialogTitle className="text-primary-foreground dark:text-gray-100">Configurar Campo Padrão</DialogTitle>
          <DialogDescription className="text-primary-foreground/90 dark:text-gray-300">Defina campos que aparecerão para TODOS os contatos da Empresa</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {fields.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((field) => (
                    <SortableFieldItem key={field.id} field={field} onRemove={() => removeField(field.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 dark:text-gray-400">Nenhum campo Padrão configurado</p>
          )}

          <div className="border-t pt-4 space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">Adicionar novo campo</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do campo (ex: CPF, Endereço)"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddField();
                  }
                }}
                className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
              />
              <Button size="sm" onClick={handleAddField} disabled={!newFieldName.trim()} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 border-t border-[#d4d4d4] pt-4 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
