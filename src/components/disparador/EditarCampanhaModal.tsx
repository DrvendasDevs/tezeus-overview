import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  tag: string;
  document_name: string;
};

type CampaignGetResponse = {
  success: boolean;
  campaign?: { id: string; name: string; status: string; start_at: string | null };
  messages?: Array<{ variation: number; content: string }>;
  contactIds?: string[];
  error?: string;
};

export function EditarCampanhaModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  systemUserId: string;
  systemUserEmail: string;
  campaignId: string | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(false);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<string>(""); // yyyy-mm-dd
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [v3, setV3] = useState("");

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [filterDoc, setFilterDoc] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const tags = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => c.tag && s.add(c.tag));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [contacts]);
  const docs = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => c.document_name && s.add(c.document_name));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (filterTag !== "all" && c.tag !== filterTag) return false;
      if (filterDoc !== "all" && c.document_name !== filterDoc) return false;
      return true;
    });
  }, [contacts, filterTag, filterDoc]);

  const reset = () => {
    setLoading(false);
    setLoadingInit(false);
    setName("");
    setStartDate("");
    setV1("");
    setV2("");
    setV3("");
    setFilterTag("all");
    setFilterDoc("all");
    setSelectedIds(new Set());
  };

  const fetchContacts = async () => {
    if (!props.workspaceId) {
      setContacts([]);
      return;
    }
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.systemUserId,
          "x-system-user-email": props.systemUserEmail,
        },
        body: { action: "contacts.list", workspaceId: props.workspaceId, limit: 2000 },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao carregar contatos");
      setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao carregar contatos", description: msg, variant: "destructive" as any });
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchCampaign = async () => {
    if (!props.workspaceId || !props.campaignId) return;
    setLoadingInit(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.systemUserId,
          "x-system-user-email": props.systemUserEmail,
        },
        body: { action: "campaigns.get", workspaceId: props.workspaceId, campaignId: props.campaignId },
      });
      if (error) throw error;
      const d = data as CampaignGetResponse;
      if (d?.success === false) throw new Error(d?.error || "Falha ao carregar campanha");

      const campaign = d?.campaign;
      if (campaign) {
        setName(campaign.name || "");
        const startAt = campaign.start_at ? new Date(campaign.start_at) : null;
        setStartDate(startAt ? startAt.toISOString().slice(0, 10) : "");
      }

      const msgs = Array.isArray(d?.messages) ? d.messages : [];
      const byVar = new Map<number, string>();
      msgs.forEach((m) => byVar.set(Number(m.variation), String(m.content || "")));
      setV1(byVar.get(1) || "");
      setV2(byVar.get(2) || "");
      setV3(byVar.get(3) || "");

      const ids = Array.isArray(d?.contactIds) ? d.contactIds : [];
      setSelectedIds(new Set(ids));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao carregar campanha", description: msg, variant: "destructive" as any });
    } finally {
      setLoadingInit(false);
    }
  };

  useEffect(() => {
    if (!props.open) return;
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.workspaceId]);

  useEffect(() => {
    if (!props.open) return;
    if (!props.campaignId) return;
    fetchCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.campaignId]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filteredContacts.forEach((c) => next.add(c.id));
      else filteredContacts.forEach((c) => next.delete(c.id));
      return next;
    });
  };

  const onSave = async () => {
    if (!props.workspaceId || !props.campaignId) return;
    if (!props.systemUserId || !props.systemUserEmail) return;
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome da campanha.", variant: "destructive" as any });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Selecione contatos", description: "Escolha ao menos 1 contato para a campanha.", variant: "destructive" as any });
      return;
    }
    if (!v1.trim() && !v2.trim() && !v3.trim()) {
      toast({ title: "Mensagem obrigatória", description: "Informe ao menos uma variação de mensagem.", variant: "destructive" as any });
      return;
    }

    setLoading(true);
    try {
      const startAtIso = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null;
      const messages = [
        { variation: 1 as const, content: v1.trim() },
        { variation: 2 as const, content: v2.trim() },
        { variation: 3 as const, content: v3.trim() },
      ];

      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.systemUserId,
          "x-system-user-email": props.systemUserEmail,
        },
        body: {
          action: "campaigns.update",
          workspaceId: props.workspaceId,
          campaignId: props.campaignId,
          name: name.trim(),
          startAt: startAtIso,
          messages,
          contactIds: Array.from(selectedIds),
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao salvar campanha");

      toast({ title: "Campanha atualizada" });
      props.onSaved?.();
      props.onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao salvar", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedIds.has(c.id));

  return (
    <Dialog open={props.open} onOpenChange={(o) => { props.onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-5xl rounded-none">
        <DialogHeader>
          <DialogTitle>Editar Campanha</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {loadingInit && (
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Carregando dados da campanha...</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">Nome da campanha</div>
              <Input className="rounded-none" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">Data de início</div>
              <Input className="rounded-none" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">Variação 1</div>
              <Textarea
                className="rounded-none min-h-[90px] dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                value={v1}
                onChange={(e) => setV1(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">Variação 2</div>
              <Textarea
                className="rounded-none min-h-[90px] dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                value={v2}
                onChange={(e) => setV2(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">Variação 3</div>
              <Textarea
                className="rounded-none min-h-[90px] dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                value={v3}
                onChange={(e) => setV3(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">Filtrar contatos:</div>
            <Select value={filterTag} onValueChange={setFilterTag} disabled={loadingContacts}>
              <SelectTrigger className="h-8 w-[180px] rounded-none text-xs">
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">Todas as etiquetas</SelectItem>
                {tags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterDoc} onValueChange={setFilterDoc} disabled={loadingContacts}>
              <SelectTrigger className="h-8 w-[220px] rounded-none text-xs">
                <SelectValue placeholder="Documento" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">Todos os documentos</SelectItem>
                {docs.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="ml-auto text-[11px] text-gray-600 dark:text-gray-300">
              Selecionados: <b>{selectedIds.size}</b>
            </div>
          </div>

          <div className="border border-[#d4d4d4] dark:border-gray-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allFilteredSelected} onCheckedChange={(v) => selectAllFiltered(!!v)} />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Documento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingContacts ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-300">
                      Carregando contatos...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-300">
                      Nenhum contato encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.slice(0, 300).map((c) => {
                    const checked = selectedIds.has(c.id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox checked={checked} onCheckedChange={(v) => toggleSelect(c.id, !!v)} />
                        </TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.tag}</TableCell>
                        <TableCell>{c.document_name}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {filteredContacts.length > 300 && (
            <div className="text-[11px] text-gray-600 dark:text-gray-300">
              Mostrando apenas os primeiros 300 resultados (use filtros para refinar).
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => props.onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button className="rounded-none" onClick={onSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

