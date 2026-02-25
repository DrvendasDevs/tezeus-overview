import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Send, Loader2 } from "lucide-react";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (contactIds: string[]) => Promise<void>;
}

export function ForwardMessageModal({ isOpen, onClose, onForward }: ForwardMessageModalProps) {
  const { conversations } = useWhatsAppConversations();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isForwarding, setIsForwarding] = useState(false);

  // Extrair contatos únicos das conversas
  const contacts = useMemo(() => {
    const uniqueContacts = new Map();
    conversations.forEach(conv => {
      if (conv.contact && !uniqueContacts.has(conv.contact.id)) {
        uniqueContacts.set(conv.contact.id, {
          id: conv.contact.id,
          name: conv.contact.name,
          phone: conv.contact.phone,
          profile_image_url: conv.contact.profile_image_url,
          conversationId: conv.id
        });
      }
    });
    return Array.from(uniqueContacts.values());
  }, [conversations]);

  // Filtrar contatos pela busca
  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(term) ||
      contact.phone?.includes(term)
    );
  }, [contacts, searchTerm]);

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleForward = async () => {
    if (selectedContacts.size === 0) return;
    
    setIsForwarding(true);
    try {
      await onForward(Array.from(selectedContacts));
      setSelectedContacts(new Set());
      setSearchTerm("");
      onClose();
    } catch (error) {
      console.error('Erro ao encaminhar mensagens:', error);
    } finally {
      setIsForwarding(false);
    }
  };

  const handleClose = () => {
    setSelectedContacts(new Set());
    setSearchTerm("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar para</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista de contatos */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => toggleContact(contact.id)}
                >
                  <Checkbox
                    checked={selectedContacts.has(contact.id)}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.profile_image_url} />
                    <AvatarFallback>{contact.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
                  </div>
                </div>
              ))}

              {filteredContacts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum contato encontrado
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Rodapé com botão de enviar */}
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedContacts.size} {selectedContacts.size === 1 ? 'contato selecionado' : 'contatos selecionados'}
            </span>
            <Button
              onClick={handleForward}
              disabled={selectedContacts.size === 0 || isForwarding}
              className="gap-2"
            >
              {isForwarding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Encaminhando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Encaminhar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
