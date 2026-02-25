import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  tag: string;
  document_name: string;
};

export function EditarContatoDisparadorModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  systemUserId: string;
  systemUserEmail: string;
  contact: ContactRow | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tag, setTag] = useState("");
  const [documentName, setDocumentName] = useState("");

  useEffect(() => {
    if (!props.open || !props.contact) return;
    setName(props.contact.name || "");
    setPhone(props.contact.phone || "");
    setTag(props.contact.tag || "");
    setDocumentName(props.contact.document_name || "");
  }, [props.open, props.contact]);

  const onSave = async () => {
    if (!props.contact) return;
    if (!props.workspaceId) return;
    if (!props.systemUserId || !props.systemUserEmail) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.systemUserId,
          "x-system-user-email": props.systemUserEmail,
        },
        body: {
          action: "contacts.update",
          workspaceId: props.workspaceId,
          contactId: props.contact.id,
          contactPatch: {
            name,
            phone,
            tag,
            document_name: documentName,
          },
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao salvar");

      toast({ title: "Contato atualizado" });
      props.onSaved?.();
      props.onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl rounded-none">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-2">
          <div className="space-y-1">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Nome</div>
            <Input className="rounded-none" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Telefone</div>
            <Input className="rounded-none" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Tag</div>
            <Input className="rounded-none" value={tag} onChange={(e) => setTag(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Nome do documento</div>
            <Input className="rounded-none" value={documentName} onChange={(e) => setDocumentName(e.target.value)} disabled={loading} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => props.onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button className="rounded-none" onClick={onSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

