import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CalendarClock,
  AlertCircle,
  User,
  Phone,
  Briefcase,
  Map as MapIcon,
  Columns,
  Tag,
  Calendar as CalendarIcon,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DealDetailsPage } from "@/pages/DealDetailsPage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateActivityModal } from "@/components/modals/CreateActivityModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

interface ActivityData {
  id: string;
  subject: string;
  scheduled_for: string;
  is_completed: boolean;
  completed_at?: string | null;
  availability?: string | null;
  responsible_id: string | null;
  responsible_name?: string;
  pipeline_name?: string;
  stage_name?: string;
  deal_name?: string;
  contact_phone?: string;
  contact_name?: string;
  pipeline_card_id?: string | null;
  pipeline_id?: string | null;
  column_id?: string | null;
  contact_id?: string | null;
  type: string;
}

interface SelectedDealDetails {
  cardId: string;
  pipelineId: string;
  columnId: string;
  contactId?: string | null;
  contactName?: string;
  contactPhone?: string;
  dealName?: string;
}

const DEFAULT_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;

export function CRMAtividades() {
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("ALL"); // ALL | UNASSIGNED | userId
  const [kanbanQuickFilter, setKanbanQuickFilter] = useState<"scheduled" | "overdue" | "completed" | "all">("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedDealDetails, setSelectedDealDetails] = useState<SelectedDealDetails | null>(null);
  const [autoOpenActivityEditId, setAutoOpenActivityEditId] = useState<string | null>(null);
  const [openedFromCompletedColumn, setOpenedFromCompletedColumn] = useState(false);
  const [forceRescheduleModalOpen, setForceRescheduleModalOpen] = useState(false);
  const [forceRescheduleContext, setForceRescheduleContext] = useState<{ contactId: string; pipelineCardId?: string | null } | null>(null);
  const isDraggingRef = useRef(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  // Importante: por padrão, NÃO aplicar filtro de data.
  // O usuário escolhe o intervalo quando quiser.

  // ✅ Garantir regra de permissão: user vê apenas suas atividades
  useEffect(() => {
    if (userRole === "user" && user?.id) {
      setSelectedResponsible(user.id);
    }
  }, [userRole, user?.id]);

  const handleOpenDealDetails = (activity: ActivityData) => {
    if (!activity.pipeline_card_id) {
      return;
    }
    setSelectedDealDetails({
      cardId: activity.pipeline_card_id,
      pipelineId: activity.pipeline_id || "",
      columnId: activity.column_id || "",
      contactId: activity.contact_id,
      contactName: activity.contact_name || activity.deal_name || "Contato",
      contactPhone: activity.contact_phone || "",
      dealName: activity.deal_name || activity.contact_name || "Negócio",
    });
  };

  const handleOpenDealDetailsOnly = (activity: ActivityData, opts?: { fromCompleted?: boolean }) => {
    handleOpenDealDetails(activity);
    setAutoOpenActivityEditId(null);
    setOpenedFromCompletedColumn(!!opts?.fromCompleted);
  };

  const handleOpenDealDetailsAndEditActivity = (activity: ActivityData) => {
    handleOpenDealDetails(activity);
    setAutoOpenActivityEditId(activity.id);
    setOpenedFromCompletedColumn(false);
  };

  // No modo LISTA, sempre abrir no modo de edição (igual ao Kanban “abrir e editar”),
  // mas, se a atividade já estiver concluída, permitir fechar sem forçar criação de nova.
  const handleOpenDealDetailsAndEditActivityFromList = (activity: ActivityData) => {
    handleOpenDealDetails(activity);
    setAutoOpenActivityEditId(activity.id);
    setOpenedFromCompletedColumn(!!activity.is_completed);
  };

  const handleCloseDealDetails = () => {
    setSelectedDealDetails(null);
    setAutoOpenActivityEditId(null);
    setOpenedFromCompletedColumn(false);
  };

  // Regra: não pode fechar os detalhes da oportunidade se não existir atividade em aberto.
  const attemptCloseDealDetails = useCallback(async () => {
    if (!selectedWorkspace?.workspace_id) return;
    if (!selectedDealDetails?.cardId) {
      handleCloseDealDetails();
      return;
    }

    // Se abriu a oportunidade vindo da coluna "Concluídos", não forçar criação de atividade ao fechar.
    if (openedFromCompletedColumn) {
      handleCloseDealDetails();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("activities")
        .select("id, is_completed, type", { count: "exact" })
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .eq("pipeline_card_id", selectedDealDetails.cardId)
        .eq("is_completed", false);

      if (error) throw error;

      const openActivities = (data || []).filter((a: any) => String(a.type || "").toLowerCase().trim() !== "arquivo");
      if (openActivities.length > 0) {
        handleCloseDealDetails();
        return;
      }

      // Sem atividade em aberto -> forçar criação de uma nova, mantendo o Sheet aberto
      toast({
        title: "Atenção",
        description: "Não é possível fechar a oportunidade sem uma atividade em aberto. Crie uma nova atividade para continuar.",
        variant: "destructive",
      });

      setForceRescheduleContext({
        contactId: selectedDealDetails.contactId || "",
        pipelineCardId: selectedDealDetails.cardId,
      });
      setForceRescheduleModalOpen(true);
    } catch (e: any) {
      console.error("Erro ao validar atividades abertas antes de fechar:", e);
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível validar as atividades em aberto.",
        variant: "destructive",
      });
    }
  }, [
    handleCloseDealDetails,
    openedFromCompletedColumn,
    selectedDealDetails?.cardId,
    selectedDealDetails?.contactId,
    selectedWorkspace?.workspace_id,
    toast,
  ]);

  const fetchActivities = useCallback(async () => {
    if (!selectedWorkspace?.workspace_id) return;

    try {
      setIsLoading(true);
      setIsDataReady(false);

      const hasAnyFilter =
        !!searchTerm.trim() ||
        selectedCategory !== "all" ||
        selectedResponsible !== "ALL" ||
        !!dateFrom ||
        !!dateTo ||
        viewMode === "kanban";

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from("activities")
        .select("*", { count: "exact" })
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .order("scheduled_for", { ascending: true });

      // Sem filtros -> paginação normal. Com filtros (inclui Kanban) -> buscar tudo.
      if (!hasAnyFilter) {
        query = query.range(start, end);
      } else if (page !== 1) {
        setPage(1);
      }

      if (userRole === "user" && user?.id) {
        query = query.eq("responsible_id", user.id);
      } else if (selectedResponsible !== "ALL") {
        if (selectedResponsible === "UNASSIGNED") {
          query = query.is("responsible_id", null);
        } else {
          query = query.eq("responsible_id", selectedResponsible);
        }
      }

      const { data: activitiesData, error, count } = await query;

      if (error) throw error;

      setTotalCount(count || 0);

      if (!activitiesData || activitiesData.length === 0) {
        setActivities([]);
        setIsDataReady(true);
        return;
      }

      // 🚀 Preparar IDs para as queries paralelas (extrair antes, executar junto)
      const responsibleIds = activitiesData
        .map((a) => a.responsible_id)
        .filter(Boolean) as string[];
      const uniqueResponsibleIds = [...new Set(responsibleIds)];

      const pipelineCardIds = activitiesData
        .map((a) => a.pipeline_card_id)
        .filter(Boolean) as string[];
      const uniquePipelineCardIds = [...new Set(pipelineCardIds)];

      const activityContactIds = activitiesData
        .map((a) => a.contact_id)
        .filter(Boolean) as string[];
      const allContactIds = [...new Set(activityContactIds)];

      // 🚀 EXECUTAR TODAS AS QUERIES EM PARALELO (antes: sequencial = soma dos tempos)
      const [usersResult, contactsResult, cardsResult] = await Promise.all([
        // Query 1: Nomes dos responsáveis
        uniqueResponsibleIds.length > 0
          ? supabase.from("system_users").select("id, name").in("id", uniqueResponsibleIds)
          : Promise.resolve({ data: null, error: null }),
        // Query 2: Contatos diretos das atividades
        allContactIds.length > 0
          ? supabase.from("contacts").select("id, name, phone").in("id", allContactIds).eq("workspace_id", selectedWorkspace.workspace_id)
          : Promise.resolve({ data: null, error: null }),
        // Query 3: Posições dos cards no pipeline
        uniquePipelineCardIds.length > 0
          ? supabase.from("v_card_positions").select("*").in("card_id", uniquePipelineCardIds)
          : Promise.resolve({ data: null, error: null }),
      ]);

      // Montar mapa de responsáveis
      const usersMap = new Map<string, string>();
      usersResult.data?.forEach((u: any) => usersMap.set(u.id, u.name));

      // Montar mapa de contatos diretos
      const directContactsMap = new Map<string, { name: string; phone: string }>();
      if (contactsResult.error) {
        console.error("Erro ao buscar contatos das atividades:", contactsResult.error);
      }
      contactsResult.data?.forEach((contact: any) => {
        directContactsMap.set(contact.id, {
          name: contact.name || "-",
          phone: contact.phone || "-",
        });
      });

      // Montar mapa de cards do pipeline
      const pipelineCardsMap = new Map<
        string,
        {
          description: string | null;
          pipeline_id: string;
          pipeline_name: string;
          column_id: string;
          column_name: string;
          contact_id: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          status: string;
          pipeline_workspace_id?: string | null;
        }
      >();

      if (cardsResult.error) {
        console.error("Erro ao buscar posições dos cards:", cardsResult.error);
      }
      if (cardsResult.data && cardsResult.data.length > 0) {
        cardsResult.data.forEach((card: any) => {
          pipelineCardsMap.set(card.card_id, {
            description: card.description || card.contact_name,
            pipeline_id: card.pipeline_id,
            pipeline_name: card.pipeline_name || "-",
            column_id: card.column_id,
            column_name: card.column_name || "-",
            contact_id: card.contact_id,
            contact_name: card.contact_name || "-",
            contact_phone: card.contact_phone || "-",
            status: card.card_status,
            pipeline_workspace_id: card.workspace_id,
          });

          // Também atualizar o mapa de contatos diretos se tivermos dados mais frescos
          if (card.contact_id && card.contact_name) {
            directContactsMap.set(card.contact_id, {
              name: card.contact_name,
              phone: card.contact_phone || "-",
            });
          }
        });
      }

      const formattedActivities: ActivityData[] = activitiesData
        .map((item: any) => {
          const card = item.pipeline_card_id ? pipelineCardsMap.get(item.pipeline_card_id) : null;

          if (item.pipeline_card_id && card) {
            const cardStatus = card.status?.toLowerCase().trim() ?? "";
            const allowedOpenStatuses = ["aberto", "open"];
            if (cardStatus && !allowedOpenStatuses.includes(cardStatus)) {
              return null;
            }
          }

          // Buscar dados do contato diretamente se não houver card
          const directContact = item.contact_id ? directContactsMap.get(item.contact_id) : null;
          
          // Priorizar dados do card, mas usar dados diretos do contato como fallback
          const pipelineName = card?.pipeline_name || "-";
          const stageName = card?.column_name || "-";
          const contactPhone = card?.contact_phone || directContact?.phone || "-";
          const contactName = card?.contact_name || directContact?.name || card?.description || "-";
          const dealName = card?.description || "-";
          const contactId = item.contact_id || card?.contact_id || null;

          // Log de debug para atividades sem dados completos
          if ((!card && !directContact && item.contact_id) || (card && !card.contact_phone && !directContact?.phone && item.contact_id)) {
            console.warn(`⚠️ Atividade ${item.id} sem dados de contato:`, {
              hasCard: !!card,
              hasDirectContact: !!directContact,
              contactId: item.contact_id,
              pipelineCardId: item.pipeline_card_id,
            });
          }

          return {
            id: item.id,
            subject: item.subject,
            scheduled_for: item.scheduled_for,
            is_completed: item.is_completed,
            completed_at: item.completed_at ?? null,
            availability: item.availability ?? null,
            responsible_id: item.responsible_id,
            responsible_name: item.responsible_id ? usersMap.get(item.responsible_id) || "Desconhecido" : "Sem responsável",
            pipeline_name: pipelineName,
            stage_name: stageName,
            deal_name: dealName,
            contact_phone: contactPhone,
            contact_name: contactName,
            pipeline_card_id: item.pipeline_card_id,
            pipeline_id: card?.pipeline_id ?? null,
            column_id: card?.column_id ?? null,
            contact_id: contactId,
            type: item.type,
          };
        })
        .filter(Boolean) as ActivityData[];

      setActivities(formattedActivities);
      setIsDataReady(true);
    } catch (error: any) {
      console.error("Erro ao buscar atividades:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível carregar as atividades.",
        variant: "destructive",
      });
      setIsDataReady(false);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchTerm, selectedCategory, dateFrom, dateTo, viewMode, selectedWorkspace?.workspace_id, toast, user?.id, userRole]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Realtime: manter o Kanban atualizado quando atividades são concluídas/alteradas nos detalhes da oportunidade
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) return;

    const timeoutRef: { current: any } = { current: null };
    const scheduleRefetch = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fetchActivities();
      }, 400);
    };

    const channel = supabase
      .channel(`crm-atividades-${selectedWorkspace.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        () => scheduleRefetch()
      )
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchActivities, selectedWorkspace?.workspace_id]);

  // Se a oportunidade estiver aberta e não houver mais atividade em aberto, forçar criação de nova atividade
  useEffect(() => {
    if (!selectedDealDetails?.cardId) return;
    // Se abriu vindo da coluna "Concluídos", não forçar modal de criação aqui.
    if (openedFromCompletedColumn) return;
    const hasOpenForCard = activities.some(
      (a) =>
        a.pipeline_card_id === selectedDealDetails.cardId &&
        !a.is_completed &&
        String(a.type || "").toLowerCase().trim() !== "arquivo"
    );
    if (hasOpenForCard) return;

    // manter detalhes abertos e forçar agendamento
    setForceRescheduleContext({
      contactId: selectedDealDetails.contactId || "",
      pipelineCardId: selectedDealDetails.cardId,
    });
    setForceRescheduleModalOpen(true);
  }, [activities, openedFromCompletedColumn, selectedDealDetails?.cardId, selectedDealDetails?.contactId]);

  const isArquivoActivityType = (raw?: string | null) => {
    const t = (raw || "").toLowerCase().trim();
    return t === "arquivo" || t === "arquivos";
  };

  const filteredActivities = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return activities.filter((activity) => {
      // Arquivo não é atividade: não deve aparecer nem na lista nem no kanban
      if (isArquivoActivityType(activity.type)) return false;

      const categoryOk =
        selectedCategory === "all" ||
        (activity.type || "").toLowerCase().trim() === selectedCategory.toLowerCase().trim();

      // No Kanban, o status é controlado pelos cards de filtro acima das colunas.
      const statusOk = true;

      const responsibleOk = (() => {
        // user role é forçado via query + efeito, mas mantemos aqui como segurança.
        if (userRole === "user" && user?.id) {
          return activity.responsible_id === user.id;
        }
        if (selectedResponsible === "ALL") return true;
        if (selectedResponsible === "UNASSIGNED") return !activity.responsible_id;
        return activity.responsible_id === selectedResponsible;
      })();

      const dateOk = (() => {
        if (!dateFrom && !dateTo) return true;
        const start = dateFrom ? startOfDay(dateFrom) : undefined;
        const end = dateTo ? endOfDay(dateTo) : undefined;
        const ts = activity.is_completed
          ? (activity.completed_at || activity.scheduled_for)
          : activity.scheduled_for;
        if (!ts) return false;
        const d = new Date(ts);
        if (start && end) {
          // se o usuário inverter as datas, normalizar
          const s = start.getTime() <= end.getTime() ? start : end;
          const e = start.getTime() <= end.getTime() ? end : start;
          return isWithinInterval(d, { start: s, end: e });
        }
        if (start) return d.getTime() >= start.getTime();
        if (end) return d.getTime() <= end.getTime();
        return true;
      })();

      const matchesSubject = activity.subject.toLowerCase().includes(term);
      const matchesDeal = activity.deal_name?.toLowerCase().includes(term);
      const matchesResponsible = activity.responsible_name?.toLowerCase().includes(term);
      const matchesPipeline = activity.pipeline_name?.toLowerCase().includes(term);
      const matchesContact = activity.contact_name?.toLowerCase().includes(term);
      const searchOk = matchesSubject || matchesDeal || matchesResponsible || matchesPipeline || matchesContact;
      return categoryOk && statusOk && responsibleOk && dateOk && searchOk;
    });
  }, [activities, searchTerm, selectedCategory, selectedResponsible, dateFrom, dateTo, viewMode, userRole, user?.id]);

  const responsibleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activities) {
      if (!a.responsible_id) continue;
      map.set(a.responsible_id, a.responsible_name || "Desconhecido");
    }
    const options = Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return options;
  }, [activities]);

  const ONE_MINUTE_MS = 60 * 1000;
  const nowMs = Date.now();

  const classifyIsOverdue = (a: ActivityData) => {
    if (a.is_completed) return false;
    const ts = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
    return nowMs > ts + ONE_MINUTE_MS;
  };

  const kanbanFilteredActivities = useMemo(() => {
    if (viewMode !== "kanban") return filteredActivities;
    switch (kanbanQuickFilter) {
      case "completed":
        return filteredActivities.filter((a) => a.is_completed);
      case "overdue":
        return filteredActivities.filter((a) => !a.is_completed && classifyIsOverdue(a));
      case "scheduled":
        // Regra (nova): "Agendadas" = abertas e NÃO atrasadas
        return filteredActivities.filter((a) => !a.is_completed && !classifyIsOverdue(a));
      case "all":
      default:
        return filteredActivities;
    }
  }, [filteredActivities, kanbanQuickFilter, viewMode, nowMs]);

  const kanbanCounts = useMemo(() => {
    const all = filteredActivities;
    const completed = all.filter((a) => a.is_completed).length;
    const overdue = all.filter((a) => !a.is_completed && classifyIsOverdue(a)).length;
    // Regra (nova): "Agendadas" = abertas e NÃO atrasadas
    const scheduled = all.filter((a) => !a.is_completed && !classifyIsOverdue(a)).length;
    return { all: all.length, scheduled, overdue, completed };
  }, [filteredActivities, nowMs]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    // Tipos fixos que devem aparecer mesmo se ainda não existirem atividades no banco
    set.add("Ligação Agendada");
    for (const a of activities) {
      const t = (a.type || "").trim();
      if (t && !isArquivoActivityType(t)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [activities]);

  const normalizeActivityType = (raw?: string | null) => {
    const t = (raw || "").trim();
    if (!t) return "Outros";
    return t;
  };

  type KanbanStatusKey = "open" | "in_progress" | "completed";
  const getKanbanStatus = (a: ActivityData): KanbanStatusKey => {
    if (a.is_completed) return "completed";
    // Persistência: usamos availability (livre/ocupado) para controlar "Em andamento"
    const av = (a.availability || "").toLowerCase().trim();
    if (av === "ocupado") return "in_progress";
    return "open";
  };

  const kanbanColumns = useMemo(() => {
    const cols: Array<{ key: KanbanStatusKey; name: string; items: ActivityData[] }> = [
      { key: "open", name: "Abertos", items: [] },
      { key: "in_progress", name: "Em andamento", items: [] },
      { key: "completed", name: "Concluídos", items: [] },
    ];

    const map = new Map<KanbanStatusKey, ActivityData[]>();
    cols.forEach((c) => map.set(c.key, []));
    kanbanFilteredActivities.forEach((a) => {
      map.get(getKanbanStatus(a))!.push(a);
    });

    const sortTs = (a: ActivityData) =>
      new Date(a.is_completed ? (a.completed_at || a.scheduled_for) : a.scheduled_for).getTime();

    return cols.map((c) => ({
      ...c,
      items: (map.get(c.key) || []).slice().sort((x, y) => sortTs(x) - sortTs(y)),
    }));
  }, [kanbanFilteredActivities]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const updateActivityKanbanStatus = useCallback(
    async (activityId: string, to: KanbanStatusKey) => {
      const nowIso = new Date().toISOString();

      const patch: Partial<ActivityData> =
        to === "completed"
          ? { is_completed: true, completed_at: nowIso }
          : to === "in_progress"
          ? { is_completed: false, completed_at: null, availability: "ocupado" }
          : { is_completed: false, completed_at: null, availability: "livre" };

      setActivities((prev) => prev.map((a) => (a.id === activityId ? { ...a, ...patch } : a)));

      const updatePayload: any =
        to === "completed"
          ? { is_completed: true, completed_at: nowIso }
          : to === "in_progress"
          ? { is_completed: false, completed_at: null, availability: "ocupado" }
          : { is_completed: false, completed_at: null, availability: "livre" };

      const { error } = await supabase.from("activities").update(updatePayload).eq("id", activityId);
      if (error) {
        console.error("Erro ao atualizar atividade (drag):", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível atualizar a atividade.",
          variant: "destructive",
        });
        fetchActivities();
      }
    },
    [fetchActivities, toast]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const to = String(over.id) as KanbanStatusKey;
      if (to !== "open" && to !== "in_progress" && to !== "completed") return;

      const from = (active.data.current as any)?.fromStatus as KanbanStatusKey | undefined;
      if (from === to) return;

      // Regras do usuário:
      // - Não pode arrastar para Concluídos (só vai para lá ao concluir no modal de detalhes da oportunidade)
      // - Card concluído não sai de Concluídos (drag desabilitado, mas garantimos aqui também)
      if (to === "completed") {
        toast({
          title: "Ação não permitida",
          description: "Para concluir, finalize a atividade dentro dos detalhes da oportunidade.",
          variant: "destructive",
        });
        return;
      }
      if (from === "completed") return;

      const activityId = String(active.id);
      updateActivityKanbanStatus(activityId, to);

      // Ao mover para "Em andamento", abrir automaticamente os detalhes da oportunidade
      if (to === "in_progress") {
        const act = activities.find((a) => a.id === activityId);
        if (act?.pipeline_card_id) {
          // pequena defasagem para garantir state otimista aplicado
          setTimeout(() => handleOpenDealDetailsAndEditActivity(act), 0);
        }
      }
    },
    [activities, handleOpenDealDetailsAndEditActivity, toast, updateActivityKanbanStatus]
  );

  function ActivityCardKanban({ activity }: { activity: ActivityData }) {
    const status = getKanbanStatus(activity);
    const isLockedCompleted = status === "completed";
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: activity.id,
      data: { fromStatus: status },
      disabled: isLockedCompleted,
    });
    const style = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      zIndex: isDragging ? 50 : undefined,
    } as any;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "border border-[#e0e0e0] bg-white dark:bg-[#0f0f0f] dark:border-gray-700 rounded-none p-2",
          "hover:bg-blue-50 dark:hover:bg-[#1f2937] transition-colors",
          isLockedCompleted
            ? "cursor-default select-none"
            : "cursor-grab active:cursor-grabbing touch-none select-none",
          // Quando estamos usando DragOverlay, esconder o card original evita o “duplicado/erro atrás”
          isDragging && "opacity-0"
        )}
        {...attributes}
        {...(!isLockedCompleted ? listeners : {})}
        onClick={() => {
          if (isDraggingRef.current) return;
          // Regra: na coluna "Concluídos", abrir apenas os detalhes do negócio (sem edição automática).
          if (activity.pipeline_card_id) {
            if (status === "completed") {
              handleOpenDealDetailsOnly(activity, { fromCompleted: true });
            } else {
              handleOpenDealDetailsAndEditActivity(activity);
            }
            return;
          }
          toast({
            title: "Sem oportunidade vinculada",
            description: "Esta atividade não está vinculada a uma oportunidade.",
            variant: "destructive",
          });
        }}
      >
        {/* Linha 1: Título + Data (usa o espaço horizontal e reduz "vazio") */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs leading-tight line-clamp-1">
              {activity.subject}
            </div>
          </div>
          <div className="shrink-0 text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {activity.is_completed && activity.completed_at
              ? format(new Date(activity.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : format(new Date(activity.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </div>

        {/* Linha 2: informações em 2 colunas */}
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-700 dark:text-gray-300">
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Pipeline:</span>{" "}
            <span className="font-medium">{activity.pipeline_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Etapa:</span>{" "}
            <span className="font-medium">{activity.stage_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Resp.:</span>{" "}
            <span className="font-medium">{activity.responsible_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Contato:</span>{" "}
            {activity.pipeline_card_id ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (status === "completed") {
                    handleOpenDealDetailsOnly(activity, { fromCompleted: true });
                  } else {
                    handleOpenDealDetailsAndEditActivity(activity);
                  }
                }}
                className="font-medium text-black dark:text-white underline hover:opacity-80"
                title="Ver detalhes do negócio"
              >
                {activity.contact_name && activity.contact_name !== "-" ? activity.contact_name : activity.contact_phone || ""}
              </button>
            ) : (
              <span className="font-medium">
                {activity.contact_name && activity.contact_name !== "-" ? activity.contact_name : activity.contact_phone || ""}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function ActivityCardOverlay({ activity }: { activity: ActivityData }) {
    return (
      <div className="pointer-events-none w-[320px] border border-[#e0e0e0] bg-white dark:bg-[#0f0f0f] dark:border-gray-700 rounded-none p-2 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs leading-tight line-clamp-1">
              {activity.subject}
            </div>
          </div>
          <div className="shrink-0 text-[10px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {activity.is_completed && activity.completed_at
              ? format(new Date(activity.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
              : format(new Date(activity.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-700 dark:text-gray-300">
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Pipeline:</span>{" "}
            <span className="font-medium">{activity.pipeline_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Etapa:</span>{" "}
            <span className="font-medium">{activity.stage_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Resp.:</span>{" "}
            <span className="font-medium">{activity.responsible_name}</span>
          </div>
          <div className="min-w-0 truncate">
            <span className="text-gray-500 dark:text-gray-500">Contato:</span>{" "}
            <span className="font-medium">
              {activity.contact_name && activity.contact_name !== "-" ? activity.contact_name : activity.contact_phone || ""}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const activeDragActivity = useMemo(() => {
    if (!activeDragId) return null;
    return activities.find((a) => a.id === activeDragId) || null;
  }, [activeDragId, activities]);

  function KanbanDropZone({
    columnKey,
    children,
  }: {
    columnKey: KanbanStatusKey;
    children: React.ReactNode;
  }) {
    const { setNodeRef, isOver } = useDroppable({ id: columnKey });
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto p-2",
          isOver && "ring-2 ring-primary/40"
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0e0e0e] dark:border-gray-700 dark:text-gray-100">
      {/* Toolbar */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        <div
          className="flex flex-wrap items-center justify-between px-4 pt-3 pb-2 gap-2 h-auto"
          style={{ fontSize: "15px" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Atividades
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === "list" ? "kanban" : "list"))}
              className={cn(
                "h-7 px-2 rounded-none border text-xs inline-flex items-center gap-2",
                "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                "dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100 dark:hover:bg-[#222]",
                viewMode === "kanban" && "bg-[#FEF3C7] border-gray-300 text-black font-semibold dark:bg-gray-700 dark:text-white"
              )}
              title={viewMode === "list" ? "Mudar para Kanban" : "Mudar para Lista"}
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{viewMode === "list" ? "Kanban" : "Lista"}</span>
            </button>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-7 w-44 rounded-none text-xs border-gray-300 dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all">Todas categorias</SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de usuário (responsável) */}
            {userRole !== "user" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "h-7 px-2 rounded-none border text-xs inline-flex items-center gap-2 w-52 justify-between",
                      "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                      "dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100 dark:hover:bg-[#222]"
                    )}
                    title="Filtrar por usuário responsável"
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                      <span className="truncate">
                        {selectedResponsible === "ALL"
                          ? "Todos usuários"
                          : selectedResponsible === "UNASSIGNED"
                            ? "Sem responsável"
                            : (responsibleOptions.find((o) => o.id === selectedResponsible)?.name || "Usuário")}
                      </span>
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0 rounded-none border border-[#d4d4d4] bg-white dark:bg-[#1b1b1b] dark:border-gray-700 w-72"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <Command className="rounded-none">
                    <CommandInput placeholder="Pesquisar usuário..." className="h-9" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup heading="Filtro">
                        <CommandItem
                          value="ALL"
                          onSelect={() => setSelectedResponsible("ALL")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedResponsible === "ALL" ? "opacity-100" : "opacity-0")} />
                          Todos usuários
                        </CommandItem>
                        <CommandItem
                          value="UNASSIGNED"
                          onSelect={() => setSelectedResponsible("UNASSIGNED")}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedResponsible === "UNASSIGNED" ? "opacity-100" : "opacity-0")} />
                          Sem responsável
                        </CommandItem>
                      </CommandGroup>
                      <CommandGroup heading="Usuários">
                        {responsibleOptions.map((opt) => (
                          <CommandItem
                            key={opt.id}
                            value={opt.name}
                            onSelect={() => setSelectedResponsible(opt.id)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedResponsible === opt.id ? "opacity-100" : "opacity-0")} />
                            {opt.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <button
                type="button"
                disabled
                className={cn(
                  "h-7 px-2 rounded-none border text-xs inline-flex items-center gap-2 w-52 justify-between opacity-70 cursor-not-allowed",
                  "border-gray-300 bg-white text-gray-800",
                  "dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100"
                )}
                title="Usuários com nível USER veem apenas suas atividades"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                  <span className="truncate">Minhas atividades</span>
                </span>
              </button>
            )}

            {/* Filtro de data (inicial e final) */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-7 px-2 rounded-none border text-xs inline-flex items-center gap-2",
                    "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                    "dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100 dark:hover:bg-[#222]"
                  )}
                  title="Filtrar por data inicial"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">
                    {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                  </span>
                  {dateFrom && (
                    <span
                      className="ml-1 text-[10px] px-1 border border-gray-300 dark:border-gray-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDateFrom(undefined);
                      }}
                      title="Limpar"
                    >
                      ×
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-2 rounded-none border border-[#d4d4d4] bg-white dark:bg-[#1b1b1b] dark:border-gray-700"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => setDateFrom(d)}
                  locale={ptBR}
                  initialFocus
                  className="bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-7 px-2 rounded-none border text-xs inline-flex items-center gap-2",
                    "border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
                    "dark:border-gray-700 dark:bg-[#1b1b1b] dark:text-gray-100 dark:hover:bg-[#222]"
                  )}
                  title="Filtrar por data final"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">
                    {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                  </span>
                  {dateTo && (
                    <span
                      className="ml-1 text-[10px] px-1 border border-gray-300 dark:border-gray-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDateTo(undefined);
                      }}
                      title="Limpar"
                    >
                      ×
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-2 rounded-none border border-[#d4d4d4] bg-white dark:bg-[#1b1b1b] dark:border-gray-700"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => setDateTo(d)}
                  locale={ptBR}
                  initialFocus
                  className="bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100"
                />
              </PopoverContent>
            </Popover>

            <div className="relative w-64 max-w-sm">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3 dark:text-gray-400" />
              <Input
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div
        className={cn(
          "flex-1 bg-[#e6e6e6] dark:bg-[#050505] relative",
          viewMode === "list" ? "overflow-auto" : "overflow-hidden"
        )}
      >
        {viewMode === "list" ? (
          <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
            {/*
              Padronização de largura das colunas no modo lista:
              - Usar o mesmo tamanho atual do Pipeline (150px)
              - Se exceder, usar truncate (reticências) e title para ver completo no hover
            */}
            <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#2a2a2a]">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center gap-1">
                    <MapIcon className="h-3 w-3 text-gray-400" />
                    <span>Pipeline</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[140px] w-[140px] max-w-[140px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center gap-1 whitespace-nowrap">
                    <Tag className="h-3 w-3 text-gray-400" />
                    <span>Tipo da Atividade</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-gray-400" />
                    <span>Assunto</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-center gap-1">
                    <CalendarClock className="h-3 w-3 text-gray-400" />
                    <span>Data Prevista</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center gap-1">
                    <Columns className="h-3 w-3 text-gray-400" />
                    <span>Etapa</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-gray-400" />
                    <span>Nome</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-400" />
                    <span>Responsável</span>
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] w-[150px] max-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-center gap-1">
                    <Phone className="h-3 w-3 text-gray-400" />
                    <span>Telefone</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !isDataReady ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1f1f1f]">
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                      <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700"></td>
                  </tr>
                ))
              ) : filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a]">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarClock className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                      <p className="text-gray-500 font-medium dark:text-gray-300">
                        Nenhuma atividade encontrada.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937] cursor-pointer"
                    onClick={() => {
                      if (!activity.pipeline_card_id) return;
                      handleOpenDealDetailsAndEditActivityFromList(activity);
                    }}
                  >
                    <td className="border border-[#e0e0e0] px-2 py-0 w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200">
                      <div className="truncate" title={activity.pipeline_name || ''}>
                        {activity.pipeline_name}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 w-[140px] max-w-[140px] dark:border-gray-700 dark:text-gray-200">
                      <div className="truncate" title={activity.type || ''}>
                        {activity.type || "-"}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200 font-medium">
                      <div className="truncate" title={activity.subject || ''}>
                        {activity.subject}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200">
                      <div
                        className="truncate mx-auto"
                        title={format(new Date(activity.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      >
                        {format(new Date(activity.scheduled_for), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200">
                      <div className="truncate" title={activity.stage_name || ''}>
                        <Badge variant="outline" className="rounded-none font-normal border-gray-300 dark:border-gray-600 max-w-full truncate">
                          {activity.stage_name}
                        </Badge>
                      </div>
                    </td>
                      <td className="border border-[#e0e0e0] px-2 py-0 w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200">
                        {activity.pipeline_card_id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenDealDetailsAndEditActivityFromList(activity);
                            }}
                            className="text-black dark:text-white underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
                            title="Ver detalhes do negócio"
                          >
                            <div className="truncate max-w-[150px]" title={activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}>
                              {activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}
                            </div>
                          </button>
                        ) : (
                          <div className="truncate" title={activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}>
                            {activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}
                          </div>
                        )}
                      </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 w-[150px] max-w-[150px] dark:border-gray-700 dark:text-gray-200">
                      <div className="truncate" title={activity.responsible_name || ''}>
                        {activity.responsible_name}
                      </div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center w-[150px] max-w-[150px] font-mono dark:border-gray-700 dark:text-gray-200">
                      <div className="truncate mx-auto" title={activity.contact_phone || ''}>
                        {activity.contact_phone}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="p-3 h-full overflow-hidden">
            {isLoading || !isDataReady ? (
              <div className="text-gray-500 dark:text-gray-400 text-sm">Carregando atividades...</div>
            ) : kanbanColumns.length === 0 ? (
              <div className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma atividade encontrada.</div>
            ) : (
              <div className="h-full overflow-x-hidden">
                {/* Cards de filtro (contadores grandes) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {[
                    { key: "scheduled", label: "Atividades agendadas", count: kanbanCounts.scheduled },
                    { key: "overdue", label: "Atividades em atraso", count: kanbanCounts.overdue },
                    { key: "completed", label: "Atividades concluídas", count: kanbanCounts.completed },
                    { key: "all", label: "Todas", count: kanbanCounts.all },
                  ].map((card: any) => {
                    const active = kanbanQuickFilter === card.key;
                    return (
                      <button
                        key={card.key}
                        type="button"
                        onClick={() => setKanbanQuickFilter(card.key)}
                        className={cn(
                          "rounded-none border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-[#d4d4d4] bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-[#111111] dark:hover:bg-[#1a1a1a]"
                        )}
                      >
                        <div className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">
                          {card.count}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                          {card.label}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(e) => {
                    isDraggingRef.current = true;
                    setActiveDragId(String(e.active.id));
                  }}
                  onDragCancel={() => {
                    isDraggingRef.current = false;
                    setActiveDragId(null);
                  }}
                  onDragEnd={(e) => {
                    isDraggingRef.current = false;
                    handleDragEnd(e);
                    setActiveDragId(null);
                  }}
                >
                  <div className="flex gap-3 h-full items-stretch w-full min-w-0">
                    {kanbanColumns.map((col) => (
                      <div
                        key={col.key}
                        className="flex-1 min-w-0 bg-white border border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700 rounded-none flex flex-col h-full"
                      >
                        <div className="shrink-0 bg-[#f3f3f3] dark:bg-[#3a3a3a] border-b border-[#d4d4d4] dark:border-gray-700 px-2 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {col.name}
                            </div>
                            <Badge
                              variant="outline"
                              className="rounded-none text-[10px] h-5 px-1.5 border-gray-300 dark:border-gray-600"
                            >
                              {col.items.length}
                            </Badge>
                          </div>
                        </div>

                        <KanbanDropZone columnKey={col.key}>
                          <div className="space-y-2">
                            {col.items.map((activity) => (
                              <ActivityCardKanban key={activity.id} activity={activity} />
                            ))}
                          </div>
                        </KanbanDropZone>
                      </div>
                    ))}
                  </div>

                  {typeof document !== "undefined" &&
                    createPortal(
                      <DragOverlay>
                        {activeDragActivity ? <ActivityCardOverlay activity={activeDragActivity} /> : null}
                      </DragOverlay>,
                      document.body
                    )}
                </DndContext>
              </div>
            )}
          </div>
        )}
        {viewMode === "list" && (
          <>
            {/* Footer fixo com paginação */}
            <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Linhas {startIndex}-{endIndex} de {totalCount || 0}
                  </span>
                  <div className="flex items-center gap-1">
                    <span>Linhas/página:</span>
                    <Select value={String(pageSize)} onValueChange={(value) => {
                      const parsed = Number(value);
                      const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
                      setPageSize(normalized);
                      setPage(1);
                    }}>
                      <SelectTrigger className="h-7 w-24 rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["10", "25", "50", "100", "200"].map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || isLoading}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} / {totalPages}
                  </span>
                  <button
                    className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={isLoading || page >= totalPages}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <Sheet
        open={Boolean(selectedDealDetails)}
        onOpenChange={(open) => {
          if (!open) attemptCloseDealDetails();
        }}
      >
        <SheetContent 
          side="right" 
          className="p-0 sm:max-w-[90vw] w-[90vw] border-l border-gray-200 dark:border-gray-800 shadow-2xl transition-all duration-500 ease-in-out [&>button.absolute]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalhes do Negócio</SheetTitle>
          </SheetHeader>
          {selectedDealDetails && selectedDealDetails.cardId && (
            <DealDetailsPage 
              cardId={selectedDealDetails.cardId} 
              workspaceId={selectedWorkspace?.workspace_id || undefined}
              openActivityEditId={autoOpenActivityEditId || undefined}
              mode={autoOpenActivityEditId ? "activity_edit" : "full"}
              onClose={attemptCloseDealDetails}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Ao clicar em uma atividade Concluída, forçar agendamento de uma nova (não pode fechar até criar) */}
      <CreateActivityModal
        isOpen={forceRescheduleModalOpen}
        onClose={() => {
          // Bloquear fechamento: só fecha após criar uma nova atividade
          if (forceRescheduleModalOpen) return;
        }}
        contactId={forceRescheduleContext?.contactId || ""}
        pipelineCardId={forceRescheduleContext?.pipelineCardId || undefined}
        onActivityCreated={() => {
          setForceRescheduleModalOpen(false);
          setForceRescheduleContext(null);
          fetchActivities();
        }}
        isDarkMode={document.documentElement.classList.contains("dark")}
      />
    </div>
  );
}