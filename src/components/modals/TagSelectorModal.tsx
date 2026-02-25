import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTags } from "@/hooks/useTags";
import { Loader2 } from "lucide-react";

interface TagSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagSelected: (tagId: string, tagName: string) => void;
  workspaceId?: string;
}

export function TagSelectorModal({
  open,
  onOpenChange,
  onTagSelected,
  workspaceId,
}: TagSelectorModalProps) {
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const { tags, isLoading } = useTags(workspaceId);

  const handleConfirm = () => {
    if (!selectedTagId) return;

    const selectedTag = tags.find((tag) => tag.id === selectedTagId);
    if (selectedTag) {
      onTagSelected(selectedTag.id, selectedTag.name);
      setSelectedTagId("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedTagId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Etiqueta</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Escolha uma etiqueta</label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma etiqueta..." />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedTagId || isLoading}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
