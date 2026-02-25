import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { useContactTags } from "@/hooks/useContactTags";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AddContactTagButtonProps {
  contactId: string;
  isDarkMode?: boolean;
  onTagAdded?: (tag: Tag) => void;
}

export function AddContactTagButton({ contactId, isDarkMode = false, onTagAdded }: AddContactTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { 
    availableTags,
    contactTags,
    addTagToContact
  } = useContactTags(contactId);

  // Verificar quais tags já estão atribuídas ao contato
  const assignedTagIds = contactTags.map(tag => tag.id);

  const handleSelectTag = async (tagId: string) => {
    const selectedTag = availableTags.find(tag => tag.id === tagId);
    await addTagToContact(tagId);
    setIsOpen(false);
    if (selectedTag) {
      onTagAdded?.(selectedTag);
    } else {
      onTagAdded?.({
        id: tagId,
        name: '',
        color: '#999999'
      });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {/* Botão com texto + Adicionar Etiqueta */}
        <Button
          variant="ghost"
          className="h-6 px-2 rounded-none border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100 dark:hover:bg-[#1f1f1f] flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Etiqueta</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-64 p-0 rounded-none border-[#d4d4d4]" align="start">
        <Command className="rounded-none bg-white">
          <CommandInput placeholder="Buscar tags..." className="h-9 text-xs rounded-none border-b border-[#d4d4d4]" />
          <CommandList className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
            <CommandGroup className="p-1">
              {availableTags.map((tag) => {
                const isAssigned = assignedTagIds.includes(tag.id);
                
                return (
                  <CommandItem
                    key={tag.id}
                    onSelect={() => !isAssigned && handleSelectTag(tag.id)}
                    disabled={isAssigned}
                    className={`rounded-none text-xs px-2 py-1.5 cursor-pointer aria-selected:bg-[#EAA900] aria-selected:text-black ${isAssigned ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#EAA900] hover:text-black'}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div 
                        className="w-2.5 h-2.5 rounded-none border border-gray-300" 
                        style={{ backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)' }}
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