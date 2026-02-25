import { useEffect, useState } from "react";
import { BarChart3, FileText, List, Megaphone, MoreVertical, Pencil, Play, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ImportarListaModal } from "@/components/disparador/ImportarListaModal";
import { NovaCampanhaModal } from "@/components/disparador/NovaCampanhaModal";
import { useToast } from "@/components/ui/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditarContatoDisparadorModal } from "@/components/disparador/EditarContatoDisparadorModal";
import { EditarCampanhaModal } from "@/components/disparador/EditarCampanhaModal";
import { RelatorioCampanhaModal } from "@/components/disparador/RelatorioCampanhaModal";
import { useWorkspaceLimits } from "@/hooks/useWorkspaceLimits";

type DisparadorTab = "dashboard" | "campanhas" | "listas";

const getDisparadorErrorMessage = (e: unknown, fallback: string) => {
  const defaultMessage = fallback;
  const errorObj: any = e as any;
  const status = errorObj?.context?.status ?? errorObj?.status;
  const rawBody = errorObj?.context?.body;

  let bodyError: string | null = null;
  try {
    if (typeof rawBody === "string") {
      const parsed = JSON.parse(rawBody);
      bodyError = parsed?.error || parsed?.message || null;
    } else if (rawBody && typeof rawBody === "object") {
      bodyError = rawBody?.error || rawBody?.message || null;
    }
  } catch {
    bodyError = null;
  }

  const normalized = (bodyError || errorObj?.message || "").toUpperCase();

  if (status === 401 || normalized.includes("AUTH_REQUIRED")) {
    return "Sua sessão ainda não foi carregada. Recarregue a página e tente novamente.";
  }
  if (normalized.includes("INVALID_USER")) {
    return "Não foi possível validar seu usuário. Faça logout e login novamente.";
  }
  if (status === 403 || normalized.includes("NOT_WORKSPACE_MEMBER")) {
    return "Você não tem permissão neste workspace. Verifique sua associação ao workspace.";
  }

  if (bodyError) return bodyError;
  if (e instanceof Error && e.message) return e.message;
  return defaultMessage;
};

