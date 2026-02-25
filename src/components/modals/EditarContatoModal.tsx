import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface EditarContatoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string | null;
  onContactUpdated?: () => void;
}

export function EditarContatoModal({ 
  isOpen, 
  onClose, 
  contactId,
  onContactUpdated 
}: EditarContatoModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });

  useEffect(() => {
    if (isOpen && contactId) {
      loadContactData();
    }
  }, [isOpen, contactId]);

  const loadContactData = async () => {
    if (!contactId) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('name, email, phone')
        .eq('id', contactId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || ""
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do contato",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: formData.name,
          email: formData.email || null
          // phone removido - não pode ser alterado para preservar histórico
        })
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Contato atualizado com sucesso"
      });

      onContactUpdated?.();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar contato",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome do contato"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed"
              title="O telefone não pode ser alterado após a criação do contato"
              placeholder="(00) 00000-0000"
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ O número não pode ser alterado para preservar o histórico de conversas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
