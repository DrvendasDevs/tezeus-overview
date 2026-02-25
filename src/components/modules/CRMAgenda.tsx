import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Phone,
  Briefcase,
  Map as MapIcon,
  Columns,
  X,
  ChevronsUpDown,
  Check
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek, addMonths, subMonths, addDays, subDays, addWeeks, subWeeks, startOfDay, endOfDay, getHours, getMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DealDetailsPage } from "@/pages/DealDetailsPage";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";

interface ActivityData {
  id: string;
  subject: string;
  scheduled_for: string;
  duration_minutes?: number;
  is_completed: boolean;
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

type ViewType = 'day' | 'week' | 'month';

export function CRMAgenda() {
  const { selectedWorkspace } = useWorkspace();
  const { user, userRole } = useAuth();
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDealDetails, setSelectedDealDetails] = useState<SelectedDealDetails | null>(null);
  const [autoOpenActivityEditId, setAutoOpenActivityEditId] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedResponsible, setSelectedResponsible] = useState<string>("ALL"); // ALL | userId
  const { members: workspaceMembers } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const [openDayPopoverKey, setOpenDayPopoverKey] = useState<string | null>(null);
  const { toast } = useToast();

  const canFilterByUser = userRole === "master" || userRole === "admin";

  // ✅ Garantir regra: user só vê suas atividades
  useEffect(() => {
    if (userRole === "user" && user?.id) {
      setSelectedResponsible(user.id);
    }
  }, [userRole, user?.id]);

  const responsibleOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const m of workspaceMembers || []) {
      const id = (m as any)?.user?.id || (m as any)?.user_id;
      if (!id) continue;
      const profile = String((m as any)?.user?.profile || (m as any)?.role || "").toLowerCase().trim();
      if (profile === "master" || profile === "support") continue;
      if (profile !== "admin" && profile !== "user") continue;
      const name = String((m as any)?.user?.name || "").trim() || String((m as any)?.user?.email || "").trim();
      if (!name) continue;
      byId.set(id, { id, name });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [workspaceMembers]);

  const handleOpenDealDetails = (activity: ActivityData) => {
    if (!activity.pipeline_card_id) {
      return;
    }
    setAutoOpenActivityEditId(null);
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

  const handleOpenDealDetailsAndEditActivity = (activity: ActivityData) => {
    if (!activity.pipeline_card_id) return;
    setAutoOpenActivityEditId(activity.id);
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

  const handleCloseDealDetails = () => {
    setSelectedDealDetails(null);
    setAutoOpenActivityEditId(null);
  };

  const fetchActivities = async () => {
    if (!selectedWorkspace?.workspace_id) return;

    try {
      setIsLoading(true);

      // Buscar atividades baseado na visualização atual
      let searchStart: Date;
      let searchEnd: Date;

      if (view === 'day') {
        searchStart = startOfDay(currentDate);
        searchEnd = endOfDay(currentDate);
      } else if (view === 'week') {
        const weekStart = startOfWeek(currentDate, { locale: ptBR });
        const weekEnd = endOfWeek(currentDate, { locale: ptBR });
        searchStart = startOfDay(weekStart);
        searchEnd = endOfDay(weekEnd);
      } else {
        // month
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        searchStart = new Date(monthStart);
        searchStart.setDate(searchStart.getDate() - 7);
        searchEnd = new Date(monthEnd);
        searchEnd.setDate(searchEnd.getDate() + 7);
      }

      let query = supabase
        .from("activities")
        .select("*")
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .gte("scheduled_for", searchStart.toISOString())
        .lte("scheduled_for", searchEnd.toISOString())
        .order("scheduled_for", { ascending: true });

      if (userRole === "user" && user?.id) {
        query = query.eq("responsible_id", user.id);
      } else if (canFilterByUser && selectedResponsible !== "ALL") {
        query = query.eq("responsible_id", selectedResponsible);
      }

      const { data: activitiesData, error } = await query;

      if (error) throw error;

      if (!activitiesData || activitiesData.length === 0) {
        setActivities([]);
        return;
      }

      // Buscar nomes dos responsáveis
      const responsibleIds = activitiesData
        .map((a) => a.responsible_id)
        .filter(Boolean) as string[];
      
      const uniqueResponsibleIds = [...new Set(responsibleIds)];
      let usersMap = new Map<string, string>();

      if (uniqueResponsibleIds.length > 0) {
        const { data: users } = await supabase
          .from("system_users")
          .select("id, name")
          .in("id", uniqueResponsibleIds);

        users?.forEach((u) => usersMap.set(u.id, u.name));
      }

      // Buscar cartões do pipeline relacionados
      const pipelineCardIds = activitiesData
        .map((a) => a.pipeline_card_id)
        .filter(Boolean) as string[];

      const activityContactIds = activitiesData
        .map((a) => a.contact_id)
        .filter(Boolean) as string[];

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

      const allContactIds = new Set<string>();
      activityContactIds.forEach(id => allContactIds.add(id));

      let directContactsMap = new Map<string, { name: string; phone: string }>();
      if (allContactIds.size > 0) {
        const { data: directContactsData, error: contactsError } = await supabase
          .from("contacts")
          .select("id, name, phone")
          .in("id", Array.from(allContactIds))
          .eq("workspace_id", selectedWorkspace.workspace_id);

        if (contactsError) {
          console.error("Erro ao buscar contatos das atividades:", contactsError);
        }

        directContactsData?.forEach((contact) => {
          directContactsMap.set(contact.id, {
            name: contact.name || "-",
            phone: contact.phone || "-",
          });
        });
      }

      if (pipelineCardIds.length > 0) {
        const { data: cardsPositions, error: cardsError } = await supabase
          .from("v_card_positions")
          .select("*")
          .in("card_id", [...new Set(pipelineCardIds)]);

        if (cardsError) {
          console.error("Erro ao buscar posições dos cards:", cardsError);
        }

        if (cardsPositions && cardsPositions.length > 0) {
          cardsPositions.forEach((card: any) => {
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

            // Atualizar contatos diretos se necessário
            if (card.contact_id && card.contact_name) {
              directContactsMap.set(card.contact_id, {
                name: card.contact_name,
                phone: card.contact_phone || "-",
              });
            }
          });
        }
      }

      const formattedActivities: ActivityData[] = activitiesData
        .map((item: any) => {
          if (item.is_completed) {
            return null;
          }
          const card = item.pipeline_card_id ? pipelineCardsMap.get(item.pipeline_card_id) : null;

          if (item.pipeline_card_id && card) {
            const cardStatus = card.status?.toLowerCase().trim() ?? "";
            const allowedOpenStatuses = ["aberto", "open"];
            if (cardStatus && !allowedOpenStatuses.includes(cardStatus)) {
              return null;
            }
          }

          const directContact = item.contact_id ? directContactsMap.get(item.contact_id) : null;
          
          const pipelineName = card?.pipeline_name || "-";
          const stageName = card?.column_name || "-";
          const contactPhone = card?.contact_phone || directContact?.phone || "-";
          const contactName = card?.contact_name || directContact?.name || card?.description || "-";
          const dealName = card?.description || "-";
          const contactId = item.contact_id || card?.contact_id || null;

          return {
            id: item.id,
            subject: item.subject,
            scheduled_for: item.scheduled_for,
            is_completed: item.is_completed,
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
            duration_minutes: item.duration_minutes,
            type: item.type,
          };
        })
        .filter(Boolean) as ActivityData[];

      setActivities(formattedActivities);
    } catch (error: any) {
      console.error("Erro ao buscar agenda:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível carregar a agenda.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [selectedWorkspace?.workspace_id, currentDate, view, selectedResponsible]);

  // Agrupar atividades por data
  const activitiesByDate = useMemo(() => {
    const grouped = new Map<string, ActivityData[]>();
    activities.forEach((activity) => {
      const dateKey = format(new Date(activity.scheduled_for), "yyyy-MM-dd", { locale: ptBR });
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(activity);
    });
    return grouped;
  }, [activities]);

  // Calcular dias do calendário
  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { locale: ptBR });
      const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [currentDate];
    }
  }, [currentDate, view]);

  const weekDays = useMemo(() => {
    const firstDay = startOfWeek(new Date(), { locale: ptBR });
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(firstDay);
      day.setDate(day.getDate() + i);
      return format(day, "EEE", { locale: ptBR });
    });
  }, []);

  const getActivitiesForDate = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd", { locale: ptBR });
    return activitiesByDate.get(dateKey) || [];
  };

  // Função para calcular o layout de atividades sobrepostas (estilo Google Agenda)
  const getLayoutedActivities = (date: Date) => {
    const dayActivities = getActivitiesForDate(date);
    if (dayActivities.length === 0) return [];

    // Ordenar por horário de início
    const sorted = [...dayActivities].sort((a, b) => 
      new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    );

    // Agrupar atividades que se sobrepõem (considerando duração padrão de 1h para visualização)
    const groups: ActivityData[][] = [];
    let currentGroup: ActivityData[] = [];
    let groupEnd = 0;

    sorted.forEach(activity => {
      const start = new Date(activity.scheduled_for).getTime();
      const duration = (activity.duration_minutes || 60) * 60 * 1000;
      const end = start + duration;

      if (currentGroup.length > 0 && start < groupEnd) {
        currentGroup.push(activity);
        groupEnd = Math.max(groupEnd, end);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [activity];
        groupEnd = end;
      }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    const layouted: (ActivityData & { leftOffset: number; widthPercent: number; zIndex: number; isLastInGroup: boolean })[] = [];

    groups.forEach(group => {
      const columns: string[][] = []; // IDs das atividades em cada sub-coluna
      group.forEach(activity => {
        const start = new Date(activity.scheduled_for).getTime();

        let colIndex = -1;
        for (let i = 0; i < columns.length; i++) {
          const lastIdInCol = columns[i][columns[i].length - 1];
          const lastInCol = group.find(a => a.id === lastIdInCol);
          if (lastInCol) {
            const lastDuration = (lastInCol.duration_minutes || 60) * 60 * 1000;
            const lastEnd = new Date(lastInCol.scheduled_for).getTime() + lastDuration;
            if (start >= lastEnd) {
              colIndex = i;
              break;
            }
          }
        }

        if (colIndex === -1) {
          colIndex = columns.length;
          columns.push([activity.id]);
        } else {
          columns[colIndex].push(activity.id);
        }
      });

      const totalCols = columns.length || 1;
      const baseWidth = 1 / totalCols; // Divisão exata (ex: 0.33 para 3 cards)
      
      group.forEach(activity => {
        const colIndex = columns.findIndex(col => col.includes(activity.id));
        
        layouted.push({
          ...activity,
          leftOffset: colIndex * baseWidth,
          widthPercent: baseWidth,
          zIndex: 10 + colIndex,
          isLastInGroup: colIndex === totalCols - 1
        });
      });
    });

    return layouted;
  };

  const handlePrevious = () => {
    if (view === 'day') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const getViewTitle = () => {
    if (view === 'day') {
      return format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return `${format(weekStart, "dd 'de' MMM", { locale: ptBR })} - ${format(weekEnd, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    } else {
      return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const selectedDateActivities = selectedDate ? getActivitiesForDate(selectedDate) : [];

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0e0e0e] dark:border-gray-700 dark:text-gray-100">
      {/* Toolbar */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Agenda
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro por usuário (somente master/admin) */}
            {canFilterByUser && (
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
                        <CommandItem value="ALL" onSelect={() => setSelectedResponsible("ALL")}>
                          <Check className={cn("mr-2 h-4 w-4", selectedResponsible === "ALL" ? "opacity-100" : "opacity-0")} />
                          Todos usuários
                        </CommandItem>
                      </CommandGroup>
                      <CommandGroup heading="Usuários">
                        {responsibleOptions.map((opt) => (
                          <CommandItem key={opt.id} value={opt.name} onSelect={() => setSelectedResponsible(opt.id)}>
                            <Check className={cn("mr-2 h-4 w-4", selectedResponsible === opt.id ? "opacity-100" : "opacity-0")} />
                            {opt.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
            <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded-none">
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
                className="h-7 text-xs rounded-none border-0"
              >
                Dia
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
                className="h-7 text-xs rounded-none border-0 border-l border-gray-300 dark:border-gray-600"
              >
                Semana
              </Button>
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                className="h-7 text-xs rounded-none border-0 border-l border-gray-300 dark:border-gray-600"
              >
                Mês
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-7 text-xs rounded-none border-gray-300 dark:border-gray-600"
            >
              Hoje
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="h-7 w-7 rounded-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-7 w-7 rounded-none"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[280px] text-center">
              {getViewTitle()}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505] p-4">
        {isLoading ? (
          <div className="bg-white dark:bg-[#111111] border border-gray-300 dark:border-gray-700 p-4">
            <div className="h-96 bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        ) : view === 'day' ? (
          // Visualização Dia
          <div className="bg-white dark:bg-[#111111] border border-gray-300 dark:border-gray-700 shadow-sm">
            <div className="border-b border-gray-300 dark:border-gray-700 px-4 py-2 bg-[#f8f9fa] dark:bg-[#1f1f1f]">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h3>
            </div>
            <div className="relative" style={{ minHeight: '1440px' }}>
              {/* Timeline de horas */}
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 flex items-start border-b border-gray-200 dark:border-gray-700"
                    style={{ top: `${(hour / 24) * 100}%`, height: `${(1 / 24) * 100}%` }}
                  >
                    <div className="w-16 text-xs text-gray-500 dark:text-gray-400 px-2 pt-1 font-normal">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="flex-1"></div>
                  </div>
                );
              })}
              
              {/* Atividades do dia */}
              {getLayoutedActivities(currentDate).map((activity) => {
                const activityDate = new Date(activity.scheduled_for);
                const hour = getHours(activityDate);
                const minute = getMinutes(activityDate);
                const topPercent = ((hour * 60 + minute) / (24 * 60)) * 100;
                const activityEndDate = new Date(activityDate.getTime() + 60 * 60 * 1000);
                
                return (
                  <div
                    key={activity.id}
                    className="absolute"
                    style={{ 
                      top: `${topPercent}%`, 
                      left: `calc(64px + (100% - 64px) * ${activity.leftOffset})`,
                      width: `calc((100% - 64px) * ${activity.widthPercent})`,
                      zIndex: activity.zIndex,
                      minHeight: '40px'
                    }}
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 p-1.5 rounded-sm shadow-md hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer ring-1 ring-white dark:ring-[#111111] overflow-hidden">
                          <div className="text-[11px] font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
                            {activity.subject}
                          </div>
                          <div className="text-[9px] text-gray-600 dark:text-gray-400 font-medium">
                            {format(activityDate, "HH:mm")} - {format(activityEndDate, "HH:mm")}
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              Detalhes da Atividade
                            </h3>
                          </div>
                        </div>
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 mt-0.5">
                              <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                  {format(activityDate, "HH:mm")} - {format(activityEndDate, "HH:mm")}
                                </span>
                                <Badge variant="outline" className="text-xs rounded-none border-gray-300 dark:border-gray-600">
                                  {activity.type || "-"}
                                </Badge>
                              </div>
                              <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                                {activity.subject}
                              </h4>
                              <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                {activity.pipeline_name && activity.pipeline_name !== "-" && (
                                  <div className="flex items-center gap-1">
                                    <MapIcon className="h-3 w-3" />
                                    <span>{activity.pipeline_name}</span>
                                  </div>
                                )}
                                {activity.stage_name && activity.stage_name !== "-" && (
                                  <div className="flex items-center gap-1">
                                    <Columns className="h-3 w-3" />
                                    <span>{activity.stage_name}</span>
                                  </div>
                                )}
                                {activity.contact_name && activity.contact_name !== "-" && (
                                  <div className="flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    {activity.pipeline_card_id ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDealDetails(activity)}
                                        className="text-black dark:text-white underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
                                        title="Ver detalhes do negócio"
                                      >
                                        {activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}
                                      </button>
                                    ) : (
                                      <span>{activity.contact_name && activity.contact_name !== '-' ? activity.contact_name : (activity.contact_phone || 'Sem nome')}</span>
                                    )}
                                  </div>
                                )}
                                {activity.contact_phone && activity.contact_phone !== "-" && (
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span className="font-mono">{activity.contact_phone}</span>
                                  </div>
                                )}
                                {activity.responsible_name && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{activity.responsible_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'week' ? (
          // Visualização Semana
          <div className="bg-white dark:bg-[#111111] border border-gray-300 dark:border-gray-700 shadow-sm">
            {/* Cabeçalho dos dias */}
            <div className="flex border-b border-gray-300 dark:border-gray-700 bg-[#f8f9fa] dark:bg-[#1f1f1f]">
              <div className="w-16 border-r border-gray-300 dark:border-gray-700"></div>
              <div className="grid grid-cols-7 flex-1">
                {calendarDays.map((day, index) => {
                  const isDayToday = isToday(day);
                  return (
                    <div
                      key={index}
                      className={cn(
                        "px-2 py-2 text-center border-r border-gray-300 dark:border-gray-700 last:border-r-0",
                        isDayToday && "bg-yellow-50 dark:bg-yellow-900/20"
                      )}
                    >
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {format(day, "EEE", { locale: ptBR })}
                      </div>
                      <div className={cn(
                        "text-sm font-medium mt-1",
                        isDayToday && "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center mx-auto",
                        !isDayToday && "text-gray-900 dark:text-gray-100"
                      )}>
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Timeline da semana */}
            <div className="relative" style={{ minHeight: '1440px' }}>
              {/* Linhas de horas */}
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i;
                return (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 flex border-b border-gray-200 dark:border-gray-700"
                    style={{ top: `${(hour / 24) * 100}%`, height: `${(1 / 24) * 100}%` }}
                  >
                    <div className="w-16 text-xs text-gray-500 dark:text-gray-400 px-2 pt-1 font-normal border-r border-gray-300 dark:border-gray-700">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div className="grid grid-cols-7 flex-1">
                      {calendarDays.map((day, dayIndex) => (
                        <div
                          key={dayIndex}
                          className="border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                        ></div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Atividades da semana */}
              {calendarDays.map((day, dayIndex) => {
                const dayLayouted = getLayoutedActivities(day);
                return dayLayouted.map((activity) => {
                  const activityDate = new Date(activity.scheduled_for);
                  const hour = getHours(activityDate);
                  const minute = getMinutes(activityDate);
                  const topPercent = ((hour * 60 + minute) / (24 * 60)) * 100;
                  const activityEndDate = new Date(activityDate.getTime() + 60 * 60 * 1000);
                  
                  return (
                    <div
                      key={activity.id}
                      className="absolute"
                      style={{
                        top: `${topPercent}%`,
                        left: `calc(64px + (100% - 64px) * ${dayIndex} / 7 + ((100% - 64px) / 7) * ${activity.leftOffset})`,
                        width: `calc(((100% - 64px) / 7) * ${activity.widthPercent})`,
                        zIndex: activity.zIndex,
                        minHeight: '30px'
                      }}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 p-1.5 rounded-sm shadow-md hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer text-xs ring-1 ring-white dark:ring-[#111111] overflow-hidden">
                            <div className="font-bold text-gray-900 dark:text-gray-100 truncate text-[10px] leading-tight">
                              {activity.subject}
                            </div>
                            <div className="text-[8px] text-gray-600 dark:text-gray-400 font-medium">
                              {format(activityDate, "HH:mm")} - {format(activityEndDate, "HH:mm")}
                            </div>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                Detalhes da Atividade
                              </h3>
                            </div>
                          </div>
                          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0 mt-0.5">
                                <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                    {format(activityDate, "HH:mm")} - {format(activityEndDate, "HH:mm")}
                                  </span>
                                  <Badge variant="outline" className="text-xs rounded-none border-gray-300 dark:border-gray-600">
                                    {activity.type || "-"}
                                  </Badge>
                                </div>
                                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                                  {activity.subject}
                                </h4>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                  {activity.pipeline_name && activity.pipeline_name !== "-" && (
                                    <div className="flex items-center gap-1">
                                      <MapIcon className="h-3 w-3" />
                                      <span>{activity.pipeline_name}</span>
                                    </div>
                                  )}
                                  {activity.stage_name && activity.stage_name !== "-" && (
                                    <div className="flex items-center gap-1">
                                      <Columns className="h-3 w-3" />
                                      <span>{activity.stage_name}</span>
                                    </div>
                                  )}
                                  {activity.contact_name && activity.contact_name !== "-" && (
                                    <div className="flex items-center gap-1">
                                      <Briefcase className="h-3 w-3" />
                                      {activity.pipeline_card_id ? (
                                        <button
                                          type="button"
                                        onClick={() => handleOpenDealDetailsAndEditActivity(activity)}
                                          className="text-black dark:text-white underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
                                          title="Ver detalhes do negócio"
                                        >
                                          {activity.contact_name}
                                        </button>
                                      ) : (
                                        <span>{activity.contact_name}</span>
                                      )}
                                    </div>
                                  )}
                                  {activity.contact_phone && activity.contact_phone !== "-" && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span className="font-mono">{activity.contact_phone}</span>
                                    </div>
                                  )}
                                  {activity.responsible_name && (
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span>{activity.responsible_name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        ) : (
          // Visualização Mês
          <div className="bg-white dark:bg-[#111111] border border-gray-300 dark:border-gray-700 shadow-sm">
            {/* Week Days Header */}
            <div className="grid grid-cols-7 border-b border-gray-300 dark:border-gray-700">
              {calendarDays.slice(0, 7).map((day, index) => (
                <div
                  key={index}
                  className="px-1 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-300 dark:border-gray-700 last:border-r-0 bg-[#f8f9fa] dark:bg-[#1f1f1f]"
                >
                  <div>{format(day, "EEE", { locale: ptBR })}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayActivities = getActivitiesForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const dayKey = format(day, "yyyy-MM-dd", { locale: ptBR });

                return (
                  <Popover
                    key={dayKey}
                    open={openDayPopoverKey === dayKey}
                    onOpenChange={(open) => setOpenDayPopoverKey(open ? dayKey : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "min-h-[100px] border-r border-b border-gray-300 dark:border-gray-700 p-1 text-left hover:bg-gray-50 dark:hover:bg-[#1f1f1f] transition-colors w-full",
                          !isCurrentMonth && "bg-gray-50 dark:bg-[#0a0a0a] opacity-50",
                          isDayToday && "bg-yellow-50 dark:bg-yellow-900/20",
                          isSelected && "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500 dark:ring-blue-400"
                        )}
                        onClick={() => {
                          setSelectedDate(day);
                          if (dayActivities.length > 0) setOpenDayPopoverKey(dayKey);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isDayToday && "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center",
                              !isDayToday && "text-gray-700 dark:text-gray-300"
                            )}
                          >
                            {format(day, "d")}
                          </span>
                          {dayActivities.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="h-5 px-1.5 text-[10px] rounded-none bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            >
                              {dayActivities.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {dayActivities.slice(0, 3).map((activity) => (
                            <div
                              key={activity.id}
                              className="text-[10px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded truncate"
                              title={activity.subject}
                            >
                              {format(new Date(activity.scheduled_for), "HH:mm", { locale: ptBR })} {activity.subject}
                            </div>
                          ))}
                          {dayActivities.length > 3 && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                              +{dayActivities.length - 3} mais
                            </div>
                          )}
                        </div>
                      </button>
                    </PopoverTrigger>
                    {dayActivities.length > 0 && (
                      <PopoverContent className="w-80 p-0 bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-xl" align="start">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                setSelectedDate(null);
                                setOpenDayPopoverKey(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {dayActivities.length} {dayActivities.length === 1 ? "evento" : "eventos"}
                          </p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {dayActivities.map((activity) => (
                            <div
                              key={activity.id}
                              className="p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#1f1f1f] transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-0.5">
                                  <Clock className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                      {format(new Date(activity.scheduled_for), "HH:mm", { locale: ptBR })}
                                    </span>
                                    <Badge variant="outline" className="text-xs rounded-none border-gray-300 dark:border-gray-600">
                                      {activity.type || "-"}
                                    </Badge>
                                  </div>
                                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">
                                    {activity.subject}
                                  </h4>
                                  <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    {activity.pipeline_name && activity.pipeline_name !== "-" && (
                                      <div className="flex items-center gap-1">
                                        <MapIcon className="h-3 w-3" />
                                        <span>{activity.pipeline_name}</span>
                                      </div>
                                    )}
                                    {activity.stage_name && activity.stage_name !== "-" && (
                                      <div className="flex items-center gap-1">
                                        <Columns className="h-3 w-3" />
                                        <span>{activity.stage_name}</span>
                                      </div>
                                    )}
                                    {activity.contact_name && activity.contact_name !== "-" && (
                                      <div className="flex items-center gap-1">
                                        <Briefcase className="h-3 w-3" />
                                        {activity.pipeline_card_id ? (
                                          <button
                                            type="button"
                                            onClick={() => handleOpenDealDetailsAndEditActivity(activity)}
                                            className="text-black dark:text-white underline hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-sm"
                                            title="Ver detalhes do negócio"
                                          >
                                            {activity.contact_name}
                                          </button>
                                        ) : (
                                          <span>{activity.contact_name}</span>
                                        )}
                                      </div>
                                    )}
                                    {activity.contact_phone && activity.contact_phone !== "-" && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        <span className="font-mono">{activity.contact_phone}</span>
                                      </div>
                                    )}
                                    {activity.responsible_name && (
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        <span>{activity.responsible_name}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Sheet open={Boolean(selectedDealDetails)} onOpenChange={(open) => !open && handleCloseDealDetails()}>
        <SheetContent 
          side="right" 
          className="p-0 sm:max-w-[90vw] w-[90vw] border-l border-gray-200 dark:border-gray-800 shadow-2xl transition-all duration-500 ease-in-out [&>button.absolute]:hidden"
        >
          {selectedDealDetails && (
            <DealDetailsPage 
              cardId={selectedDealDetails.cardId} 
              workspaceId={selectedWorkspace?.workspace_id}
              openActivityEditId={autoOpenActivityEditId || undefined}
              mode={autoOpenActivityEditId ? "activity_edit" : "full"}
              onClose={handleCloseDealDetails}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
