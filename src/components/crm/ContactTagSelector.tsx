import { useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useContactTags } from "@/hooks/useContactTags";

interface ContactTagSelectorProps {
  contactId: string;
  onTagAdded?: () => void;
}

export function ContactTagSelector({ contactId, onTagAdded }: ContactTagSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const { addTagToContact, getFilteredTags } = useContactTags(contactId);

  const handleSelectTag = async (tagId: string) => {
    await addTagToContact(tagId);
    onTagAdded?.();
    setSearchTerm("");
  };

  return (
    <Command>
      <CommandInput 
        placeholder="Buscar tags..." 
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>Nenhuma etiqueta encontrada.</CommandEmpty>
        <CommandGroup>
          {getFilteredTags(searchTerm).map((tag) => (
            <CommandItem
              key={tag.id}
              onSelect={() => handleSelectTag(tag.id)}
            >
              <div className="flex items-center gap-2 w-full">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)' }}
                />
                <span>{tag.name}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
