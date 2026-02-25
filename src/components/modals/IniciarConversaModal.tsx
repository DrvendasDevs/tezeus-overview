import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface IniciarConversaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated?: (conversationId: string) => void;
}

export function IniciarConversaModal({ open, onOpenChange, onConversationCreated }: IniciarConversaModalProps) {
  const { selectedWorkspace } = useWorkspace();
  const [searchContact, setSearchContact] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();

  // Buscar contatos quando o usuário digita
  useEffect(() => {
    const searchContacts = async () => {
      if (searchContact.length < 2) {
        setContacts([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, name, phone')
          .or(`name.ilike.%${searchContact}%,phone.ilike.%${searchContact}%`)
          .limit(5);

        if (error) throw error;
        setContacts(data || []);
      } catch (error) {
        console.error('Erro ao buscar contatos:', error);
      }
    };

    const debounceTimer = setTimeout(searchContacts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchContact]);

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSearchContact(contact.name);
    setPhoneNumber(contact.phone?.replace(/^\+55/, '') || '');
    setShowSuggestions(false);
  };

  const createConversation = async () => {
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      toast({
        title: 'Número inválido',
        description: 'Por favor, insira um número válido com DDD (mínimo 10 dígitos)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      
      const fullPhone = `+55${phoneNumber.replace(/\D/g, '')}`;
      
      // Verificar se o contato já existe ou criar um novo
      let contactId = selectedContact?.id;
      
      if (!contactId) {
        const contactName = searchContact || `Contato ${phoneNumber}`;
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            name: contactName,
            phone: fullPhone,
            workspace_id: selectedWorkspace!.workspace_id
          })
          .select()
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;

        // 🖼️ Try to fetch profile image for new contact (non-blocking)
        try {
          const { error: profileError } = await supabase.functions.invoke('fetch-contact-profile-image', {
            body: {
              phone: fullPhone.replace(/\D/g, ''),
              contactId: contactId,
              workspaceId: selectedWorkspace!.workspace_id
            }
          });

          if (profileError) {
            console.error('⚠️ Failed to fetch profile image (non-blocking):', profileError);
          }
        } catch (profileFetchError) {
          console.error('⚠️ Error requesting profile image (non-blocking):', profileFetchError);
        }
      }

      // Verificar se já existe uma conversa com este contato
      const { data: existingConversation, error: checkError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('canal', 'whatsapp')
        .eq('status', 'open')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let conversationId;

      if (existingConversation) {
        conversationId = existingConversation.id;
        toast({
          title: "Conversa encontrada",
          description: "Redirecionando para a conversa existente.",
        });
      } else {
        // Criar nova conversa
        const { data: newConversation, error: conversationError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            canal: 'whatsapp',
            status: 'open',
            agente_ativo: false,
            last_activity_at: new Date().toISOString(),
            workspace_id: selectedWorkspace!.workspace_id
          })
          .select()
          .single();

        if (conversationError) throw conversationError;
        conversationId = newConversation.id;

        toast({
          title: "Conversa iniciada",
          description: "Nova conversa criada com sucesso!",
        });
      }

      onConversationCreated?.(conversationId);
      handleCancelar();
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a conversa. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = () => {
    setSearchContact("");
    setPhoneNumber("");
    setSelectedContact(null);
    setContacts([]);
    setShowSuggestions(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Campo de busca de contatos */}
          <div className="space-y-2">
            <Label htmlFor="search-contact">Buscar contato</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                id="search-contact"
                placeholder="Digite o nome ou telefone do contato"
                value={searchContact}
                onChange={(e) => {
                  setSearchContact(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-10"
              />
              
              {/* Dropdown de sugestões */}
              {showSuggestions && contacts.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                      onClick={() => handleContactSelect(contact)}
                    >
                      <div className="font-medium">{contact.name}</div>
                      <div className="text-sm text-muted-foreground">{contact.phone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Campo de telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Número do WhatsApp</Label>
            <div className="flex gap-0 border rounded-md overflow-hidden">
              {/* Prefixo fixo +55 */}
              <div className="flex items-center bg-muted px-3 border-r">
                <span className="text-sm font-medium text-muted-foreground">+55</span>
              </div>
              
              {/* Input do número */}
              <Input
                id="phone"
                type="tel"
                placeholder="21999999999"
                value={phoneNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setPhoneNumber(value);
                }}
                maxLength={11}
                className="border-0 focus-visible:ring-0 flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite apenas números (DDD + número)
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={createConversation} 
            disabled={loading || (!searchContact && !phoneNumber)}
            className="gap-2"
          >
            {loading ? (
              "Criando..."
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Iniciar Conversa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}