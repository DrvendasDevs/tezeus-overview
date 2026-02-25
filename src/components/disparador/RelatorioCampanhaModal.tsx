import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, RefreshCw } from "lucide-react";

type ReportKpis = {
  totalContatos: number;
  totalEnviadas: number;
  totalRespostas: number;
  totalFalhas: number;
  respostasPositivas: number;
  conversaoPositivaPct: number;
  respostasNegativas: number;
  conversaoNegativaPct: number;
};

type ReportData = {
  success: boolean;
  campaign?: { id: string; name: string; status: string; start_at: string | null };
  kpis?: ReportKpis;
  sendStatus?: { queued: number; sent: number; failed: number };
  contacts?: Array<{
    id: string;
    name: string;
    phone: string;
    tag: string;
    document_name: string;
    send_status?: string | null;
    response_kind?: string | null;
  }>;
  error?: string;
};

function statusLabel(status: string) {
  if (status === "nao_configurada") return "Não configurada";
  if (status === "disparando") return "Disparando";
  if (status === "concluida") return "Concluída";
  return status || "-";
}

function sendStatusLabel(s?: string | null) {
  if (s === "queued") return "Fila";
  if (s === "sent") return "Enviada";
  if (s === "failed") return "Falhou";
  return s || "-";
}

function respLabel(k?: string | null) {
  if (k === "positive") return "Positiva";
  if (k === "negative") return "Negativa";
  if (k === "any") return "Resposta";
  return k || "-";
}

export function RelatorioCampanhaModal(props: {
  workspaceId: string;
  systemUserId: string;
  systemUserEmail: string;
  campaignId: string | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  const fetchReport = async () => {
    if (!props.workspaceId || !props.campaignId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": props.systemUserId,
          "x-system-user-email": props.systemUserEmail,
        },
        body: { action: "campaigns.report", workspaceId: props.workspaceId, campaignId: props.campaignId },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao carregar relatório");
      setData(data as ReportData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao carregar relatório", description: msg, variant: "destructive" as any });
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!props.campaignId) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.workspaceId, props.campaignId]);

  const campaign = data?.campaign;
  const kpis = data?.kpis;
  const sendStatus = data?.sendStatus;
  const contacts = Array.isArray(data?.contacts) ? data?.contacts : [];

  const docsInCampaign = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach((c) => c.document_name && s.add(c.document_name));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8 px-2 rounded-none" onClick={props.onBack} disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Relatório da campanha{campaign?.name ? `: ${campaign.name}` : ""}
          </div>
        </div>
        <Button variant="outline" className="h-8 px-2 rounded-none" onClick={() => fetchReport()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {loading && <div className="text-[11px] text-gray-600 dark:text-gray-300">Carregando relatório...</div>}

          {/* KPIs (igual dashboard, porém da campanha) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Total de contatos</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.totalContatos ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Mensagens enviadas</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.totalEnviadas ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Total de respostas</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.totalRespostas ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Mensagens não enviadas</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.totalFalhas ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Respostas positivas</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.respostasPositivas ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Conversão positiva</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.conversaoPositivaPct ?? 0}%</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Respostas negativas</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.respostasNegativas ?? 0}</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Conversão negativa</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="text-2xl font-semibold">{kpis?.conversaoNegativaPct ?? 0}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Card grande: informações da campanha */}
          <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Informações da campanha</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">Status</div>
                  <div className="text-sm font-semibold">{statusLabel(String(campaign?.status || ""))}</div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">Data de início configurada</div>
                  <div className="text-sm font-semibold">
                    {campaign?.start_at ? new Date(campaign.start_at).toLocaleDateString("pt-BR") : "-"}
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">Status das mensagens</div>
                  <div className="text-[11px] text-gray-700 dark:text-gray-200 mt-1 space-y-1">
                    <div>Fila: <b>{sendStatus?.queued ?? 0}</b></div>
                    <div>Enviadas: <b>{sendStatus?.sent ?? 0}</b></div>
                    <div>Falhas: <b>{sendStatus?.failed ?? 0}</b></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista dos contatos da campanha (com nome do documento) */}
          <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
            <CardHeader className="py-3 px-3">
              <CardTitle className="text-xs text-gray-700 dark:text-gray-200">
                Contatos da campanha {docsInCampaign.length > 0 ? `(Documentos: ${docsInCampaign.join(", ")})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Nome do documento</TableHead>
                    <TableHead>Envio</TableHead>
                    <TableHead>Resposta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 dark:text-gray-300">
                        Nenhum contato vinculado (ou campanha sem contatos).
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.slice(0, 1000).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.tag}</TableCell>
                        <TableCell>{c.document_name}</TableCell>
                        <TableCell>{sendStatusLabel(c.send_status)}</TableCell>
                        <TableCell>{respLabel(c.response_kind)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {contacts.length > 1000 && (
                <div className="p-3 text-[11px] text-gray-600 dark:text-gray-300">
                  Mostrando apenas os primeiros 1000 contatos.
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
}

