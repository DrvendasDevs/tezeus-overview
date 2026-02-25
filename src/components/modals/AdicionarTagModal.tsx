import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface AdicionarTagModalProps {
  contactId: string;
  onAddTag: (tag: string) => void;
  isDarkMode?: boolean;
}

export function AdicionarTagModal({ contactId, onAddTag, isDarkMode = false }: AdicionarTagModalProps) {
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { tags } = useTags();
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtrar tags conforme digitação
  const filteredTags = newTag.trim().length > 0 
    ? tags.filter(tag => tag.name.toLowerCase().includes(newTag.toLowerCase()))
    : tags;

  const handleAddTag = async (tagName: string, tagId?: string) => {
    setIsLoading(true);
    try {
      let finalTagId = tagId;
      
      // Se não tem ID, é uma etiqueta nova - criar primeiro
      if (!finalTagId) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .single();

        if (existingTag) {
          finalTagId = existingTag.id;
        } else {
          // Criar nova tag
          const { data: newTagData, error: tagError } = await supabase
            .from('tags')
            .insert({ 
              name: tagName, 
              workspace_id: selectedWorkspace?.workspace_id
            })
            .select()
            .single();

          if (tagError) throw tagError;
          finalTagId = newTagData.id;
        }
      }

      // Associar etiqueta ao contato
      const { error: linkError } = await supabase
        .from('contact_tags')
        .insert({
          contact_id: contactId,
          tag_id: finalTagId
        });

      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError;
      }

      toast({
        title: "Tag adicionada",
        description: `A etiqueta "${tagName}" foi adicionada com sucesso.`,
      });

      onAddTag(tagName);
      setNewTag("");
    } catch (error: any) {
      console.error('Erro ao adicionar tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (newTag.trim()) {
      handleAddTag(newTag.trim());
    }
  };

  return (
    <PopoverContent 
      className="w-80 p-4 bg-white border rounded-lg shadow-lg"
      align="start"
      sideOffset={5}
    >
        {/* Campo de entrada autocomplete */}
        <div className="relative">
          <div className="relative">
            <Input
              ref={inputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Digite o nome da tag"
              className="pr-8 text-sm"
              autoFocus
            />
            {newTag && (
              <button
                onClick={() => setNewTag("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de tags */}
        {filteredTags.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto border-t pt-2">
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => handleAddTag(tag.name, tag.id)}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded text-sm"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: tag.color }}
                />
                <span>{tag.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Opção de criar nova etiqueta se não existir */}
        {newTag.trim() && !filteredTags.some(tag => tag.name.toLowerCase() === newTag.toLowerCase()) && (
          <div className="mt-2 border-t pt-2">
            <div
              onClick={handleCreateNew}
              className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded text-sm text-blue-600"
            >
              <span>+ Criar "{newTag}"</span>
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleCreateNew}
            className="w-full text-sm h-8"
            disabled={!newTag.trim() || isLoading}
          >
            {isLoading ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>

      </PopoverContent>
  );
}