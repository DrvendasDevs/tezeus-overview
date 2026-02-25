import { useState, useEffect } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  onTagAdded: (tag: Tag) => void;
  isDarkMode?: boolean;
}

export function AddTagModal({ 
  isOpen, 
  onClose, 
  contactId, 
  onTagAdded, 
  isDarkMode = false 
}: AddTagModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Buscar todas as tags quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      fetchAllTags();
    }
  }, [isOpen]);

  // Filtrar sugestões baseado no input
  useEffect(() => {
    if (tagInput.length > 0) {
      const filtered = allTags.filter(tag => 
        tag.name.toLowerCase().includes(tagInput.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions(allTags);
    }
  }, [tagInput, allTags]);

  const fetchAllTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('workspace_id', selectedWorkspace!.workspace_id)
        .order('name');

      if (error) throw error;
      setAllTags(data || []);
      setSuggestions(data || []);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .ilike('name', `%${tagInput}%`)
        .limit(5);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    }
  };

  const handleAddTag = async (tagName: string, isExisting = false, existingTag?: Tag) => {
    setIsLoading(true);
    try {
      let tagId: string;

      if (isExisting && existingTag) {
        tagId = existingTag.id;
      } else {
        // Criar nova tag
        const { data: newTag, error: tagError } = await supabase
          .from('tags')
          .insert([{ name: tagName, color: 'hsl(var(--muted))', workspace_id: selectedWorkspace!.workspace_id }])
          .select()
          .single();

        if (tagError) throw tagError;
        tagId = newTag.id;
      }

      // Associar etiqueta ao contato
      const { error: linkError } = await supabase
        .from('contact_tags')
        .insert([{ contact_id: contactId, tag_id: tagId }]);

      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError;
      }

      // Buscar a etiqueta completa para retornar
      const { data: tag, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .eq('id', tagId)
        .single();

      if (fetchError) throw fetchError;

      onTagAdded(tag);
      
      toast({
        title: "Tag adicionada",
        description: `A etiqueta "${tagName}" foi adicionada ao contato.`,
      });

      setTagInput("");
      onClose();
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        toast({
          title: "Tag já existe",
          description: "Esta etiqueta já está associada ao contato.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar a tag.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput.trim());
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={onClose}>
      <PopoverContent 
        className={cn(
          "w-96 p-4",
          isDarkMode ? "bg-card border-border" : "bg-background"
        )}
        align="start"
        sideOffset={5}
      >
        <div className={cn(
          "text-lg font-semibold mb-4",
          isDarkMode ? "text-white" : "text-gray-900"
        )}>
          Adicionar Etiqueta
        </div>

        <div className="space-y-4">
          <div className="relative space-y-2">
            <Input
              placeholder="Digite o nome da tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => {
                // Delay para permitir clique nos itens do dropdown
                setTimeout(() => setShowDropdown(false), 200);
              }}
              className={cn(
                isDarkMode ? "bg-card border-border text-foreground" : "bg-background"
              )}
              disabled={isLoading}
            />

            {showDropdown && suggestions.length > 0 && (
              <div className={cn(
                "absolute z-50 w-full border rounded-md p-2 space-y-1 max-h-48 overflow-y-auto shadow-lg",
                isDarkMode ? "border-border bg-card" : "border-border bg-background"
              )}>
                <p className={cn(
                  "text-xs font-medium",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {tagInput ? "Tags encontradas:" : "Todas as tags:"}
                </p>
                {suggestions.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start h-auto p-1",
                      isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    )}
                    onClick={() => {
                      handleAddTag(tag.name, true, tag);
                      setShowDropdown(false);
                    }}
                    disabled={isLoading}
                  >
                    <Badge 
                      variant="secondary" 
                      className="mr-2 text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  </Button>
                ))}
                {tagInput && !suggestions.some(tag => tag.name.toLowerCase() === tagInput.toLowerCase()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start h-auto p-1 border-t",
                      isDarkMode ? "hover:bg-gray-700 border-gray-600" : "hover:bg-gray-100 border-gray-200"
                    )}
                    onClick={() => {
                      handleAddTag(tagInput.trim());
                      setShowDropdown(false);
                    }}
                    disabled={isLoading}
                  >
                    <span className={cn(
                      "text-sm",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      + Criar nova etiqueta "{tagInput}"
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                isDarkMode ? "border-gray-600 text-gray-300" : ""
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => tagInput.trim() && handleAddTag(tagInput.trim())}
              disabled={!tagInput.trim() || isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}