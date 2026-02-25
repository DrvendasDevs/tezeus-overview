import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { useConversationTags } from "@/hooks/useConversationTags";

interface AddTagButtonProps {
  conversationId: string;
  isDarkMode?: boolean;
  onTagAdded?: () => void;
}

export function AddTagButton({ conversationId, isDarkMode = false, onTagAdded }: AddTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  const { 
    availableTags,
    conversationTags,
    addTagToConversation
  } = useConversationTags(conversationId);

  const handleMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsHovered(false);
    }, 1000);
    setHideTimeout(timeout);
  };

  const handlePillMouseEnter = () => {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      setHideTimeout(null);
    }
  };

  // Verificar quais tags já estão atribuídas à conversa
  const assignedTagIds = conversationTags.map(ct => ct.tag_id);

  const handleSelectTag = async (tagId: string) => {
    await addTagToConversation(tagId);
    setIsOpen(false);
    onTagAdded?.();
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div 
          className="relative flex items-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Botão circular com + */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full border border-border hover:bg-accent dark:border-gray-600 dark:hover:bg-gray-700"
          >
            <Plus className="w-3 h-3 dark:text-gray-200" />
          </Button>
          
          {/* Pill hover - Imagem 2 */}
          <div 
            onMouseEnter={handlePillMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`absolute left-8 top-0 flex items-center h-6 px-2 bg-popover border border-dashed border-border rounded-full text-xs text-muted-foreground whitespace-nowrap z-10 -translate-x-1 transition-all duration-300 ease-out dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-300 ${
              isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 pointer-events-none'
            }`}
          >
            + Adicionar tag
          </div>
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="w-64 p-0 dark:bg-[#2d2d2d] dark:border-gray-600" align="start">
        <Command className="dark:bg-[#2d2d2d]">
          <CommandInput placeholder="Buscar tags..." className="dark:text-gray-200 dark:placeholder:text-gray-500" />
          <CommandList>
            <CommandGroup>
              {availableTags.map((tag) => {
                const isAssigned = assignedTagIds.includes(tag.id);
                
                return (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => !isAssigned && handleSelectTag(tag.id)}
                    disabled={isAssigned}
                    className="dark:data-[selected=true]:bg-gray-700 dark:text-gray-200"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span>{tag.name}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}