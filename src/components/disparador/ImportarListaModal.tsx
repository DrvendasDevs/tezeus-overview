import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type ParsedRow = {
  name: string;
  phone: string;
  tag: string;
};

function normalizeHeader(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function sanitizePhone(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export function ImportarListaModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  createdBy: string;
  createdByEmail: string;
  onImported?: () => void;
}) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string>("");
  const [documentName, setDocumentName] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  const reset = () => {
    setFileName("");
    setDocumentName("");
    setRows([]);
    setLoading(false);
  };

  const onPickFile = async (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const doc = file.name.replace(/\.[^.]+$/, "");
    setDocumentName(doc);

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames?.[0];
      const ws = sheetName ? wb.Sheets[sheetName] : null;
      if (!ws) throw new Error("Nenhuma aba encontrada na planilha.");

      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (!Array.isArray(json) || json.length === 0) {
        throw new Error("Planilha vazia.");
      }

      // Mapear colunas por header (nome/telefone/tag)
      const sample = json[0] || {};
      const keys = Object.keys(sample || {});
      const normalizedKeys = keys.map((k) => ({ raw: k, norm: normalizeHeader(k) }));

      const nameKey =
        normalizedKeys.find((k) => ["nome", "name"].includes(k.norm))?.raw ?? null;
      const phoneKey =
        normalizedKeys.find((k) => ["telefone", "phone", "celular", "whatsapp"].includes(k.norm))?.raw ?? null;
      const tagKey =
        normalizedKeys.find((k) => ["tag", "etiqueta"].includes(k.norm))?.raw ?? null;

      if (!nameKey || !phoneKey || !tagKey) {
        throw new Error('A planilha deve conter as colunas "Nome", "Telefone" e "Tag" (case-insensitive).');
      }

      const parsed: ParsedRow[] = [];
      json.forEach((r, idx) => {
        const name = String(r[nameKey] || "").trim();
        const phone = sanitizePhone(String(r[phoneKey] || ""));
        const tag = String(r[tagKey] || "").trim();
        if (!name && !phone && !tag) return; // linha vazia
        if (!name || !phone || !tag) {
          // ignorar linhas incompletas, mas sem travar importação inteira
          return;
        }
        parsed.push({ name, phone, tag });
      });

      if (parsed.length === 0) {
        throw new Error("Nenhuma linha válida encontrada (Nome/Telefone/Tag obrigatórios).");
      }

      setRows(parsed);
      toast({
        title: "Planilha carregada",
        description: `${parsed.length} contatos prontos para importação.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao ler planilha", description: msg, variant: "destructive" as any });
      setRows([]);
    }
  };

  const onImport = async () => {
    if (!props.workspaceId) return;
    if (!props.createdBy) return;
    if (!documentName || rows.length === 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.createdBy,
          "x-system-user-email": props.createdByEmail,
        },
        body: {
          action: "contacts.import",
          workspaceId: props.workspaceId,
          documentName,
          rows: rows.map((r) => ({ name: r.name, phone: r.phone, tag: r.tag })),
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao importar");

      toast({
        title: "Lista importada",
        description: `${rows.length} contatos importados (ou atualizados) em "${documentName}".`,
      });
      props.onImported?.();
      props.onOpenChange(false);
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao importar", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => { props.onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl rounded-none">
        <DialogHeader>
          <DialogTitle>Importar Lista</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-6 pb-2">
          <div className="space-y-1">
            <div className="text-[11px] text-gray-600 dark:text-gray-300">
              Planilha obrigatória com colunas: <b>Nome</b>, <b>Telefone</b>, <b>Tag</b>.
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="rounded-none"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
              disabled={loading}
            />
            {fileName && (
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                Arquivo: <b>{fileName}</b> • Documento: <b>{documentName}</b>
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] text-gray-600 dark:text-gray-300">
                Prévia (primeiros {preview.length} de {rows.length}):
              </div>
              <div className="border border-[#d4d4d4] dark:border-gray-700">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, idx) => (
                      <TableRow key={`${r.phone}-${idx}`}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell>{r.tag}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={() => props.onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button className="rounded-none" onClick={onImport} disabled={loading || rows.length === 0}>
            {loading ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