export function Disparador() {
  const { toast } = useToast();
  const [tab, setTab] = useState<DisparadorTab>("dashboard");
  const { selectedWorkspace } = useWorkspace();
  const { user, loading: authLoading } = useAuth();
  const workspaceId = selectedWorkspace?.workspace_id || "";
  const { limits, isLoading: isLoadingWorkspaceLimits } = useWorkspaceLimits(workspaceId);
  // Anti-flicker: enquanto carrega, considera habilitado para não mostrar "não habilitado" antes dos dados
  const isDisparadorEnabled = isLoadingWorkspaceLimits ? true : (limits?.disparador_enabled ?? true);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);

  // Filtros - Listas
  const [contactsSearch, setContactsSearch] = useState("");
  const [contactsTag, setContactsTag] = useState<string>("all");
  const [contactsDoc, setContactsDoc] = useState<string>("all");
  const [contactsCreatedFrom, setContactsCreatedFrom] = useState<string>(""); // yyyy-mm-dd
  const [contactsCreatedTo, setContactsCreatedTo] = useState<string>(""); // yyyy-mm-dd

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [editCampaignOpen, setEditCampaignOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [reportingCampaignId, setReportingCampaignId] = useState<string | null>(null);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardKpis, setDashboardKpis] = useState({
    campanhasAtivas: 0,
    enviosHoje: 0,
    taxaRespostaTotalPct: 0,
    totalRespostas: 0,
    respostasPositivas: 0,
    respostasNegativas: 0,
    conversaoPositivaPct: 0,
    conversaoNegativaPct: 0,
    totalEnviadas: 0,
    totalNaoEnviadas: 0,
  });
  const [userPerf, setUserPerf] = useState<any[]>([]);

  const kpis = dashboardKpis;

  const fetchContacts = async () => {
    if (!workspaceId || authLoading || !user?.id || !user?.email) {
      setContacts([]);
      return;
    }
    setLoadingContacts(true);
    try {
      const createdFrom = contactsCreatedFrom ? contactsCreatedFrom : null;
      const createdTo = contactsCreatedTo ? contactsCreatedTo : null;
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": user?.id || "",
          "x-system-user-email": user?.email || "",
        },
        body: {
          action: "contacts.list",
          workspaceId,
          limit: 2000,
          search: contactsSearch,
          tag: contactsTag,
          documentNameFilter: contactsDoc,
          createdFrom,
          createdTo,
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao carregar");
      setContacts(Array.isArray(data?.contacts) ? data.contacts : []);
    } catch (e) {
      const msg = getDisparadorErrorMessage(e, "Não foi possível carregar as listas.");
      toast({ title: "Erro ao carregar listas", description: msg, variant: "destructive" as any });
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  // refetch automático ao mudar filtros (com debounce para busca)
  useEffect(() => {
    if (!workspaceId || authLoading || !user?.id || !user?.email) return;
    const t = window.setTimeout(() => {
      fetchContacts();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, authLoading, user?.id, user?.email, contactsSearch, contactsTag, contactsDoc, contactsCreatedFrom, contactsCreatedTo]);

  const fetchCampaigns = async () => {
    if (!workspaceId || authLoading || !user?.id || !user?.email) {
      setCampaigns([]);
      return;
    }
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": user?.id || "",
          "x-system-user-email": user?.email || "",
        },
        body: { action: "campaigns.list", workspaceId },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao carregar");
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    } catch (e) {
      const msg = getDisparadorErrorMessage(e, "Não foi possível carregar as campanhas.");
      toast({ title: "Erro ao carregar campanhas", description: msg, variant: "destructive" as any });
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!workspaceId) return;
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": user?.id || "",
          "x-system-user-email": user?.email || "",
        },
        body: { action: "campaigns.delete", workspaceId, campaignId },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao excluir");
      toast({ title: "Campanha excluída" });
      fetchCampaigns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao excluir campanha", description: msg, variant: "destructive" as any });
    }
  };

  const triggerCampaignNow = async (campaignId: string) => {
    if (!workspaceId || !user?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke("disparador-trigger", {
        body: { workspaceId, campaignId },
        headers: {
          "x-system-user-id": user.id,
          "x-system-user-email": user.email || "",
        },
      });

      if (error) {
        const status = (error as any)?.context?.status ?? (error as any)?.status;
        const bodyErr =
          (error as any)?.context?.body?.error ??
          (error as any)?.context?.body?.message ??
          null;

        // 424 = webhook do n8n não configurado
        if (status === 424 || bodyErr === "DISPARADOR_N8N_WEBHOOK_URL_NOT_CONFIGURED") {
          toast({
            title: "Webhook do n8n não configurado",
            description:
              "Configure a URL do webhook na tabela disparador_settings (key='n8n_webhook_url') via SQL Editor do Supabase.",
            variant: "destructive" as any,
          });
          return;
        }

        throw error;
      }

      if (data?.success === false) {
        if (data?.error === "DISPARADOR_N8N_WEBHOOK_URL_NOT_CONFIGURED") {
          toast({
            title: "Webhook do n8n não configurado",
            description:
              "Configure a URL do webhook na tabela disparador_settings (key='n8n_webhook_url') via SQL Editor do Supabase.",
            variant: "destructive" as any,
          });
          return;
        }
        throw new Error(data?.error || "Falha ao disparar");
      }

      toast({ title: "Disparo iniciado", description: "A campanha foi enviada para o fluxo do n8n." });
      fetchCampaigns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Erro ao disparar", description: msg, variant: "destructive" as any });
    }
  };

  const fetchDashboard = async () => {
    if (!workspaceId || authLoading || !user?.id || !user?.email) {
      setDashboardKpis({
        campanhasAtivas: 0,
        enviosHoje: 0,
        taxaRespostaTotalPct: 0,
        totalRespostas: 0,
        respostasPositivas: 0,
        respostasNegativas: 0,
        conversaoPositivaPct: 0,
        conversaoNegativaPct: 0,
        totalEnviadas: 0,
        totalNaoEnviadas: 0,
      });
      setUserPerf([]);
      return;
    }

    setLoadingDashboard(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparador-management", {
        headers: {
          "x-system-user-id": user?.id || "",
          "x-system-user-email": user?.email || "",
        },
        body: { action: "dashboard.get", workspaceId },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao carregar");

      setDashboardKpis(data?.kpis || dashboardKpis);
      setUserPerf(Array.isArray(data?.userPerf) ? data.userPerf : []);
    } catch (e) {
      const msg = getDisparadorErrorMessage(e, "Não foi possível carregar o dashboard.");
      toast({ title: "Erro ao carregar dashboard", description: msg, variant: "destructive" as any });
      setUserPerf([]);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (!workspaceId || authLoading || !user?.id || !user?.email) return;
    if (tab === "listas") fetchContacts();
    if (tab === "campanhas") fetchCampaigns();
    if (tab === "dashboard") fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, workspaceId, authLoading, user?.id, user?.email]);

  if (!isDisparadorEnabled) {
    return (
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex flex-col h-full bg-white dark:bg-[#0e0e0e] font-sans text-xs dark:text-gray-100">
          <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Disparador</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#e6e6e6] dark:bg-[#050505] relative">
            <div className="block w-full align-middle bg-white dark:bg-[#111111]">
              <div className="p-4">
                <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                  <CardHeader className="py-3 px-3">
                    <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Módulo não habilitado</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 text-gray-700 dark:text-gray-200">
                    O módulo <b>Disparador</b> não está habilitado para esta empresa. Solicite a liberação com o administrador/master.
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="flex flex-col h-full bg-white dark:bg-[#0e0e0e] font-sans text-xs dark:text-gray-100">
        {/* Headline */}
        <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Disparador</span>
            </div>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#e6e6e6] dark:bg-[#050505] relative">
          <div className="block w-full align-middle bg-white dark:bg-[#111111]">
            <div className="p-4">
              {reportingCampaignId ? (
                <RelatorioCampanhaModal
                  workspaceId={workspaceId}
                  systemUserId={user?.id || ""}
                  systemUserEmail={user?.email || ""}
                  campaignId={reportingCampaignId}
                  onBack={() => setReportingCampaignId(null)}
                />
              ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as DisparadorTab)}>
                <TabsList className="rounded-none bg-[#e6e6e6] dark:bg-[#0f0f0f]">
                  <TabsTrigger
                    value="dashboard"
                    className="rounded-none text-xs flex items-center gap-2 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-[#2a2a2a] dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger
                    value="campanhas"
                    className="rounded-none text-xs flex items-center gap-2 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-[#2a2a2a] dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none"
                  >
                    <Megaphone className="h-4 w-4" />
                    Campanhas
                  </TabsTrigger>
                  <TabsTrigger
                    value="listas"
                    className="rounded-none text-xs flex items-center gap-2 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-[#2a2a2a] dark:data-[state=active]:text-gray-100 data-[state=active]:shadow-none"
                  >
                    <List className="h-4 w-4" />
                    Listas
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="mt-4">
                  <div className="space-y-4">
                    {loadingDashboard ? (
                      /* 🚀 Skeleton Dashboard */
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[1, 2, 3, 4, 5, 6, 7].map(i => (
                            <Card key={i} className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                              <CardHeader className="py-3 px-3">
                                <Skeleton className="h-3 w-24 rounded-sm dark:bg-gray-700" />
                              </CardHeader>
                              <CardContent className="px-3 pb-3">
                                <Skeleton className="h-7 w-16 rounded-sm dark:bg-gray-700" />
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                          <CardHeader className="py-3 px-3">
                            <Skeleton className="h-3 w-32 rounded-sm dark:bg-gray-700" />
                          </CardHeader>
                          <CardContent className="px-3 pb-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="border border-gray-200 dark:border-gray-700 p-3 rounded-none space-y-2">
                                  <Skeleton className="h-2.5 w-28 rounded-sm dark:bg-gray-700" />
                                  <Skeleton className="h-6 w-12 rounded-sm dark:bg-gray-700" />
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                          <CardHeader className="py-3 px-3">
                            <Skeleton className="h-3 w-36 rounded-sm dark:bg-gray-700" />
                          </CardHeader>
                          <CardContent className="px-3 pb-3 space-y-3">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex gap-4 items-center">
                                <Skeleton className="h-3 w-24 rounded-sm dark:bg-gray-700" />
                                <Skeleton className="h-3 w-10 rounded-sm dark:bg-gray-700" />
                                <Skeleton className="h-3 w-10 rounded-sm dark:bg-gray-700" />
                                <Skeleton className="h-3 w-10 rounded-sm dark:bg-gray-700" />
                                <Skeleton className="h-3 w-14 rounded-sm dark:bg-gray-700" />
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </>
                    ) : (
                      <>
                    {/* KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Campanhas ativas</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.campanhasAtivas}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Envios hoje</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.enviosHoje}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Taxa de resposta total</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.taxaRespostaTotalPct}%</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Respostas positivas</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.respostasPositivas}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Respostas negativas</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.respostasNegativas}</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Conversão positiva</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.conversaoPositivaPct}%</div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                        <CardHeader className="py-3 px-3">
                          <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Conversão negativa</CardTitle>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                          <div className="text-2xl font-semibold">{kpis.conversaoNegativaPct}%</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Resumo operacional */}
                    <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                      <CardHeader className="py-3 px-3">
                        <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Resumo operacional</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">Mensagens enviadas</div>
                            <div className="text-xl font-semibold">{kpis.totalEnviadas}</div>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">Total de respostas</div>
                            <div className="text-xl font-semibold">{kpis.totalRespostas}</div>
                          </div>
                          <div className="border border-gray-200 dark:border-gray-700 p-3 rounded-none">
                            <div className="text-[11px] text-gray-600 dark:text-gray-300">Mensagens não enviadas</div>
                            <div className="text-xl font-semibold">{kpis.totalNaoEnviadas}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Performance por usuário */}
                    <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                      <CardHeader className="py-3 px-3">
                        <CardTitle className="text-xs text-gray-700 dark:text-gray-200">Performance por usuário</CardTitle>
                      </CardHeader>
                      <CardContent className="px-0 pb-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Usuário</TableHead>
                              <TableHead>Enviadas</TableHead>
                              <TableHead>Respostas</TableHead>
                              <TableHead>Falhas</TableHead>
                              <TableHead>Taxa resposta</TableHead>
                              <TableHead>Positivas</TableHead>
                              <TableHead>Negativas</TableHead>
                              <TableHead>Conv. positiva</TableHead>
                              <TableHead>Conv. negativa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userPerf.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-gray-500 dark:text-gray-300">
                                  Sem dados ainda. Assim que o n8n registrar envios/respostas, esta tabela será preenchida.
                                </TableCell>
                              </TableRow>
                            ) : (
                              userPerf.map((r: any) => (
                                <TableRow key={r.user_id}>
                                  <TableCell>{r.user_name}</TableCell>
                                  <TableCell>{r.sent}</TableCell>
                                  <TableCell>{r.responses}</TableCell>
                                  <TableCell>{r.failed}</TableCell>
                                  <TableCell>{r.responseRatePct}%</TableCell>
                                  <TableCell>{r.positive}</TableCell>
                                  <TableCell>{r.negative}</TableCell>
                                  <TableCell>{r.positiveConvPct}%</TableCell>
                                  <TableCell>{r.negativeConvPct}%</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="campanhas" className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Campanhas</div>
                    <Button className="h-8 px-3 text-xs rounded-none" onClick={() => setIsCampaignModalOpen(true)}>
                      Nova Campanha
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Campanha</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loadingCampaigns ? (
                              <>
                                {[1, 2, 3].map(i => (
                                  <TableRow key={i}>
                                    <TableCell><Skeleton className="h-3 w-32 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell><Skeleton className="h-3 w-20 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-6 w-6 rounded-sm dark:bg-gray-700 ml-auto" /></TableCell>
                                  </TableRow>
                                ))}
                              </>
                            ) : campaigns.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-gray-500 dark:text-gray-300">
                                  Nenhuma campanha criada ainda.
                                </TableCell>
                              </TableRow>
                            ) : (
                              campaigns.map((c: any) => (
                                <TableRow key={c.id}>
                                  <TableCell>{c.name}</TableCell>
                                  <TableCell>
                                    {c.status === "nao_configurada"
                                      ? "Não configurada"
                                      : c.status === "disparando"
                                        ? "Disparando"
                                        : c.status === "concluida"
                                          ? "Concluída"
                                          : c.status}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="rounded-none bg-white text-gray-900 border border-gray-200 dark:bg-[#111111] dark:text-gray-100 dark:border-gray-700"
                                      >
                                        <DropdownMenuItem
                                          className="focus:bg-gray-100 focus:text-gray-900 dark:focus:bg-[#1f1f1f] dark:focus:text-gray-100"
                                          onClick={() => triggerCampaignNow(c.id)}
                                        >
                                          <Play className="h-4 w-4 mr-2" />
                                          Disparar campanha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="focus:bg-gray-100 focus:text-gray-900 dark:focus:bg-[#1f1f1f] dark:focus:text-gray-100"
                                          onClick={() => {
                                            setEditingCampaignId(c.id);
                                            setEditCampaignOpen(true);
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar campanha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="focus:bg-gray-100 focus:text-gray-900 dark:focus:bg-[#1f1f1f] dark:focus:text-gray-100"
                                          onClick={() => {
                                            setReportingCampaignId(c.id);
                                          }}
                                        >
                                          <FileText className="h-4 w-4 mr-2" />
                                          Relatório da campanha
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-red-600 focus:text-red-600 focus:bg-gray-100 dark:focus:bg-[#1f1f1f]"
                                          onClick={() => {
                                            const confirmDelete = window.confirm("Deseja excluir esta campanha?");
                                            if (!confirmDelete) return;
                                            deleteCampaign(c.id);
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="listas" className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Listas</div>
                    <Button className="h-8 px-3 text-xs rounded-none" variant="outline" onClick={() => setIsImportOpen(true)}>
                      Importar Lista
                    </Button>
                  </div>

                  {/* Filtros */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      className="h-8 w-[260px] rounded-none text-xs dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700"
                      placeholder="Pesquisar por nome ou telefone"
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
                    />

                    <Input
                      className="h-8 w-[150px] rounded-none text-xs dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700"
                      type="date"
                      value={contactsCreatedFrom}
                      onChange={(e) => setContactsCreatedFrom(e.target.value)}
                      title="Criado a partir de"
                    />
                    <Input
                      className="h-8 w-[150px] rounded-none text-xs dark:bg-[#0f0f0f] dark:text-gray-100 dark:border-gray-700"
                      type="date"
                      value={contactsCreatedTo}
                      onChange={(e) => setContactsCreatedTo(e.target.value)}
                      title="Criado até"
                    />

                    <Select value={contactsTag} onValueChange={setContactsTag}>
                      <SelectTrigger className="h-8 w-[180px] rounded-none text-xs">
                        <SelectValue placeholder="Etiqueta" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="all">Todas as etiquetas</SelectItem>
                        {Array.from(new Set((contacts || []).map((c: any) => String(c.tag || "")).filter(Boolean)))
                          .sort((a, b) => a.localeCompare(b))
                          .map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <Select value={contactsDoc} onValueChange={setContactsDoc}>
                      <SelectTrigger className="h-8 w-[240px] rounded-none text-xs">
                        <SelectValue placeholder="Documento" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        <SelectItem value="all">Todos os documentos</SelectItem>
                        {Array.from(new Set((contacts || []).map((c: any) => String(c.document_name || "")).filter(Boolean)))
                          .sort((a, b) => a.localeCompare(b))
                          .map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs rounded-none"
                      onClick={() => {
                        setContactsSearch("");
                        setContactsTag("all");
                        setContactsDoc("all");
                        setContactsCreatedFrom("");
                        setContactsCreatedTo("");
                      }}
                    >
                      Limpar
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Card className="rounded-none border-[#d4d4d4] dark:border-gray-700 dark:bg-[#111111]">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nome</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Etiqueta</TableHead>
                              <TableHead>Nome do documento</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loadingContacts ? (
                              <>
                                {[1, 2, 3, 4, 5].map(i => (
                                  <TableRow key={i}>
                                    <TableCell><Skeleton className="h-3 w-28 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell><Skeleton className="h-3 w-24 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell><Skeleton className="h-3 w-16 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell><Skeleton className="h-3 w-20 rounded-sm dark:bg-gray-700" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-6 w-6 rounded-sm dark:bg-gray-700 ml-auto" /></TableCell>
                                  </TableRow>
                                ))}
                              </>
                            ) : contacts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500 dark:text-gray-300">
                                  Nenhum contato importado ainda.
                                </TableCell>
                              </TableRow>
                            ) : (
                              contacts.map((c: any) => (
                                <TableRow key={c.id}>
                                  <TableCell>{c.name}</TableCell>
                                  <TableCell>{c.phone}</TableCell>
                                  <TableCell>{c.tag}</TableCell>
                                  <TableCell>{c.document_name}</TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="rounded-none bg-white text-gray-900 border border-gray-200 dark:bg-[#111111] dark:text-gray-100 dark:border-gray-700"
                                      >
                                        <DropdownMenuItem
                                          className="focus:bg-gray-100 focus:text-gray-900 dark:focus:bg-[#1f1f1f] dark:focus:text-gray-100"
                                          onClick={() => {
                                            setEditingContact(c);
                                            setEditContactOpen(true);
                                          }}
                                        >
                                          <Pencil className="h-4 w-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-red-600 focus:text-red-600 focus:bg-gray-100 dark:focus:bg-[#1f1f1f]"
                                          onClick={async () => {
                                            if (!workspaceId || !user?.id || !user?.email) return;
                                            const confirmDelete = window.confirm("Deseja excluir este contato da lista?");
                                            if (!confirmDelete) return;
                                            try {
                                              const { data, error } = await supabase.functions.invoke("disparador-management", {
                                                headers: {
                                                  "x-system-user-id": user.id,
                                                  "x-system-user-email": user.email,
                                                },
                                                body: { action: "contacts.delete", workspaceId, contactId: c.id },
                                              });
                                              if (error) throw error;
                                              if (data?.success === false) throw new Error(data?.error || "Falha ao excluir");
                                              toast({ title: "Contato excluído" });
                                              fetchContacts();
                                            } catch (e) {
                                              const msg = e instanceof Error ? e.message : String(e);
                                              toast({ title: "Erro ao excluir", description: msg, variant: "destructive" as any });
                                            }
                                          }}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
              )}
            </div>
          </div>
        </div>
      </div>

      <ImportarListaModal
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        workspaceId={workspaceId}
        createdBy={user?.id || ""}
        createdByEmail={user?.email || ""}
        onImported={fetchContacts}
      />

      <NovaCampanhaModal
        open={isCampaignModalOpen}
        onOpenChange={setIsCampaignModalOpen}
        workspaceId={workspaceId}
        createdBy={user?.id || ""}
        createdByEmail={user?.email || ""}
        onCreated={fetchCampaigns}
      />

      <EditarContatoDisparadorModal
        open={editContactOpen}
        onOpenChange={(o) => {
          setEditContactOpen(o);
          if (!o) setEditingContact(null);
        }}
        workspaceId={workspaceId}
        systemUserId={user?.id || ""}
        systemUserEmail={user?.email || ""}
        contact={editingContact}
        onSaved={fetchContacts}
      />

      <EditarCampanhaModal
        open={editCampaignOpen}
        onOpenChange={(o) => {
          setEditCampaignOpen(o);
          if (!o) setEditingCampaignId(null);
        }}
        workspaceId={workspaceId}
        systemUserId={user?.id || ""}
        systemUserEmail={user?.email || ""}
        campaignId={editingCampaignId}
        onSaved={fetchCampaigns}
      />

    </div>
  );
}

