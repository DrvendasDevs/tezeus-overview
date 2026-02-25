import { useParams, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Check, X, ChevronDown, Plus, Pencil, User, Mail, FileText, File, 
  Image as ImageIcon, ChevronRight, RefreshCw, Tag, DollarSign, CheckSquare, 
  Circle, MoreVertical, List, ChevronsUpDown, Clock, Phone, 
  Calendar as CalendarIconLucide, Video, MapPin, CheckCircle2, Copy, Link2, 
  Building2, Info, Lock, MessageSquare as MessageSquareIcon, 
  FileText as FileTextIcon, Mail as MailIcon, File as FileIcon, Receipt, 
  CheckCircle, Bold, Italic, Underline, ListOrdered, AlignLeft, 
  AlignRight, Strikethrough, AtSign, Music, Upload, Download 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { logCreate, logUpdate, logDelete } from "@/utils/auditLog";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCardHistory, cardHistoryQueryKey } from "@/hooks/useCardHistory";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddContactTagButton } from "@/components/chat/AddContactTagButton";
import { AttachmentPreviewModal } from "@/components/modals/AttachmentPreviewModal";
import { MarkAsLostModal } from "@/components/modals/MarkAsLostModal";
import { DealStatusMoveModal } from "@/components/modals/DealStatusMoveModal";
import { WhatsAppChat } from "@/components/modules/WhatsAppChat";
import { useWorkspaceContactFields } from "@/hooks/useWorkspaceContactFields";

interface DealDetailsPageProps {
  cardId?: string;
  workspaceId?: string;
  onClose?: () => void;
  // Quando informado, ao abrir o detalhe do negócio, abre automaticamente o modal de edição
  // da atividade específica (usado pelo Kanban de Atividades para acelerar o fluxo).
  openActivityEditId?: string;
  // Modo "resumido" para edição de atividade: mostra apenas Detalhes da oportunidade + Aba Atividades.
  mode?: "full" | "activity_edit";
}

export function DealDetailsPage({
  cardId: propCardId,
  workspaceId: propWorkspaceId,
  onClose,
  openActivityEditId,
  mode = "full",
}: DealDetailsPageProps = {}) {
  const { cardId: paramCardId, workspaceId: paramWorkspaceId } = useParams<{ cardId: string; workspaceId: string }>();
  
  const cardId = propCardId || paramCardId;
  const urlWorkspaceId = propWorkspaceId || paramWorkspaceId;
  
  const navigate = useNavigate();
  const { selectedWorkspace } = useWorkspace();
  const { user: authUser, userRole } = useAuth();
  const effectiveWorkspaceId = urlWorkspaceId || selectedWorkspace?.workspace_id;
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { members: workspaceMembers } = useWorkspaceMembers(effectiveWorkspaceId);
  const { fields: workspaceContactFields } = useWorkspaceContactFields(effectiveWorkspaceId || null);
  
  const [cardData, setCardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dealName, setDealName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [currentColumn, setCurrentColumn] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [contact, setContact] = useState<any>(null);
  const [contactExtraInfo, setContactExtraInfo] = useState<{ field_name: string; field_value: string | null }[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [users, setUsers] = useState<any[]>([]);
  const [contactTags, setContactTags] = useState<any[]>([]);
  const [cardProducts, setCardProducts] = useState<any[]>([]);
const [isProductModalOpen, setIsProductModalOpen] = useState(false);
const [availableProducts, setAvailableProducts] = useState<any[]>([]);
const [selectedProductId, setSelectedProductId] = useState<string>("");
const [manualValue, setManualValue] = useState<string>("");
const [productQuantity, setProductQuantity] = useState<number>(1);
  const [isEditingContactName, setIsEditingContactName] = useState(false);
  const [tempContactName, setTempContactName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<any | null>(null);
  const [activityAttachmentFile, setActivityAttachmentFile] = useState<File | null>(null);
  const [isUpdatingQualification, setIsUpdatingQualification] = useState(false);
  
  // Estados para anotações
  const [noteContent, setNoteContent] = useState("");
  const noteContentRef = useRef<HTMLDivElement>(null);
  
  // Estados para histórico
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const didInitActivityTimeRef = useRef(false);
  const lastAutoOpenedActivityEditIdRef = useRef<string | null>(null);

  const [mainTab, setMainTab] = useState<"anotacoes" | "atividade" | "mensagens">(() =>
    mode === "activity_edit" ? "atividade" : "anotacoes"
  );

  useEffect(() => {
    if (mode === "activity_edit") setMainTab("atividade");
  }, [mode]);
  
  // Estados para modal de seleção de coluna
  const [isColumnSelectModalOpen, setIsColumnSelectModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [availablePipelines, setAvailablePipelines] = useState<any[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);

  // Estados para transferência rápida (aba Visão Geral)
  const [transferPipelineId, setTransferPipelineId] = useState<string>("");
  const [transferColumnId, setTransferColumnId] = useState<string>("");
  const transferTouchedRef = useRef(false);
  const transferInFlightRef = useRef(false);
  const lastTransferKeyRef = useRef<string | null>(null);
  
  // Estado para popover de ações do card
  const [isCardActionsPopoverOpen, setIsCardActionsPopoverOpen] = useState(false);
  
// Estados para edição a partir do histórico
const [selectedActivityForEdit, setSelectedActivityForEdit] = useState<any | null>(null);
const [isActivityEditModalOpen, setIsActivityEditModalOpen] = useState(false);
const [activityEditModalTab, setActivityEditModalTab] = useState<"detalhes" | "atividade">("atividade");
const [activityEditForm, setActivityEditForm] = useState({
  type: "Ligação abordada",
  subject: "",
  description: "",
  availability: "livre",
  startDate: new Date(),
  startTime: "13:00",
  endDate: new Date(),
  endTime: "13:30",
  responsibleId: "",
  markAsDone: false
});

const [selectedNoteForEdit, setSelectedNoteForEdit] = useState<any | null>(null);
const [noteEditContent, setNoteEditContent] = useState("");
const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
const [editingNoteContent, setEditingNoteContent] = useState("");
const [conversationId, setConversationId] = useState<string | null>(null);

  // Editor sofisticado de detalhes do contato (campos obrigatórios + customizáveis)
  const [isDetailsEditorOpen, setIsDetailsEditorOpen] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<Record<string, string>>({});
  const [customDetailKeys, setCustomDetailKeys] = useState<string[]>([]);
  const [removedCustomDetailKeys, setRemovedCustomDetailKeys] = useState<string[]>([]);
  const [newDetailFieldName, setNewDetailFieldName] = useState("");
  const [newDetailFieldValue, setNewDetailFieldValue] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Tema real do app (observa a classe `dark` no <html> para manter modais consistentes)
  const [isUiDarkMode, setIsUiDarkMode] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsUiDarkMode(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(() => update());
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Ao abrir o modal de edição, iniciar sempre na aba de Atividade (edição)
  useEffect(() => {
    if (isActivityEditModalOpen) setActivityEditModalTab("atividade");
  }, [isActivityEditModalOpen]);
const [isEditingCompany, setIsEditingCompany] = useState(false);
const [tempCompany, setTempCompany] = useState("");
const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [isUpdatingResponsibleUser, setIsUpdatingResponsibleUser] = useState(false);

  const getUserDisplayName = () =>
    authUser?.user_metadata?.full_name ||
    authUser?.email ||
    authUser?.id ||
    'Sistema';

  const handleCopyContactPhone = useCallback(async () => {
    if (!contact?.phone) return;
    try {
      const digits = String(contact.phone).replace(/\D/g, '');
      await navigator.clipboard.writeText(digits);
      toast({
        title: "Copiado",
        description: "Número copiado sem formatação.",
      });
    } catch (e) {
      console.error('Erro ao copiar número:', e);
      toast({
        title: "Erro",
        description: "Não foi possível copiar o número.",
        variant: "destructive",
      });
    }
  }, [contact?.phone, toast]);

  const logStatusHistory = async (
    newStatus: string,
    valueAtStatus?: number | null,
    extra?: {
      oldStatus?: string | null;
      actionName?: string | null;
      lossReasonId?: string | null;
      lossReasonName?: string | null;
      lossComments?: string | null;
    }
  ) => {
    if (!cardId) return;
    try {
      await supabase.from('pipeline_card_history').insert({
        card_id: cardId,
        action: 'status_changed',
        changed_at: new Date().toISOString(),
        metadata: {
          old_status: extra?.oldStatus ?? (cardData as any)?.status ?? null,
          new_status: newStatus,
          action_name: extra?.actionName ?? null,
          loss_reason_id: extra?.lossReasonId ?? null,
          loss_reason_name: extra?.lossReasonName ?? null,
          loss_comments: extra?.lossComments ?? null,
          changed_by_id: authUser?.id || null,
          changed_by_name: getUserDisplayName(),
          status_value: valueAtStatus ?? null,
          status_value_currency: 'BRL',
        },
      });
    } catch (err) {
      console.error('Erro ao registrar histórico de status:', err);
    }
  };

  const eligibleTransferUsers = useMemo(() => {
    return (users || [])
      .filter((u: any) => {
        const p = String(u?.profile || "").toLowerCase().trim();
        return p === "admin" || p === "user";
      })
      .sort((a: any, b: any) => String(a?.name || "").localeCompare(String(b?.name || ""), "pt-BR"));
  }, [users]);

  const handleTransferResponsibleUser = useCallback(
    async (newUserId: string) => {
      if (!cardId) return;
      if (!effectiveWorkspaceId) return;
      if (!newUserId) return;

      const currentId = cardData?.responsible_user_id || null;
      if (currentId === newUserId) return;

      const oldUser = users.find((u: any) => u.id === currentId) || owner;
      const newUser = users.find((u: any) => u.id === newUserId);

      setIsUpdatingResponsibleUser(true);
      try {
        // 1) Atualiza responsável do negócio
        const { error: updateCardError } = await supabase
          .from("pipeline_cards")
          .update({
            responsible_user_id: newUserId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cardId);

        if (updateCardError) throw updateCardError;

        // 2) Atualiza responsável da conversa vinculada (se houver)
        const convId = cardData?.conversation_id || conversationId;
        if (convId) {
          const { error: convError } = await supabase
            .from("conversations")
            .update({
              assigned_user_id: newUserId,
              assigned_user_name: newUser?.name || null,
              assigned_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", convId)
            .eq("workspace_id", effectiveWorkspaceId);

          if (convError) {
            console.warn("⚠️ Falha ao atualizar conversa para o novo responsável:", convError);
          }
        }

        // 3) Log no histórico do negócio (para relatórios e auditoria)
        try {
          await supabase.from("pipeline_card_history").insert({
            card_id: cardId,
            action: "responsible_changed",
            changed_at: new Date().toISOString(),
            metadata: {
              old_responsible_user_id: currentId,
              old_responsible_user_name: oldUser?.name || null,
              new_responsible_user_id: newUserId,
              new_responsible_user_name: newUser?.name || null,
              changed_by_id: authUser?.id || null,
              changed_by_name: getUserDisplayName(),
            },
          });
        } catch (historyErr) {
          console.warn("⚠️ Não foi possível registrar histórico de responsável:", historyErr);
        }

        // Atualizar estados locais
        setCardData((prev: any) => (prev ? { ...prev, responsible_user_id: newUserId } : prev));
        setOwner((prev: any) => ({
          ...(prev || {}),
          id: newUser?.id || newUserId,
          name: newUser?.name || prev?.name,
          profile: newUser?.profile || prev?.profile,
          profile_image_url: newUser?.profile_image_url || prev?.profile_image_url,
        }));

        toast({
          title: "Responsável atualizado",
          description: "O responsável do negócio foi atualizado com sucesso.",
        });

        queryClient.invalidateQueries({ queryKey: ["card-history", cardId] });
      } catch (error: any) {
        console.error("Erro ao transferir responsável do negócio:", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível transferir o responsável do negócio.",
          variant: "destructive",
        });
      } finally {
        setIsUpdatingResponsibleUser(false);
      }
    },
    [
      authUser?.id,
      cardData?.conversation_id,
      cardData?.responsible_user_id,
      cardId,
      conversationId,
      effectiveWorkspaceId,
      getUserDisplayName,
      owner,
      queryClient,
      toast,
      users,
    ]
  );

  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    // remove non-digits
    const digits = raw.replace(/\D/g, '');
    // remove leading 55 (código Brasil) se presente
    const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
    // aplicar máscara (xx)xxxxx-xxxx ou (xx)xxxx-xxxx dependendo do tamanho
    if (withoutCountry.length === 10) {
      return `(${withoutCountry.slice(0,2)}) ${withoutCountry.slice(2,6)}-${withoutCountry.slice(6)}`;
    }
    if (withoutCountry.length >= 11) {
      return `(${withoutCountry.slice(0,2)}) ${withoutCountry.slice(2,7)}-${withoutCountry.slice(7,11)}`;
    }
    return withoutCountry;
  };

  type DealQualification = 'unqualified' | 'qualified' | 'disqualified';

  const normalizeDealQualification = (value: any): DealQualification => {
    if (value === 'qualified' || value === 'disqualified' || value === 'unqualified') return value;
    return 'unqualified';
  };

  const getQualificationLabel = (q: DealQualification) => {
    switch (q) {
      case 'qualified':
        return 'Qualificado';
      case 'disqualified':
        return 'Desqualificado';
      default:
        return 'Não qualificado';
    }
  };

  const handleUpdateDealQualification = async (newQualification: DealQualification) => {
    if (!cardId) return;
    const oldQualification = normalizeDealQualification(cardData?.qualification);

    if (oldQualification === newQualification) return;

    setIsUpdatingQualification(true);
    try {
      const { error } = await supabase
        .from('pipeline_cards')
        .update({
          qualification: newQualification,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cardId);

      if (error) throw error;

      // Registrar no histórico do card (para auditoria e timeline)
      try {
        await supabase.from('pipeline_card_history').insert({
          card_id: cardId,
          action: 'qualification_changed',
          changed_at: new Date().toISOString(),
          metadata: {
            old_qualification: oldQualification,
            new_qualification: newQualification,
            changed_by_id: authUser?.id || null,
            changed_by_name: getUserDisplayName(),
          },
        });
      } catch (historyErr) {
        console.warn('⚠️ Não foi possível registrar histórico de qualificação:', historyErr);
      }

      setCardData((prev: any) => ({ ...prev, qualification: newQualification }));
      queryClient.invalidateQueries({ queryKey: ['card-history', cardId] });

      toast({
        title: 'Qualificação atualizada',
        description: `Negócio marcado como ${getQualificationLabel(newQualification).toLowerCase()}.`,
      });
    } catch (err: any) {
      console.error('Erro ao atualizar qualificação do negócio:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível atualizar a qualificação do negócio.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingQualification(false);
    }
  };
  const [pipelineActions, setPipelineActions] = useState<any[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
const [confirmLossAction, setConfirmLossAction] = useState<any | null>(null);
const [isMarkAsLostModalOpen, setIsMarkAsLostModalOpen] = useState(false);
  const [dealStatusMoveOpen, setDealStatusMoveOpen] = useState(false);
  const [dealStatusMoveMode, setDealStatusMoveMode] = useState<"lost" | "reopen">("lost");
  const [isDealStatusMoveLoading, setIsDealStatusMoveLoading] = useState(false);
const [isMarkingAsLost, setIsMarkingAsLost] = useState(false);

  // Estados para visão geral
  // overviewData agora é useMemo (calculado diretamente, sem estado extra)
  
  // Usar hook de histórico
  const { data: historyEvents = [], isLoading: isLoadingHistory } = useCardHistory(cardId || "", contact?.id);
  
  // Estados para formulário de atividade
  const [activityForm, setActivityForm] = useState({
    type: "Ligação abordada",
    subject: "",
    description: "",
    availability: "livre",
    startDate: new Date(),
    startTime: "13:00",
    endDate: new Date(),
    endTime: "13:30",
    responsibleId: "",
    location: "",
    videoCall: false,
    markAsDone: false
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [selectedStartHour, setSelectedStartHour] = useState<number>(13);
  const [selectedStartMinute, setSelectedStartMinute] = useState<number>(0);
  const [selectedEndHour, setSelectedEndHour] = useState<number>(13);
  const [selectedEndMinute, setSelectedEndMinute] = useState<number>(30);
  
// Estados para seleção de datas/horas no modal de edição
const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
const [showEditEndDatePicker, setShowEditEndDatePicker] = useState(false);
const [showEditStartTimePicker, setShowEditStartTimePicker] = useState(false);
const [showEditEndTimePicker, setShowEditEndTimePicker] = useState(false);
const [editSelectedStartHour, setEditSelectedStartHour] = useState<number>(13);
const [editSelectedEndHour, setEditSelectedEndHour] = useState<number>(13);

const formatDateToInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (date: Date) => {
  return format(date, "HH:mm");
};

  const companyInfo = useMemo(() => {
    const match = (contactExtraInfo || []).find((f) => (f.field_name || "").trim().toLowerCase() === "empresa")
      || (contactExtraInfo || []).find((f) => (f.field_name || "").trim().toLowerCase() === "campo-empresa")
      || (contactExtraInfo || []).find((f) => (f.field_name || "").trim().toLowerCase().includes("empresa"));

    return {
      fieldName: match?.field_name || "empresa",
      value: (match?.field_value || "").trim(),
    };
  }, [contactExtraInfo]);

  const handleSaveCompany = async () => {
    if (!contact?.id || !effectiveWorkspaceId) return;
    const nextValue = (tempCompany || "").trim();

    try {
      setIsSavingCompany(true);

      // Buscar ID do campo existente (se houver)
      const { data: existingRows, error: existingError } = await supabase
        .from("contact_extra_info")
        .select("id, field_name")
        .eq("contact_id", contact.id)
        .eq("workspace_id", effectiveWorkspaceId);

      if (existingError) throw existingError;

      const normalizedTarget = (companyInfo.fieldName || "empresa").trim().toLowerCase();
      const existing = (existingRows || []).find((r: any) => (r.field_name || "").trim().toLowerCase() === normalizedTarget)
        || (existingRows || []).find((r: any) => (r.field_name || "").trim().toLowerCase() === "empresa")
        || (existingRows || []).find((r: any) => (r.field_name || "").trim().toLowerCase().includes("empresa"));

      if (!nextValue) {
        // Se apagar, remove o campo
        if (existing?.id) {
          const { error: delErr } = await supabase
            .from("contact_extra_info")
            .delete()
            .eq("id", existing.id);
          if (delErr) throw delErr;
        }
      } else if (existing?.id) {
        const { error: updErr } = await supabase
          .from("contact_extra_info")
          .update({ field_value: nextValue })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("contact_extra_info")
          .insert({
            contact_id: contact.id,
            workspace_id: effectiveWorkspaceId,
            field_name: companyInfo.fieldName || "empresa",
            field_value: nextValue,
          });
        if (insErr) throw insErr;
      }

      // Atualizar estado local sem destruir outros campos
      setContactExtraInfo((prev) => {
        const withoutCompany = (prev || []).filter((f) => {
          const key = (f.field_name || "").trim().toLowerCase();
          return key !== (companyInfo.fieldName || "empresa").trim().toLowerCase() && key !== "empresa" && key !== "campo-empresa";
        });
        if (!nextValue) return withoutCompany;
        return [...withoutCompany, { field_name: companyInfo.fieldName || "empresa", field_value: nextValue }];
      });

      setIsEditingCompany(false);
      toast({
        title: "Sucesso",
        description: "Empresa atualizada com sucesso.",
      });
    } catch (err: any) {
      console.error("Erro ao salvar empresa:", err);
      toast({
        title: "Erro",
        description: err?.message || "Não foi possível salvar a empresa.",
        variant: "destructive",
      });
    } finally {
      setIsSavingCompany(false);
    }
  };

  const getBrasiliaNow = () => {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = Number(get("year"));
    const month = Number(get("month"));
    const day = Number(get("day"));
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));

    return { year, month, day, hour, minute };
  };

  const getBrasiliaRoundedTimeRange = () => {
    const { year, month, day, hour, minute } = getBrasiliaNow();
    const startMinutes = hour * 60 + minute;
    // opções são de 5 em 5 min — arredondar pra CIMA (ex: 16:09 -> 16:10)
    const roundedStart = Math.ceil(startMinutes / 5) * 5;
    const clampedStart = Math.min(roundedStart, 23 * 60 + 55);
    // o próximo horário deve ser +5min (não +30)
    const roundedEnd = Math.min(clampedStart + 5, 23 * 60 + 55);

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const toHHmm = (total: number) => `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;

    return {
      startDate: new Date(year, month - 1, day),
      endDate: new Date(year, month - 1, day),
      startTime: toHHmm(clampedStart),
      endTime: toHHmm(roundedEnd),
      startHour: Math.floor(clampedStart / 60),
      startMinute: clampedStart % 60,
      endHour: Math.floor(roundedEnd / 60),
      endMinute: roundedEnd % 60,
    };
  };

const humanizeLabel = (label: string) => {
  if (!label) return "";
  const cleaned = label
    .replace(/:+$/g, "") // evita "Faturamento::"
    .replace(/[_-]+/g, " ")
    .trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const normalizeFieldKey = (label: string) => {
  return (label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

  const additionalContactInfo = useMemo(() => {
    const valueByKey = new Map<string, { label: string; value: string }>();

    const setValue = (rawLabel: string, rawValue: any) => {
      const label = humanizeLabel(rawLabel);
      const key = normalizeFieldKey(rawLabel);
      if (!key) return;
      const value = rawValue === null || rawValue === undefined ? "" : String(rawValue).trim();
      const existing = valueByKey.get(key);
      if (!existing) {
        valueByKey.set(key, { label, value });
        return;
      }
      // se já existe e estava vazio, deixa o valor "bom" ganhar
      if (!existing.value && value) {
        valueByKey.set(key, { label: existing.label || label, value });
      }
    };

    const pushFromObject = (obj?: Record<string, any>) => {
      if (obj && typeof obj === "object") {
        Object.entries(obj).forEach(([key, value]) => {
          setValue(key, value);
        });
      }
    };

    pushFromObject(contact?.extra_info as Record<string, any>);
    pushFromObject(contact?.additional_info as Record<string, any>);
    pushFromObject(contact?.custom_fields as Record<string, any>);

    contactExtraInfo.forEach((field) => {
      if (!field.field_name) return;
      setValue(field.field_name, field.field_value ?? "");
    });

    const requiredFields = (workspaceContactFields || [])
      .filter((f: any) => f?.is_required && f?.field_name)
      .sort((a: any, b: any) => (a.field_order ?? 0) - (b.field_order ?? 0));

    const out: { label: string; value: string }[] = [];
    const included = new Set<string>();

    // 1) Sempre mostrar campos obrigatórios (mesmo vazios)
    requiredFields.forEach((f: any) => {
      const raw = String(f.field_name || "");
      const key = normalizeFieldKey(raw);
      if (!key) return;
      const found = valueByKey.get(key);
      out.push({
        label: humanizeLabel(raw),
        value: found?.value || "",
      });
      included.add(key);
    });

    // 2) Depois, mostrar campos dinâmicos preenchidos (sem duplicar)
    for (const [key, item] of valueByKey.entries()) {
      if (included.has(key)) continue;
      if (!item.value) continue;
      out.push({ label: item.label, value: item.value });
    }

    return out;
  }, [contact, contactExtraInfo, workspaceContactFields]);

  const reloadContactExtraInfo = useCallback(async () => {
    const contactId = contact?.id;
    if (!contactId) return;
    try {
      const { data: extraInfoData, error: extraInfoError } = await supabase
        .from("contact_extra_info")
        .select("field_name, field_value")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true });

      if (!extraInfoError && extraInfoData) {
        setContactExtraInfo(extraInfoData.filter((f) => f.field_name));
      }
    } catch (e) {
      console.error("Erro ao recarregar campos extras do contato:", e);
    }
  }, [contact?.id]);

  const openDetailsEditor = useCallback(() => {
    if (!contact?.id) return;
    const requiredFields = (workspaceContactFields || [])
      .filter((f: any) => f?.is_required && f?.field_name)
      .sort((a: any, b: any) => (a.field_order ?? 0) - (b.field_order ?? 0));

    const existing = (contactExtraInfo || []).filter((f) => f?.field_name);
    const existingByNorm = new Map<string, { field_name: string; field_value: string }>();
    for (const row of existing) {
      const key = normalizeFieldKey(row.field_name);
      if (!key) continue;
      const value = String(row.field_value ?? "").trim();
      const prev = existingByNorm.get(key);
      if (!prev || (!prev.field_value && value)) {
        existingByNorm.set(key, { field_name: row.field_name, field_value: value });
      }
    }

    const requiredKeysNorm = new Set<string>();
    const nextDraft: Record<string, string> = {};

    for (const f of requiredFields) {
      const raw = String(f.field_name || "");
      const norm = normalizeFieldKey(raw);
      if (!norm) continue;
      requiredKeysNorm.add(norm);
      const found = existingByNorm.get(norm);
      nextDraft[raw] = found?.field_value || "0";
    }

    const optionalKeys: string[] = [];
    for (const row of existingByNorm.values()) {
      const norm = normalizeFieldKey(row.field_name);
      if (!norm || requiredKeysNorm.has(norm)) continue;
      optionalKeys.push(row.field_name);
      nextDraft[row.field_name] = row.field_value || "0";
    }
    optionalKeys.sort((a, b) => a.localeCompare(b, "pt-BR"));

    setDetailsDraft(nextDraft);
    setCustomDetailKeys(optionalKeys);
    setRemovedCustomDetailKeys([]);
    setNewDetailFieldName("");
    setNewDetailFieldValue("");
    setIsDetailsEditorOpen(true);
  }, [contact?.id, contactExtraInfo, workspaceContactFields]);

  const handleAddCustomDetailField = useCallback(() => {
    const name = (newDetailFieldName || "").trim();
    const value = (newDetailFieldValue || "").trim() || "0";
    if (!name) return;
    const norm = normalizeFieldKey(name);
    if (!norm) return;

    // evitar duplicar por normalização
    const existsInRequired = (workspaceContactFields || []).some(
      (f: any) => normalizeFieldKey(f?.field_name || "") === norm
    );
    const existsInCustom = customDetailKeys.some((k) => normalizeFieldKey(k) === norm);
    if (existsInRequired || existsInCustom) {
      toast({
        title: "Campo já existe",
        description: "Já existe um campo com esse nome.",
        variant: "destructive",
      });
      return;
    }

    setCustomDetailKeys((prev) => [...prev, name].sort((a, b) => a.localeCompare(b, "pt-BR")));
    setDetailsDraft((prev) => ({ ...prev, [name]: value }));
    setNewDetailFieldName("");
    setNewDetailFieldValue("");
  }, [customDetailKeys, newDetailFieldName, newDetailFieldValue, toast, workspaceContactFields]);

  const removeCustomDetailField = useCallback((fieldName: string) => {
    setCustomDetailKeys((prev) => prev.filter((k) => k !== fieldName));
    setRemovedCustomDetailKeys((prev) => [...prev, fieldName]);
    setDetailsDraft((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  const handleSaveDetailsEditor = useCallback(async () => {
    if (!contact?.id || !effectiveWorkspaceId) return;
    if (isSavingDetails) return;

    const existingRows = (contactExtraInfo || []).filter((f) => f?.field_name);
    const existingByNorm = new Map<string, string>();
    for (const row of existingRows) {
      const key = normalizeFieldKey(row.field_name);
      if (!key) continue;
      if (!existingByNorm.has(key)) existingByNorm.set(key, row.field_name);
    }

    const requiredFields = (workspaceContactFields || [])
      .filter((f: any) => f?.is_required && f?.field_name)
      .sort((a: any, b: any) => (a.field_order ?? 0) - (b.field_order ?? 0));

    setIsSavingDetails(true);
    try {
      // Remoções explícitas (somente customizáveis)
      for (const rawName of removedCustomDetailKeys) {
        const name = String(rawName || "").trim();
        if (!name) continue;
        const norm = normalizeFieldKey(name);
        if (!norm) continue;
        const existingName = existingByNorm.get(norm);
        if (existingName) {
          await supabase
            .from("contact_extra_info")
            .delete()
            .eq("contact_id", contact.id)
            .eq("workspace_id", effectiveWorkspaceId)
            .eq("field_name", existingName);
        }
      }

      // obrigatórios
      for (const f of requiredFields) {
        const rawName = String(f.field_name || "").trim();
        if (!rawName) continue;
        const norm = normalizeFieldKey(rawName);
        if (!norm) continue;

        const existingName = existingByNorm.get(norm);
        const nextValue = String(detailsDraft[rawName] ?? "").trim() || "0";

        if (existingName) {
          await supabase
            .from("contact_extra_info")
            .update({ field_value: nextValue })
            .eq("contact_id", contact.id)
            .eq("workspace_id", effectiveWorkspaceId)
            .eq("field_name", existingName);
        } else {
          await supabase
            .from("contact_extra_info")
            .insert({
              contact_id: contact.id,
              workspace_id: effectiveWorkspaceId,
              field_name: rawName,
              field_value: nextValue,
            });
        }
      }

      // customizáveis
      for (const rawName of customDetailKeys) {
        const name = String(rawName || "").trim();
        if (!name) continue;
        const norm = normalizeFieldKey(name);
        if (!norm) continue;

        const existingName = existingByNorm.get(norm);
        const nextValue = String(detailsDraft[name] ?? "").trim() || "0";

        if (existingName) {
          await supabase
            .from("contact_extra_info")
            .update({ field_value: nextValue })
            .eq("contact_id", contact.id)
            .eq("workspace_id", effectiveWorkspaceId)
            .eq("field_name", existingName);
        } else {
          await supabase
            .from("contact_extra_info")
            .insert({
              contact_id: contact.id,
              workspace_id: effectiveWorkspaceId,
              field_name: name,
              field_value: nextValue,
            });
        }
      }

      await reloadContactExtraInfo();
      setIsDetailsEditorOpen(false);
      toast({
        title: "Atualizado",
        description: "Detalhes do contato atualizados.",
      });
    } catch (e: any) {
      console.error("Erro ao salvar detalhes do contato:", e);
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível salvar os detalhes do contato.",
        variant: "destructive",
      });
    } finally {
      setIsSavingDetails(false);
    }
  }, [
    contact?.id,
    contactExtraInfo,
    customDetailKeys,
    removedCustomDetailKeys,
    detailsDraft,
    effectiveWorkspaceId,
    isSavingDetails,
    reloadContactExtraInfo,
    toast,
    workspaceContactFields,
  ]);

  // Buscar dados do card
  const fetchCardData = useCallback(async () => {
    if (!cardId || !effectiveWorkspaceId) return;

    setIsLoading(true);
    setConversationId(null);
    try {
      const headers = getHeaders();
      if (!headers) {
        throw new Error('Não foi possível obter headers do workspace');
      }
      
      // Buscar card completo
      const { data: card, error: cardError } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (cardError) throw cardError;
      if (!card) throw new Error('Card não encontrado');

      setCardData(card);
      setDealName(card.description || "Negócio");
      
      // Se o card já trouxer responsible_user, usar ele
      if (card.responsible_user) {
        setOwner(card.responsible_user);
      }
      
      // Buscar pipeline
      if (card.pipeline_id) {
        // ✅ Sempre tentar carregar ações do pipeline (Ganho/Perda/Reabrir),
        // mesmo que o select do pipeline falhe por RLS/estado.
        // Ações são fixas (Ganho/Perdido/Reabrir) - não dependem mais de configuração por pipeline.

        const { data: pipeline, error: pipelineError } = await supabase
          .from('pipelines')
          .select('*')
          .eq('id', card.pipeline_id)
          .eq('workspace_id', effectiveWorkspaceId)
          .maybeSingle();
        
        if (!pipelineError && pipeline) {
          setPipelineData(pipeline);
        }
      }

      // Buscar coluna atual
      if (card.column_id) {
        const { data: column, error: columnError } = await supabase
          .from('pipeline_columns')
          .select('*')
          .eq('id', card.column_id)
          .maybeSingle();
        
        if (!columnError && column) {
          setCurrentColumn(column);
        }
      }

      // Buscar contato
      setContactExtraInfo([]);

      if (card.contact_id) {
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', card.contact_id)
          .maybeSingle();
        
        if (!contactError && contactData) {
          setContact(contactData);

          // Buscar campos extras dinâmicos do contato
          try {
            const { data: extraInfoData, error: extraInfoError } = await supabase
              .from("contact_extra_info")
              .select("field_name, field_value")
              .eq("contact_id", card.contact_id)
              .order("created_at", { ascending: true });

            if (!extraInfoError && extraInfoData) {
              setContactExtraInfo(extraInfoData.filter((f) => f.field_name));
            }
          } catch (extraErr) {
            console.error("Erro ao buscar campos extras do contato:", extraErr);
          }
          
          // Buscar tags do contato
          const { data: tagsData } = await supabase
            .from('contact_tags')
            .select(`
              tag_id,
              tags!contact_tags_tag_id_fkey(id, name, color)
            `)
            .eq('contact_id', card.contact_id);
          
          if (tagsData) {
            const tags = tagsData
              .map((ct: any) => ct.tags)
              .filter(Boolean);
            setContactTags(tags);
          }

          // Buscar conversa mais recente do contato
          try {
            const { data: conversationData, error: conversationError } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', card.contact_id)
              .order('updated_at', { ascending: false })
              .limit(1);

            if (!conversationError && conversationData && conversationData.length > 0) {
              setConversationId(conversationData[0].id);
            }
          } catch (convErr) {
            console.error("Erro ao buscar conversa do contato:", convErr);
          }
        }
      }
      
      // Buscar produtos do card
      if (cardId) {
        const { data: productsData } = await supabase
          .from('pipeline_cards_products')
          .select(`
            *,
            product:products(id, name, value)
          `)
          .eq('pipeline_card_id', cardId);
        
        if (productsData) {
          setCardProducts(productsData);
        }
      }

      // Buscar proprietário (responsible_user_id) - usar system_users
      if (card.responsible_user_id) {
        const { data: userData, error: userError } = await supabase
          .from('system_users')
          .select('id, name, profile_image_url, profile')
          .eq('id', card.responsible_user_id)
          .maybeSingle();
        
        if (!userError && userData) {
          setOwner(userData);
        }
      }

    } catch (error) {
      console.error('Erro ao buscar card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados do negócio.",
        variant: "destructive",
      });
      // Redirecionar para o pipeline
      if (onClose) {
        onClose();
        return;
      }
      const pipelinePath = (userRole === 'master' && effectiveWorkspaceId) 
        ? `/workspace/${effectiveWorkspaceId}/pipeline` 
        : '/pipeline';
      navigate(pipelinePath);
    } finally {
      setIsLoading(false);
    }
  }, [cardId, effectiveWorkspaceId, getHeaders, navigate, toast]);

  // Função para excluir card
  const handleDeleteCard = useCallback(async () => {
    if (!cardId) return;
    
    try {
      const headers = getHeaders();
      if (!headers) {
        throw new Error('Não foi possível obter headers do workspace');
      }

      const { error } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Negócio excluído permanentemente.",
      });

      // Redirecionar para o pipeline
      if (onClose) {
        onClose();
        return;
      }
      const pipelinePath = (userRole === 'master' && effectiveWorkspaceId) 
        ? `/workspace/${effectiveWorkspaceId}/pipeline` 
        : '/pipeline';
      navigate(pipelinePath);
    } catch (error: any) {
      console.error('Erro ao excluir card:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir o negócio.",
        variant: "destructive",
      });
    }
  }, [cardId, getHeaders, effectiveWorkspaceId, navigate, toast]);

  // Função para mover card para outro pipeline/coluna
  const handleMoveCardToColumn = useCallback(async (newPipelineId: string, newColumnId: string) => {
    if (!cardId || !newPipelineId || !newColumnId) {
      return;
    }
    const isSamePipeline = newPipelineId === cardData?.pipeline_id;
    const isSameColumn = newColumnId === cardData?.column_id;
    if (isSamePipeline && isSameColumn) return;

    try {
      const headers = getHeaders();
      if (!headers) {
        throw new Error('Não foi possível obter headers do workspace');
      }

      const { error } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'PUT',
          headers,
          body: { pipeline_id: newPipelineId, column_id: newColumnId }
        }
      );

      if (error) {
        // Melhorar diagnóstico: tentar extrair o body real da response da Edge Function
        const ctx: any = (error as any)?.context;
        let detailedMessage: string | null = null;

        try {
          const res: Response | undefined = ctx?.response;
          if (res) {
            const text = await res.text();
            try {
              const json = JSON.parse(text);
              detailedMessage =
                json?.message ||
                json?.error ||
                json?.details ||
                (typeof json === 'string' ? json : null);
            } catch {
              detailedMessage = text || null;
            }
          }
        } catch (e) {
          console.warn('⚠️ Não foi possível ler body do erro da Edge Function:', e);
        }

        // fallback para context.body (quando existir) ou mensagem padrão do supabase-js
        const body = ctx?.body;
        if (!detailedMessage) {
          detailedMessage =
            body?.message ||
            body?.error ||
            body?.details ||
            (typeof body === 'string' ? body : null) ||
            (error as any)?.message ||
            'Erro ao mover card';
        }

        throw new Error(String(detailedMessage));
      }

      // Marcar oferta se a coluna de destino for etapa de oferta
      const resolveColumn = () => {
        if (newPipelineId === pipelineIdForColumns) {
          return columns?.find((c: any) => c.id === newColumnId);
        }
        return transferColumns?.find((c: any) => c.id === newColumnId);
      };
      const targetColumn = resolveColumn();
      if (targetColumn?.is_offer_stage) {
        await supabase
          .from('pipeline_cards')
          .update({ oferta: true })
          .eq('id', cardId);
      }

      toast({
        title: "Card movido",
        description: "O card foi movido com sucesso.",
      });

      // Recarregar dados do card
      await fetchCardData();
      setIsColumnSelectModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível mover o card.",
        variant: "destructive"
      });
    }
  }, [cardId, cardData?.pipeline_id, cardData?.column_id, getHeaders, fetchCardData, toast]);

  useEffect(() => {
    fetchCardData();
  }, [fetchCardData]);

  // ✅ Usuários do workspace para selects (usa Edge Function via hook, evitando RLS quebrar)
  useEffect(() => {
    if (!effectiveWorkspaceId) {
      setUsers([]);
      return;
    }

    // Importante: o "nível" que aparece no modal de usuários vem de `member.user.profile`.
    // Para manter consistência e não "sumir" usuário, filtramos por `user.profile` (fallback: member.role).
    const byId = new Map<string, any>();
    for (const m of workspaceMembers || []) {
      const id = m?.user?.id || m?.user_id;
      if (!id) continue;

      const profile = String(m?.user?.profile || m?.role || "").toLowerCase().trim();
      if (profile === "master" || profile === "support") continue;
      if (profile !== "admin" && profile !== "user") continue;

      const name =
        String(m?.user?.name || "").trim() ||
        String(m?.user?.email || "").trim() ||
        String(id || "").trim();

      // Preferir registro com nome preenchido
      const prev = byId.get(id);
      const next = {
        id,
        name,
        profile_image_url: m?.user?.avatar || m?.user?.profile_image_url || null,
        profile,
      };
      if (!prev || (!prev?.name && next.name)) {
        byId.set(id, next);
      }
    }

    const mapped = Array.from(byId.values()).filter((u: any) => u.id && u.name);

    mapped.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "pt-BR"));
    setUsers(mapped);
  }, [effectiveWorkspaceId, workspaceMembers]);

  // Preselecionar responsável para usuários não master
  useEffect(() => {
    if (authUser?.id && userRole !== 'master') {
      setActivityForm(prev => prev.responsibleId ? prev : { ...prev, responsibleId: authUser.id });
    }
  }, [authUser?.id, userRole]);

  // Buscar produtos disponíveis
  useEffect(() => {
    const fetchProducts = async () => {
      if (!effectiveWorkspaceId) return;
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, value')
          .eq('workspace_id', effectiveWorkspaceId)
          .order('name');

        if (error) throw error;
        setAvailableProducts(data || []);
      } catch (error) {
        console.error('Erro ao buscar produtos:', error);
      }
    };

    fetchProducts();
  }, [effectiveWorkspaceId]);

  // Buscar atividades do card
  const fetchActivities = useCallback(async () => {
    if (!cardId || !contact?.id) return;

    setIsLoadingActivities(true);
    try {
      const { data: allActivities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('contact_id', contact.id)
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      // Filtrar atividades do card ou globais
      const filteredActivities = allActivities?.filter(activity => 
        activity.pipeline_card_id === cardId || activity.pipeline_card_id === null
      ) || [];

      setActivities(filteredActivities);
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [cardId, contact?.id]);

  useEffect(() => {
    if (contact?.id && cardId) {
      fetchActivities();
    }
  }, [contact?.id, cardId, fetchActivities]);

  // Calcular dados da visão geral (useMemo evita re-render extra vs useEffect+setState)
  const overviewData = useMemo(() => {
    if (!cardData || !cardData.created_at) return null;

    try {
      const createdAt = new Date(cardData.created_at);
      if (isNaN(createdAt.getTime())) return null;

      const now = new Date();
      const businessAge = Math.max(0, differenceInDays(now, createdAt));

      let inactiveDays = 0;
      if (activities.length > 0) {
        const lastActivity = activities
          .map(a => new Date(a.scheduled_for || a.created_at))
          .sort((a, b) => b.getTime() - a.getTime())[0];
        inactiveDays = differenceInDays(now, lastActivity);
      } else {
        inactiveDays = businessAge;
      }

      const activityCounts: Record<string, number> = {};
      activities.forEach(activity => {
        const type = activity.type || 'Outras';
        activityCounts[type] = (activityCounts[type] || 0) + 1;
      });

      const totalActivities = activities.length;
      const activityStats = Object.entries(activityCounts)
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      const userCounts: Record<string, { name: string; count: number }> = {};
      activities.forEach(activity => {
        if (activity.responsible_id) {
          const user = users.find(u => u.id === activity.responsible_id);
          if (user) {
            if (!userCounts[activity.responsible_id]) {
              userCounts[activity.responsible_id] = { name: user.name, count: 0 };
            }
            userCounts[activity.responsible_id].count++;
          }
        }
      });

      const userStats = Object.values(userCounts)
        .map(({ name, count }) => ({
          name,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        businessAge,
        inactiveDays,
        createdAt: format(createdAt, "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
        activityStats,
        userStats
      };
    } catch (error) {
      console.error('Erro ao calcular visão geral:', error);
      return null;
    }
  }, [cardData, activities, users]);

  const pipelineIdForColumns =
    selectedPipelineId || cardData?.pipeline_id || pipelineData?.id || null;
  const { columns } = usePipelineColumns(pipelineIdForColumns, effectiveWorkspaceId);
  const { columns: transferColumns, isLoading: isLoadingTransferColumns } = usePipelineColumns(
    transferPipelineId || cardData?.pipeline_id || pipelineData?.id || null,
    effectiveWorkspaceId
  );
  const [timeInColumns, setTimeInColumns] = useState<Record<string, number>>({});

  // Carregar pipelines do workspace (para permitir mover o card entre pipelines)
  useEffect(() => {
    const fetchPipelines = async () => {
      if (!effectiveWorkspaceId) return;
      try {
        setIsLoadingPipelines(true);
        const { data, error } = await supabase
          .from('pipelines')
          .select('id, name, is_active')
          .eq('workspace_id', effectiveWorkspaceId)
          .order('name', { ascending: true });
        if (error) throw error;
        setAvailablePipelines((data || []).filter((p: any) => p.is_active));
      } catch (e) {
        console.error('Erro ao buscar pipelines:', e);
      } finally {
        setIsLoadingPipelines(false);
      }
    };
    fetchPipelines();
  }, [effectiveWorkspaceId]);

  // Preselecionar pipeline/coluna para transferência rápida quando o card carregar/mudar
  useEffect(() => {
    if (!cardData?.pipeline_id || !cardData?.column_id) return;
    // Resetar flag de interação do usuário (evita disparos automáticos)
    transferTouchedRef.current = false;
    setTransferPipelineId(cardData.pipeline_id);
    setTransferColumnId(cardData.column_id);
  }, [cardData?.pipeline_id, cardData?.column_id]);

  // ✅ Transferência rápida: ao selecionar Pipeline + Coluna, transferir imediatamente o card
  useEffect(() => {
    // IMPORTANT: esse efeito só deve disparar quando o usuário realmente interagir
    // com os selects de "Transferir Oportunidade" na aba Visão Geral.
    // Sem esse guard, updates/realtime/refetch podem alterar estados e causar loop de salvamento/toasts.
    if (!transferTouchedRef.current) return;
    if (!transferPipelineId || !transferColumnId) return;
    if (!cardId) return;

    const key = `${cardId}:${transferPipelineId}:${transferColumnId}`;
    if (lastTransferKeyRef.current === key) return;
    if (transferInFlightRef.current) return;

    // Se já está na mesma etapa/pipeline, não transferir (e limpa o "touched")
    if (transferPipelineId === cardData?.pipeline_id && transferColumnId === cardData?.column_id) {
      transferTouchedRef.current = false;
      lastTransferKeyRef.current = key;
      return;
    }

    transferInFlightRef.current = true;
    transferTouchedRef.current = false;
    lastTransferKeyRef.current = key;

    void handleMoveCardToColumn(transferPipelineId, transferColumnId).finally(() => {
      transferInFlightRef.current = false;
    });
  }, [
    transferPipelineId,
    transferColumnId,
    handleMoveCardToColumn,
    cardId,
    cardData?.pipeline_id,
    cardData?.column_id,
  ]);

  // Preselecionar pipeline/coluna quando abrir o popover
  useEffect(() => {
    if (!isColumnSelectModalOpen) return;
    setSelectedPipelineId(cardData?.pipeline_id || pipelineData?.id || "");
    setSelectedColumnId(cardData?.column_id || "");
  }, [isColumnSelectModalOpen, cardData?.pipeline_id, cardData?.column_id, pipelineData?.id]);

  // Verificar se cardId existe antes de renderizar
  if (!cardId) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-[#0f0f0f]">
        <div className={cn("px-6 py-4 border-b shrink-0 bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-gray-700")}>
          <div className="flex items-center gap-4">
            {!onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const pipelinePath = (userRole === 'master' && effectiveWorkspaceId) 
                    ? `/workspace/${effectiveWorkspaceId}/pipeline` 
                    : '/pipeline';
                  navigate(pipelinePath);
                }}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-sm font-medium">Voltar ao Pipeline</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Card ID não encontrado.</p>
          </div>
        </div>
      </div>
    );
  }

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        const h = hour.toString().padStart(2, '0');
        const m = minute.toString().padStart(2, '0');
        times.push(`${h}:${m}`);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  // Calcular tempo em cada coluna
  useEffect(() => {
    if (!cardId || !cardData) {
      setTimeInColumns({});
      return;
    }

    const fetchColumnHistory = async () => {
      try {
        const { data: history } = await supabase
          .from('pipeline_card_history')
          .select('*')
          .eq('card_id', cardId)
          .eq('action', 'column_changed')
          .order('changed_at', { ascending: true });

        const timeInColumns: Record<string, number> = {};

        if (!history || history.length === 0) {
          // Se não há histórico, o card está na coluna atual desde a criação
          const cardCreatedAt = new Date(cardData.created_at || Date.now());
          const now = new Date();
          const days = differenceInDays(now, cardCreatedAt);
          if (days >= 1) {
            timeInColumns[cardData.column_id] = days;
          } else {
            const hours = differenceInHours(now, cardCreatedAt);
            if (hours >= 24) {
              timeInColumns[cardData.column_id] = 1;
            }
          }
          setTimeInColumns(timeInColumns);
          return;
        }

        // Encontrar quando o card foi criado
        const cardCreatedAt = new Date(cardData.created_at || Date.now());
        
        // Processar cada mudança de coluna
        let lastColumnId = (history[0]?.metadata as any)?.old_column_id || cardData.column_id;
        let lastChangeTime = cardCreatedAt;

        for (const event of history) {
          const changeTime = new Date(event.changed_at);
          const fromColumn = (event.metadata as any)?.old_column_id;
          const toColumn = (event.metadata as any)?.new_column_id;

          if (fromColumn && lastColumnId === fromColumn) {
            // Calcular dias na coluna anterior
            const days = differenceInDays(changeTime, lastChangeTime);
            if (days >= 1) {
              timeInColumns[fromColumn] = (timeInColumns[fromColumn] || 0) + days;
            } else {
              // Se menos de 1 dia, verificar horas
              const hours = differenceInHours(changeTime, lastChangeTime);
              if (hours >= 24) {
                timeInColumns[fromColumn] = (timeInColumns[fromColumn] || 0) + 1;
              }
            }
          }

          lastColumnId = toColumn || lastColumnId;
          lastChangeTime = changeTime;
        }

        // Calcular tempo na coluna atual (desde a última mudança até agora)
        if (lastColumnId === cardData.column_id) {
          const now = new Date();
          const days = differenceInDays(now, lastChangeTime);
          if (days >= 1) {
            timeInColumns[cardData.column_id] = (timeInColumns[cardData.column_id] || 0) + days;
          } else {
            const hours = differenceInHours(now, lastChangeTime);
            if (hours >= 24) {
              timeInColumns[cardData.column_id] = (timeInColumns[cardData.column_id] || 0) + 1;
            }
          }
        }

        setTimeInColumns(timeInColumns);
      } catch (error) {
        console.error('Erro ao calcular tempo nas colunas:', error);
        setTimeInColumns({});
      }
    };

    fetchColumnHistory();
  }, [cardId, cardData?.column_id, cardData?.created_at]);

  const handleSaveName = async () => {
    if (!cardId) return;
    
    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(
        'pipeline-management/cards',
        {
          method: 'PUT',
          headers,
          body: {
            id: cardId,
            description: dealName
          }
        }
      );

      if (error) throw error;

      setIsEditingName(false);
      toast({
        title: "Sucesso",
        description: "Nome do negócio atualizado.",
      });
    } catch (error) {
      console.error('Erro ao salvar nome:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o nome do negócio.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsWon = async () => {
    // Manter por compatibilidade se necessário, mas vamos preferir executeAction
    if (!cardId) return;

    // Regra: não pode marcar como ganho se existir atividade em aberto
    try {
      const { data: openActs, error: openActsError } = await supabase
        .from("activities")
        .select("id, type, is_completed")
        .eq("pipeline_card_id", cardId)
        .eq("is_completed", false);

      if (openActsError) throw openActsError;

      const hasOpenNonFile = (openActs || []).some(
        (a: any) => String(a?.type || "").toLowerCase().trim() !== "arquivo"
      );

      if (hasOpenNonFile) {
        toast({
          title: "Finalize a atividade",
          description: "Para marcar como ganho, finalize a atividade em aberto primeiro.",
          variant: "destructive",
        });
        return;
      }
    } catch (e) {
      console.warn("Falha ao validar atividades em aberto (ganho):", e);
      // se não conseguir validar, não bloqueia (evita travar fluxo por erro momentâneo)
    }

    // Regra: só pode marcar como ganho se estiver qualificado
    const q = normalizeDealQualification(cardData?.qualification);
    if (q !== 'qualified') {
      toast({
        title: "Não foi possível marcar como ganho",
        description: "Você precisa qualificar o negócio antes de marcar como ganho.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsExecutingAction(true);
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'PUT',
          headers,
          body: {
            status: 'ganho'
          }
        }
      );

      if (error) {
        // Melhorar diagnóstico: tentar extrair o body real da response da Edge Function
        const ctx: any = (error as any)?.context;
        let detailedMessage: string | null = null;

        try {
          const res: Response | undefined = ctx?.response;
          if (res) {
            const text = await res.text();
            try {
              const json = JSON.parse(text);
              detailedMessage =
                json?.message ||
                json?.error ||
                json?.details ||
                (typeof json === 'string' ? json : null);
            } catch {
              detailedMessage = text || null;
            }
          }
        } catch (e) {
          console.warn('⚠️ Não foi possível ler body do erro da Edge Function:', e);
        }

        // fallback para context.body (quando existir) ou mensagem padrão do supabase-js
        const body = ctx?.body;
        if (!detailedMessage) {
          detailedMessage =
            body?.message ||
            body?.error ||
            body?.details ||
            (typeof body === 'string' ? body : null) ||
            (error as any)?.message ||
            'Erro ao marcar como ganho';
        }

        throw new Error(String(detailedMessage));
      }

      // Registrar histórico de ganho (status + valor)
      await logStatusHistory('ganho', cardData?.value ?? null, {
        oldStatus: (cardData as any)?.status ?? null,
        actionName: 'Ganho',
      });

      toast({
        title: "Sucesso",
        description: "Negócio marcado como ganho.",
      });

      // Fechar modal/sheet (quando aplicável)
      if (onClose) {
        onClose();
        return;
      }

      fetchCardData();
    } catch (error: any) {
      console.error('Erro ao marcar como ganho:', error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível marcar o negócio como ganho.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const fetchPipelineActions = useCallback(async (pipelineId: string) => {
    // Sempre garantir ações padrão, mesmo se a chamada falhar
    const standardStates = [
      { state: 'Ganho', defaultName: 'Ganho', id: 'std-ganho' },
      { state: 'Perda', defaultName: 'Perdido', id: 'std-perdido' },
      { state: 'Aberto', defaultName: 'Reabrir', id: 'std-reabrir' }
    ];

    const normalizeState = (value: string | null | undefined) => {
      const lower = (value || '').toLowerCase();
      if (lower.includes('ganh')) return 'Ganho';
      if (lower.includes('perd')) return 'Perda';
      if (lower.includes('aberto') || lower.includes('reabr')) return 'Aberto';
      return value || '';
    };

    setIsLoadingActions(true);
    try {
      const headers = getHeaders();
      if (!headers) {
        console.warn('fetchPipelineActions: headers ausentes, usando apenas ações padrão.');
        setPipelineActions(standardStates.map(std => ({
          id: std.id,
          action_name: std.defaultName,
          deal_state: std.state,
          target_pipeline_id: null,
          target_column_id: null
        })));
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/actions?pipeline_id=${pipelineId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (error) {
        console.error('Erro ao buscar ações do pipeline:', error);
        setPipelineActions(standardStates.map(std => ({
          id: std.id,
          action_name: std.defaultName,
          deal_state: std.state,
          target_pipeline_id: null,
          target_column_id: null
        })));
        return;
      }

      const dbActions = (data || []).map((a: any) => ({
        ...a,
        deal_state: normalizeState(a.deal_state)
      }));
      const finalActions = [...dbActions];

      // Verificar quais estados padrão estão faltando e adicionar
      standardStates.forEach(std => {
        const exists = dbActions.some((a: any) => a.deal_state === std.state);
        if (!exists) {
          finalActions.push({
            id: std.id,
            action_name: std.defaultName,
            deal_state: std.state,
            target_pipeline_id: null,
            target_column_id: null
          });
        }
      });

      setPipelineActions(finalActions);
    } catch (error) {
      console.error('Erro ao buscar ações do pipeline:', error);
      setPipelineActions(standardStates.map(std => ({
        id: std.id,
        action_name: std.defaultName,
        deal_state: std.state,
        target_pipeline_id: null,
        target_column_id: null
      })));
    } finally {
      setIsLoadingActions(false);
    }
  }, [getHeaders]);

  const executeAction = async (action: any) => {
    if (!cardId || isExecutingAction) return;

    const actionState = (action?.deal_state || '').toString().toLowerCase();
    const actionName = (action?.action_name || '').toString().toLowerCase();
    const isLossAction =
      actionState === 'perda' ||
      actionState === 'perdido' ||
      actionState.includes('perda') ||
      actionName.includes('perda') ||
      actionName.includes('perdido');

    // Abrir modal para ações de perda
    if (isLossAction) {
      setConfirmLossAction(action);
      setIsMarkAsLostModalOpen(true);
      return;
    }

    // Regra: só pode marcar como ganho se estiver qualificado
    const statusMap: Record<string, string> = {
      'Ganho': 'ganho',
      'Perda': 'perda',
      'Aberto': 'aberto'
    };
    const newStatusPreview = statusMap[action.deal_state] || 'aberto';
    const isWinAction = String(newStatusPreview).toLowerCase() === 'ganho';
    if (isWinAction) {
      const q = normalizeDealQualification(cardData?.qualification);
      if (q !== 'qualified') {
        toast({
          title: "Não foi possível marcar como ganho",
          description: "Você precisa qualificar o negócio antes de marcar como ganho.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsExecutingAction(true);

    try {
      const headers = getHeaders();
      if (!headers) throw new Error('Não foi possível obter headers do workspace');

      const body: any = {
        id: cardId,
        executed_by: authUser?.id || null,
        executed_by_name: authUser?.user_metadata?.full_name || authUser?.email || authUser?.id || 'Sistema'
      };

      // Determinar o novo status baseado na regra da ação
      const newStatus = statusMap[action.deal_state] || 'aberto';
      body.status = newStatus;

      // Verificar se há transferência configurada - garantir que não enviamos strings vazias
      if (action.target_pipeline_id && action.target_pipeline_id.trim() !== "") {
        body.pipeline_id = action.target_pipeline_id;
      }
      
      if (action.target_column_id && action.target_column_id.trim() !== "") {
        body.column_id = action.target_column_id;
      }

      console.log('🚀 Executando ação de pipeline:', {
        action: action.action_name,
        body
      });

      // ✅ CORREÇÃO: Passar o ID na URL para a Edge Function
      const { error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers,
        body
      });

      if (error) throw error;

      await logStatusHistory(newStatus, cardData?.value ?? null, {
        oldStatus: (cardData as any)?.status ?? null,
        actionName: action?.action_name || action?.deal_state || null,
      });

      toast({
        title: "Sucesso",
        description: `Negócio marcado como ${action.action_name.toLowerCase()}.`,
      });

      // Recarregar dados do card
      await fetchCardData();
      
      // Se houve transferência de pipeline, carregar as ações do novo pipeline
      if (body.pipeline_id && body.pipeline_id !== cardData?.pipeline_id) {
        await fetchPipelineActions(body.pipeline_id);
      }

    } catch (error: any) {
      console.error('Erro ao executar ação:', error);
      toast({
        title: "Erro ao executar ação",
        description: error.message || "Não foi possível realizar a ação.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleMarkAsLost = async (lossReasonId: string | null, comments: string) => {
    if (!cardId || !confirmLossAction) return;

    setIsMarkingAsLost(true);
    try {
      const headers = getHeaders();
      if (!headers) throw new Error('Não foi possível obter headers do workspace');

      const body: any = {
        id: cardId,
        status: 'perda',
        executed_by: authUser?.id || null,
        executed_by_name: authUser?.user_metadata?.full_name || authUser?.email || authUser?.id || 'Sistema'
      };

      if (confirmLossAction.target_pipeline_id && confirmLossAction.target_pipeline_id.trim() !== "") {
        body.pipeline_id = confirmLossAction.target_pipeline_id;
      }

      if (confirmLossAction.target_column_id && confirmLossAction.target_column_id.trim() !== "") {
        body.column_id = confirmLossAction.target_column_id;
      }

      // Primeiro executar a ação de perda (status/transferência)
      const { error: actionError } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers,
        body
      });

      if (actionError) throw actionError;

      // Depois salvar motivo e observação
      const { error: updateError } = await supabase
        .from('pipeline_cards')
        .update({
          loss_reason_id: lossReasonId,
          loss_comments: comments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cardId);

      if (updateError) throw updateError;

      // Buscar nome do motivo (para histórico)
      let lossReasonName: string | null = null;
      if (lossReasonId) {
        const { data: reasonRow } = await supabase
          .from('loss_reasons')
          .select('name')
          .eq('id', lossReasonId)
          .maybeSingle();
        lossReasonName = (reasonRow as any)?.name ?? null;
      }

      // Registrar histórico completo da perda (status + motivo + observações)
      await logStatusHistory('perda', cardData?.value ?? null, {
        oldStatus: (cardData as any)?.status ?? null,
        actionName: confirmLossAction?.action_name || 'Perdido',
        lossReasonId,
        lossReasonName,
        lossComments: comments || null,
      });

      toast({
        title: "Sucesso",
        description: "Negócio marcado como perdido.",
      });

      await fetchCardData();

      if (body.pipeline_id && body.pipeline_id !== cardData?.pipeline_id) {
        await fetchPipelineActions(body.pipeline_id);
      }
    } catch (error: any) {
      console.error('Erro ao marcar como perdido:', error);
      toast({
        title: "Erro ao executar ação",
        description: error.message || "Não foi possível realizar a ação.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsLost(false);
      setConfirmLossAction(null);
      setIsMarkAsLostModalOpen(false);
    }
  };

  const handleDealStatusMoveConfirm = useCallback(
    async (payload: { pipelineId: string; columnId: string; lossReasonId: string | null; lossComments: string }) => {
      if (!cardId) return;
      if (!effectiveWorkspaceId) return;

      setIsDealStatusMoveLoading(true);
      try {
        const headers = getHeaders();
        if (!headers) throw new Error("Não foi possível obter headers do workspace");

        const executedBy = authUser?.id || null;
        const executedByName =
          authUser?.user_metadata?.full_name || authUser?.email || authUser?.id || "Sistema";

        if (dealStatusMoveMode === "reopen") {
          const body: any = {
            id: cardId,
            status: "aberto",
            pipeline_id: payload.pipelineId,
            column_id: payload.columnId,
            executed_by: executedBy,
            executed_by_name: executedByName,
          };

          const { error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
            method: "PUT",
            headers,
            body,
          });
          if (error) throw error;

          await logStatusHistory("aberto", cardData?.value ?? null, {
            oldStatus: (cardData as any)?.status ?? null,
            actionName: "Reabrir",
          });

          toast({
            title: "Sucesso",
            description: "Oportunidade reaberta.",
          });

          setDealStatusMoveOpen(false);
          await fetchCardData();
          return;
        }

        // lost
        const body: any = {
          id: cardId,
          status: "perda",
          pipeline_id: payload.pipelineId,
          column_id: payload.columnId,
          executed_by: executedBy,
          executed_by_name: executedByName,
        };

        const { error: actionError } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
          method: "PUT",
          headers,
          body,
        });
        if (actionError) throw actionError;

        const { error: updateError } = await supabase
          .from("pipeline_cards")
          .update({
            loss_reason_id: payload.lossReasonId,
            loss_comments: payload.lossComments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cardId);

        if (updateError) throw updateError;

        let lossReasonName: string | null = null;
        if (payload.lossReasonId) {
          const { data: reasonRow } = await supabase
            .from("loss_reasons")
            .select("name")
            .eq("id", payload.lossReasonId)
            .maybeSingle();
          lossReasonName = (reasonRow as any)?.name ?? null;
        }

        await logStatusHistory("perda", cardData?.value ?? null, {
          oldStatus: (cardData as any)?.status ?? null,
          actionName: "Perdido",
          lossReasonId: payload.lossReasonId,
          lossReasonName,
          lossComments: payload.lossComments || null,
        });

        toast({
          title: "Sucesso",
          description: "Negócio marcado como perdido.",
        });

        setDealStatusMoveOpen(false);
        await fetchCardData();
      } catch (e: any) {
        console.error("Erro ao alterar status/mover oportunidade:", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível realizar a ação.",
          variant: "destructive",
        });
      } finally {
        setIsDealStatusMoveLoading(false);
      }
    },
    [authUser?.email, authUser?.id, authUser?.user_metadata?.full_name, cardData, cardId, dealStatusMoveMode, effectiveWorkspaceId, fetchCardData, getHeaders, logStatusHistory, toast]
  );

  // Salvar atividade
  const handleSaveActivity = async () => {
    if (!cardId || !contact?.id || !activityForm.responsibleId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o responsável.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingFile(!!activityAttachmentFile);
      // Combinar data e hora de início
      const [startHour, startMinute] = activityForm.startTime.split(':').map(Number);
      const startDateTime = new Date(activityForm.startDate);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      // Combinar data e hora de fim
      const [endHour, endMinute] = activityForm.endTime.split(':').map(Number);
      const endDateTime = new Date(activityForm.endDate);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      // Calcular duração em minutos
      const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

      // Upload do anexo (opcional)
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (activityAttachmentFile && effectiveWorkspaceId) {
        const fileExt = activityAttachmentFile.name.split('.').pop();
        const safeName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${effectiveWorkspaceId}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('activity-attachments')
          .upload(filePath, activityAttachmentFile, {
            contentType: activityAttachmentFile.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('activity-attachments')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
        attachmentName = activityAttachmentFile.name;
      }

      const activityData = {
        contact_id: contact.id,
        workspace_id: effectiveWorkspaceId,
        pipeline_card_id: cardId,
        type: activityForm.type,
        responsible_id: activityForm.responsibleId,
        subject: activityForm.subject.trim() || activityForm.type,
        description: activityForm.description || null,
        availability: activityForm.availability,
        scheduled_for: startDateTime.toISOString(),
        duration_minutes: durationMinutes > 0 ? durationMinutes : 30,
        is_completed: activityForm.markAsDone,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName
      };

      const { data: insertedActivity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select('id')
        .single();

      if (error) throw error;

      // Registrar auditoria da criação
      if (insertedActivity?.id) {
        await logCreate(
          'activity',
          insertedActivity.id,
          activityForm.subject.trim() || activityForm.type,
          {
            type: activityForm.type,
            subject: activityForm.subject.trim() || activityForm.type,
            description: activityForm.description,
            scheduled_for: startDateTime.toISOString(),
            responsible_id: activityForm.responsibleId,
          },
          effectiveWorkspaceId
        );
      }

      // Registrar no histórico quando houver anexo (persistente)
      if (attachmentUrl && attachmentName) {
        try {
          await supabase.from('pipeline_card_history').insert({
            card_id: cardId,
            action: 'file_attached',
            changed_at: new Date().toISOString(),
            metadata: {
              activity_id: insertedActivity?.id || null,
              activity_type: activityForm.type,
              activity_subject: activityForm.subject.trim() || activityForm.type,
              attachment_name: attachmentName,
              attachment_url: attachmentUrl,
              changed_by_id: authUser?.id || null,
              changed_by_name: getUserDisplayName(),
            },
          });
        } catch (historyErr) {
          console.warn('⚠️ Não foi possível registrar histórico de arquivo anexado:', historyErr);
        }
      }

      toast({
        title: "Sucesso",
        description: "Atividade criada com sucesso.",
      });

      // Recarregar atividades
      await fetchActivities();

      // Invalidar histórico para que a nova atividade apareça
      // Usamos apenas o prefixo da chave para invalidar todas as variações (com ou sem contactId)
      queryClient.invalidateQueries({ queryKey: ['card-history', cardId] });

      // Resetar formulário
      {
        const range = getBrasiliaRoundedTimeRange();
        const keepResponsibleId = activityForm.responsibleId;
        setActivityForm({
          type: "Ligação abordada",
          subject: "",
          description: "",
          availability: "livre",
          startDate: range.startDate,
          startTime: range.startTime,
          endDate: range.endDate,
          endTime: range.endTime,
          // ✅ Não resetar responsável ao salvar
          responsibleId: keepResponsibleId,
          location: "",
          videoCall: false,
          markAsDone: false
        });
        setSelectedStartHour(range.startHour);
        setSelectedStartMinute(range.startMinute);
        setSelectedEndHour(range.endHour);
        setSelectedEndMinute(range.endMinute);
      }
      setActivityAttachmentFile(null);
    } catch (error: any) {
      console.error('Erro ao salvar atividade:', error);

      const code = error?.code || error?.cause?.code;
      const isOverlap =
        code === "23P01" ||
        String(error?.message || "").toLowerCase().includes("conflito de agenda");

      toast({
        title: "Erro",
        description: isOverlap
          ? "Conflito de agenda: já existe uma atividade para este responsável nesse período."
          : "Não foi possível criar a atividade.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFile(false);
    }
  };

  const getActivityById = (id: string) => activities.find((a) => a.id === id);

  // ✅ Ao abrir via Kanban de Atividades, já abrir o modal de edição da atividade específica.
  // Faz isso depois que o detalhe do negócio montou e as atividades estão disponíveis (ou buscando no banco se necessário).
  useEffect(() => {
    if (!openActivityEditId) return;
    if (!cardId) return;
    if (lastAutoOpenedActivityEditIdRef.current === openActivityEditId) return;

    const run = async () => {
      try {
        let activity: any | null = getActivityById(openActivityEditId) || null;

        if (!activity) {
          const { data, error } = await supabase
            .from("activities")
            .select("*")
            .eq("id", openActivityEditId)
            .maybeSingle();
          if (error) throw error;
          activity = data || null;
        }

        if (!activity) {
          toast({
            title: "Atividade não encontrada",
            description: "Não foi possível localizar a atividade para edição.",
            variant: "destructive",
          });
          lastAutoOpenedActivityEditIdRef.current = openActivityEditId;
          return;
        }

        const scheduled = activity.scheduled_for ? new Date(activity.scheduled_for) : new Date();
        const endFromDuration = new Date(scheduled);
        const durationMinutes = activity.duration_minutes || 30;
        endFromDuration.setMinutes(endFromDuration.getMinutes() + durationMinutes);

        setActivityEditForm({
          type: activity.type || "Ligação abordada",
          subject: activity.subject || "",
          description: activity.description || "",
          availability: activity.availability || "livre",
          startDate: scheduled,
          startTime: formatTime(scheduled),
          endDate: endFromDuration,
          endTime: formatTime(endFromDuration),
          responsibleId: activity.responsible_id || "",
          markAsDone: !!activity.is_completed,
        });
        setSelectedActivityForEdit(activity);
        setMainTab("atividade");

        lastAutoOpenedActivityEditIdRef.current = openActivityEditId;
      } catch (e: any) {
        console.error("Erro ao auto-abrir edição da atividade:", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível abrir a edição da atividade.",
          variant: "destructive",
        });
        lastAutoOpenedActivityEditIdRef.current = openActivityEditId;
      }
    };

    // Garantir que o Sheet já abriu antes do modal de edição (evita flicker/stack estranho)
    setTimeout(() => void run(), 0);
  }, [activities, cardId, openActivityEditId, toast]);

  const openActivityEditFromHistory = useCallback(
    (event: any) => {
      try {
        const baseId = (event.id || "").split("_")[0];
        const activity = getActivityById(baseId);
        if (!activity) {
          toast({
            title: "Atividade não encontrada",
            description: "Não foi possível localizar a atividade para edição.",
            variant: "destructive",
          });
          return;
        }

        const scheduled = activity.scheduled_for ? new Date(activity.scheduled_for) : new Date();
        const endFromDuration = new Date(scheduled);
        const durationMinutes = activity.duration_minutes || 30;
        endFromDuration.setMinutes(endFromDuration.getMinutes() + durationMinutes);

        setActivityEditForm({
          type: activity.type || "Ligação abordada",
          subject: activity.subject || "",
          description: activity.description || "",
          availability: activity.availability || "livre",
          startDate: scheduled,
          startTime: formatTime(scheduled),
          endDate: endFromDuration,
          endTime: formatTime(endFromDuration),
          responsibleId: activity.responsible_id || "",
          markAsDone: !!activity.is_completed,
        });
        setSelectedActivityForEdit(activity);
        setMainTab("atividade");
      } catch (error) {
        console.error("Erro ao preparar edição da atividade:", error);
        toast({
          title: "Erro",
          description: "Não foi possível abrir a edição da atividade.",
          variant: "destructive",
        });
      }
    },
    [activities, toast]
  );

  const handleUpdateActivity = useCallback(async () => {
    if (!selectedActivityForEdit || !contact?.id || !cardId || !activityEditForm.responsibleId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o responsável.",
        variant: "destructive",
      });
      return;
    }

    try {
      const [startHour, startMinute] = activityEditForm.startTime.split(":").map(Number);
      const startDateTime = new Date(activityEditForm.startDate);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      const [endHour, endMinute] = activityEditForm.endTime.split(":").map(Number);
      const endDateTime = new Date(activityEditForm.endDate);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60));

      // Preparar dados de atualização
      const updateData: any = {
        type: activityEditForm.type,
        responsible_id: activityEditForm.responsibleId,
        subject: activityEditForm.subject.trim() || activityEditForm.type,
        description: activityEditForm.description || null,
        availability: activityEditForm.availability,
        scheduled_for: startDateTime.toISOString(),
        duration_minutes: durationMinutes > 0 ? durationMinutes : 30,
        is_completed: activityEditForm.markAsDone,
      };

      // Se está marcando como realizada, preencher completed_at (preservando valor existente se já tiver)
      if (activityEditForm.markAsDone) {
        updateData.completed_at =
          (selectedActivityForEdit as any)?.completed_at || new Date().toISOString();
      } else {
        // Se está desmarcando como realizada, limpar completed_at
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from("activities")
        .update(updateData)
        .eq("id", selectedActivityForEdit.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atividade atualizada.",
      });

      setIsActivityEditModalOpen(false);
      setSelectedActivityForEdit(null);
      await fetchActivities();
      // Invalidar e refetch histórico para que a atividade atualizada apareça corretamente
      const historyKey = ['card-history', cardId, contact?.id || 'no-contact'];
      await queryClient.invalidateQueries({ queryKey: historyKey });
      await queryClient.refetchQueries({ queryKey: historyKey });
    } catch (error: any) {
      console.error("Erro ao atualizar atividade:", error);

      const code = error?.code || error?.cause?.code;
      const isOverlap =
        code === "23P01" ||
        String(error?.message || "").toLowerCase().includes("conflito de agenda");

      toast({
        title: "Erro",
        description: isOverlap
          ? "Conflito de agenda: já existe uma atividade para este responsável nesse período."
          : error.message || "Não foi possível atualizar a atividade.",
        variant: "destructive",
      });
    }
  }, [activityEditForm, cardId, contact?.id, fetchActivities, queryClient, selectedActivityForEdit, toast]);

  const deleteActivityById = useCallback(
    async (activityId: string) => {
      // Buscar dados completos da atividade para auditoria e histórico
      let activityRow: any = null;
      try {
        const { data } = await supabase
          .from('activities')
          .select('id, type, subject, description, scheduled_for, responsible_id, workspace_id, attachment_url, attachment_name')
          .eq('id', activityId)
          .maybeSingle();
        activityRow = data;

        if (activityRow?.attachment_url) {
          await supabase.from('pipeline_card_history').insert({
            card_id: cardId,
            action: 'file_deleted',
            changed_at: new Date().toISOString(),
            metadata: {
              activity_id: activityRow.id,
              attachment_name: activityRow.attachment_name || null,
              attachment_url: activityRow.attachment_url || null,
              changed_by_id: authUser?.id || null,
              changed_by_name: getUserDisplayName(),
            },
          });
        }
      } catch (historyErr) {
        console.warn('⚠️ Não foi possível registrar histórico de arquivo removido ao excluir atividade:', historyErr);
      }

      // Registrar auditoria ANTES de excluir
      if (activityRow) {
        await logDelete(
          'activity',
          activityId,
          activityRow.subject || activityRow.type,
          {
            type: activityRow.type,
            subject: activityRow.subject,
            description: activityRow.description,
            scheduled_for: activityRow.scheduled_for,
            responsible_id: activityRow.responsible_id,
          },
          activityRow.workspace_id || effectiveWorkspaceId
        );
      }

      const { error } = await supabase.from("activities").delete().eq("id", activityId);
      if (error) throw error;
      await fetchActivities();
      queryClient.invalidateQueries({ queryKey: ['card-history', cardId] });
    },
    [authUser?.id, cardId, effectiveWorkspaceId, fetchActivities, getUserDisplayName, queryClient]
  );

  const handleDeleteActivity = useCallback(async () => {
    if (!selectedActivityForEdit || !cardId) return;
    try {
      await deleteActivityById(selectedActivityForEdit.id);

      toast({
        title: "Sucesso",
        description: "Atividade excluída.",
      });

      setIsActivityEditModalOpen(false);
      setSelectedActivityForEdit(null);
    } catch (error: any) {
      console.error("Erro ao excluir atividade:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a atividade.",
        variant: "destructive",
      });
    }
  }, [cardId, deleteActivityById, selectedActivityForEdit, toast]);

  const openNoteEditFromHistory = useCallback(
    async (noteId?: string) => {
      if (!noteId) {
        toast({
          title: "Anotação não encontrada",
          description: "O item não possui referência de anotação.",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data, error } = await supabase
          .from("pipeline_card_notes")
          .select("*")
          .eq("id", noteId)
          .maybeSingle();

        if (error || !data) {
          throw error || new Error("Anotação não localizada.");
        }

        setSelectedNoteForEdit(data);
        setNoteEditContent((data as any).content || "");
        setEditingNoteId((data as any).id);
        setEditingNoteContent((data as any).content || "");
      } catch (error: any) {
        console.error("Erro ao carregar anotação:", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível abrir a edição da anotação.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  const handleUpdateNote = useCallback(async () => {
    const targetNoteId = editingNoteId || selectedNoteForEdit?.id;
    const contentToSave = editingNoteId ? editingNoteContent : noteEditContent;
    if (!targetNoteId || !contentToSave.trim() || !cardId) return;
    try {
      const { error } = await supabase
        .from("pipeline_card_notes")
        .update({
          content: contentToSave,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetNoteId);

      if (error) throw error;

      // Atualizar metadata no histórico para refletir novo conteúdo (quando existir)
      const { data: historyRow } = await supabase
        .from("pipeline_card_history")
        .select("id, metadata")
        .eq("card_id", cardId)
        .eq("metadata->>note_id", targetNoteId)
        .order("changed_at", { ascending: false })
        .maybeSingle();

      if (historyRow?.id) {
        const updatedMetadata = {
          ...(historyRow.metadata as any),
          content: contentToSave,
          // ✅ NÃO truncar: o usuário precisa ver o texto completo no histórico
          description: `Anotação adicionada: ${contentToSave}`,
        };

        await supabase
          .from("pipeline_card_history")
          .update({ metadata: updatedMetadata })
          .eq("id", historyRow.id);
      }

      toast({
        title: "Sucesso",
        description: "Anotação atualizada.",
      });

      setSelectedNoteForEdit(null);
      setEditingNoteId(null);
      setEditingNoteContent("");
      queryClient.invalidateQueries({ queryKey: ['card-history', cardId] });
    } catch (error: any) {
      console.error("Erro ao atualizar anotação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar a anotação.",
        variant: "destructive",
      });
    }
  }, [cardId, editingNoteContent, editingNoteId, noteEditContent, queryClient, selectedNoteForEdit, toast]);

  const handleUpdateContactName = async () => {
    if (!contact?.id || !tempContactName.trim()) {
      setIsEditingContactName(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: tempContactName.trim() })
        .eq('id', contact.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nome do contato atualizado com sucesso."
      });

      setContact({ ...contact, name: tempContactName.trim() });
      setIsEditingContactName(false);
      await fetchCardData();
    } catch (error) {
      console.error('Erro ao atualizar nome do contato:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o nome do contato.",
        variant: "destructive"
      });
    }
  };

  const deleteNoteById = useCallback(
    async (noteId: string) => {
      const { error } = await supabase.from("pipeline_card_notes").delete().eq("id", noteId);
      if (error) throw error;
      await supabase
        .from("pipeline_card_history")
        .delete()
        .eq("card_id", cardId)
        .eq("metadata->>note_id", noteId);
      queryClient.invalidateQueries({ queryKey: ['card-history', cardId] });
    },
    [cardId, queryClient]
  );

  const handleDeleteNote = useCallback(async () => {
    const targetNoteId = editingNoteId || selectedNoteForEdit?.id;
    if (!targetNoteId || !cardId) return;
    try {
      await deleteNoteById(targetNoteId);

      toast({
        title: "Sucesso",
        description: "Anotação excluída.",
      });

      setSelectedNoteForEdit(null);
      setEditingNoteId(null);
      setEditingNoteContent("");
    } catch (error: any) {
      console.error("Erro ao excluir anotação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível excluir a anotação.",
        variant: "destructive",
      });
    }
  }, [cardId, deleteNoteById, editingNoteId, selectedNoteForEdit, toast]);

  const handleHistoryEdit = useCallback(
    (event: any) => {
      if (event.type === "notes") {
        openNoteEditFromHistory(event.metadata?.note_id);
      } else if (event.type?.startsWith("activity_")) {
        openActivityEditFromHistory(event);
      } else {
        toast({
          title: "Item não editável",
          description: "Somente atividades e anotações podem ser editadas aqui.",
        });
      }
    },
    [openActivityEditFromHistory, openNoteEditFromHistory, toast]
  );

  const handleHistoryDelete = useCallback(
    async (event: any) => {
      try {
        if (event.type === "notes" && event.metadata?.note_id) {
          await deleteNoteById(event.metadata.note_id);
          toast({ title: "Sucesso", description: "Anotação excluída." });
        } else if (event.type?.startsWith("activity_")) {
          const baseId = (event.id || "").split("_")[0];
          await deleteActivityById(baseId);
          toast({ title: "Sucesso", description: "Atividade excluída." });
        } else {
          toast({
            title: "Item não excluível",
            description: "Somente atividades e anotações podem ser excluídas aqui.",
          });
        }
      } catch (error: any) {
        console.error("Erro ao excluir item do histórico:", error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível excluir o item.",
          variant: "destructive",
        });
      }
    },
    [deleteActivityById, deleteNoteById, toast]
  );

  const cancelNoteEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteContent("");
    setSelectedNoteForEdit(null);
  }, []);

  const executeEditorCommand = (command: string, value: string | undefined = undefined) => {
    if (noteContentRef.current) {
      noteContentRef.current.focus();
      document.execCommand(command, false, value);
      // Forçar atualização do estado após comando
      setNoteContent(noteContentRef.current.innerHTML || "");
    }
  };

  // Adicionar produto ou valor ao card
  const handleAddProductToCard = useCallback(async () => {
    if (!cardId || !effectiveWorkspaceId) return;
    
    // Se tem produto selecionado, adicionar produto
    if (selectedProductId) {
      try {
        const selectedProduct = (availableProducts || []).find((p: any) => p.id === selectedProductId);
        const productValue = selectedProduct?.value || 0;
        const qty = productQuantity || 1;
        const totalValue = productValue * qty;
        
        const { error } = await supabase
          .from('pipeline_cards_products')
          .insert({
            pipeline_card_id: cardId,
            product_id: selectedProductId,
            product_name_snapshot: selectedProduct?.name || null,
            workspace_id: effectiveWorkspaceId,
            quantity: qty,
            unit_value: productValue,
            total_value: totalValue,
            is_recurring: false,
          });

        if (error) {
          console.error('Erro ao inserir produto:', error);
          throw error;
        }

        toast({
          title: "Produto adicionado",
          description: `${qty}x ${selectedProduct?.name || 'Produto'} vinculado ao negócio.`,
        });

        // Recarregar produtos do card
        const { data: productsData } = await supabase
          .from('pipeline_cards_products')
          .select(`
            id,
            product_id,
            total_value,
            unit_value,
            quantity,
            product:products(id, name, value)
          `)
          .eq('pipeline_card_id', cardId);

        if (productsData) {
          setCardProducts(productsData);
        }

        setIsProductModalOpen(false);
        setSelectedProductId("");
        setManualValue("");
        setProductQuantity(1);
      } catch (error: any) {
        console.error('Erro ao adicionar produto:', error);
        toast({
          title: "Erro ao adicionar produto",
          description: error.message || "Não foi possível adicionar o produto. Verifique suas permissões.",
          variant: "destructive",
        });
      }
    } 
    // Se tem valor manual, atualizar valor do card
    else if (manualValue) {
      try {
        const valueNumber = parseFloat(manualValue.replace(',', '.'));
        if (isNaN(valueNumber)) {
          toast({
            title: "Erro",
            description: "Preço inválido.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from('pipeline_cards')
          .update({ value: valueNumber })
          .eq('id', cardId);

        if (error) throw error;

        // Atualizar cardData local
        setCardData((prev: any) => ({ ...prev, value: valueNumber }));

        toast({
          title: "Preço atualizado",
          description: "O preço foi atualizado no negócio.",
        });

        setIsProductModalOpen(false);
        setSelectedProductId("");
        setManualValue("");
      } catch (error: any) {
        console.error('Erro ao atualizar valor:', error);
        toast({
          title: "Erro",
          description: error.message || "Não foi possível atualizar o valor.",
          variant: "destructive",
        });
      }
    }
  }, [cardId, selectedProductId, manualValue, toast, availableProducts, effectiveWorkspaceId, productQuantity]);

  // Remover produto do card
  const handleRemoveProduct = useCallback(async (productRelationId: string) => {
    if (!cardId) return;
    try {
      const { error } = await supabase
        .from('pipeline_cards_products')
        .delete()
        .eq('id', productRelationId);

      if (error) throw error;

      // Recarregar produtos do card
      const { data: productsData } = await supabase
        .from('pipeline_cards_products')
        .select(`
          id,
          product_id,
          total_value,
          unit_value,
          quantity,
          product:products(id, name, value)
        `)
        .eq('pipeline_card_id', cardId);

      if (productsData) {
        setCardProducts(productsData);
      }

      toast({
        title: "Produto removido",
        description: "O produto foi removido do negócio.",
      });
    } catch (error: any) {
      console.error('Erro ao remover produto:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover o produto.",
        variant: "destructive",
      });
    }
  }, [cardId, toast]);

  // Remover valor do card
  const handleRemoveValue = useCallback(async () => {
    if (!cardId) return;
    try {
      const { error } = await supabase
        .from('pipeline_cards')
        .update({ value: 0 })
        .eq('id', cardId);

      if (error) throw error;

      // Atualizar cardData local
      setCardData((prev: any) => ({ ...prev, value: 0 }));

      toast({
        title: "Preço removido",
        description: "O preço foi removido do negócio.",
      });
    } catch (error: any) {
      console.error('Erro ao remover valor:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover o valor.",
        variant: "destructive",
      });
    }
  }, [cardId, toast]);

  // ✅ Aba "Arquivos": listar anexos salvos nas atividades (mesmo que não exista evento em pipeline_card_history)
  // (precisa ficar ANTES de returns condicionais para não quebrar a ordem de hooks)
  const activityAttachmentEvents = useMemo(() => {
    const byActivityId = new Map<string, any>();

    for (const ev of historyEvents || []) {
      if (!ev?.type?.startsWith?.("activity_")) continue;
      const url = ev?.metadata?.attachment_url;
      if (!url) continue;

      const baseId = String(ev.id || "").split("_")[0] || String(ev?.metadata?.activity_id || "");
      if (!baseId) continue;

      const prev = byActivityId.get(baseId);
      // Preferir o evento "created" para representar o anexo da atividade (mais intuitivo)
      if (!prev || (prev?.action !== "created" && ev?.action === "created")) {
        byActivityId.set(baseId, ev);
      }
    }

    return Array.from(byActivityId.values()).sort((a, b) => {
      const aTime = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    });
  }, [historyEvents]);

  const fileHistoryEvents = useMemo(() => {
    return (historyEvents || []).filter((e: any) => e?.type === "files");
  }, [historyEvents]);

  const filesCount = useMemo(() => {
    const unique = new Set<string>();
    activityAttachmentEvents.forEach((e: any) => {
      const url = e?.metadata?.attachment_url;
      if (url) unique.add(String(url));
    });
    fileHistoryEvents.forEach((e: any) => {
      const url = e?.metadata?.attachment_url;
      if (url) unique.add(String(url));
    });
    return unique.size;
  }, [activityAttachmentEvents, fileHistoryEvents]);

  if (isLoading || !cardData || !cardId) {
    return (
      <div className="h-screen flex flex-col bg-white dark:bg-[#0f0f0f]">
        <div className={cn("px-6 py-4 border-b shrink-0 bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-gray-700")}>
          <div className="flex items-center gap-4">
            {!onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const pipelinePath = (userRole === 'master' && effectiveWorkspaceId) 
                    ? `/workspace/${effectiveWorkspaceId}/pipeline` 
                    : '/pipeline';
                  navigate(pipelinePath);
                }}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <span className="text-sm font-medium">Voltar ao Pipeline</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Carregando detalhes do negócio...</p>
          </div>
        </div>
      </div>
    );
  }

  // Calcular dias em cada estágio
  const getDaysInStage = (columnId: string) => {
    if (!columnId || !timeInColumns) return 0;
    return timeInColumns[columnId] || 0;
  };

  const currentColumnIndex = columns && cardData ? columns.findIndex(col => col.id === cardData.column_id) : -1;
  
  // Encontrar colunas já passadas (antes da atual)
  const getPassedColumns = () => {
    if (!columns || currentColumnIndex === -1) return [];
    return columns.slice(0, currentColumnIndex);
  };

  const passedColumns = getPassedColumns();

  // Função para filtrar eventos do histórico
  const getFilteredHistoryEvents = (events: any[], filter: string) => {
    if (filter === "all") return events;
    if (filter === "activities") return events.filter(e => e.type?.startsWith("activity_"));
    if (filter === "activities_done") {
      return events.filter(e => {
        if (!e.type?.startsWith("activity_")) return false;
        // Mostrar apenas eventos de conclusão
        return e.metadata?.status === 'completed';
      });
    }
    if (filter === "activities_future") {
      // Criar um Set com IDs de atividades que foram concluídas
      const completedActivityIds = new Set<string>();
      events.forEach(e => {
        if (e.type?.startsWith("activity_") && e.metadata?.status === 'completed') {
          // Extrair o ID da atividade do ID do evento (formato: activityId_completed)
          const activityId = e.id.replace('_completed', '');
          completedActivityIds.add(activityId);
        }
      });
      
      return events.filter(e => {
        if (!e.type?.startsWith("activity_")) return false;
        // Excluir eventos de conclusão
        if (e.metadata?.status === 'completed') return false;
        // Excluir eventos de criação de atividades que já foram concluídas
        if (e.metadata?.status === 'created') {
          const activityId = e.id.replace('_created', '');
          return !completedActivityIds.has(activityId);
        }
        return true;
      });
    }
    if (filter === "notes") return events.filter(e => e.type === "notes");
    if (filter === "email") return events.filter(e => e.type === "email");
    if (filter === "files") return events.filter(e => e.type === "files");
    if (filter === "documents") return events.filter(e => e.type === "documents");
    if (filter === "invoices") return events.filter(e => e.type === "invoices");
    if (filter === "changelog") return events.filter(e => 
      ["column_transfer", "pipeline_transfer", "tag", "user_assigned", "queue_transfer", "agent_activity", "qualification"].includes(e.type)
    );
    return events;
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0f0f0f] overflow-hidden">
      {/* Header Fixo */}
      <div className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f0f]">
        {/* Top Header */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (onClose) {
                    onClose();
                    return;
                  }
                  const pipelineParam = cardData?.pipeline_id ? `?pipelineId=${cardData.pipeline_id}` : '';
                  if (effectiveWorkspaceId) {
                    navigate(`/workspace/${effectiveWorkspaceId}/pipeline${pipelineParam}`);
                  } else {
                    navigate(`/pipeline${pipelineParam}`);
                  }
                }}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Título */}
              <h1 className="text-lg font-semibold px-2 py-1">
                Oportunidade
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Proprietário */}
              {owner && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={owner.profile_image_url} />
                    <AvatarFallback>{owner.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{owner.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{owner.profile || 'Usuário'}</span>
                  </div>
                </div>
              )}

            <div className="flex items-center gap-2">
              {(() => {
                const cardStatus = (cardData?.status || "aberto").toLowerCase();
                const isBusy = isExecutingAction || isMarkingAsLost || isDealStatusMoveLoading;

                if (cardStatus === "aberto") {
                  return (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsWon()}
                        disabled={isBusy}
                        className={cn(
                          "h-9 px-4 text-sm font-semibold rounded-none shadow-sm transition-all",
                          "bg-green-600 hover:bg-green-700 text-white border-transparent dark:bg-green-600 dark:hover:bg-green-700 dark:text-white"
                        )}
                      >
                        Ganho
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setDealStatusMoveMode("lost");
                          setDealStatusMoveOpen(true);
                        }}
                        disabled={isBusy}
                        className={cn(
                          "h-9 px-4 text-sm font-semibold rounded-none shadow-sm transition-all",
                          "bg-red-600 hover:bg-red-700 text-white border-transparent dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
                        )}
                      >
                        Perdido
                      </Button>
                    </>
                  );
                }

                return (
                  <Button
                    size="sm"
                    onClick={() => {
                      setDealStatusMoveMode("reopen");
                      setDealStatusMoveOpen(true);
                    }}
                    disabled={isBusy}
                    className={cn(
                      "h-9 px-4 text-sm font-semibold rounded-none shadow-sm transition-all",
                      "bg-blue-600 hover:bg-blue-700 text-white border-transparent dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                    )}
                  >
                    Reabrir
                  </Button>
                );
              })()}
            </div>
              
              {/* Popover de ações do card */}
              <Popover open={isCardActionsPopoverOpen} onOpenChange={setIsCardActionsPopoverOpen}>
                <PopoverContent 
                  className="w-48 p-1 z-[100] bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-md" 
                  align="end"
                  side="bottom"
                  sideOffset={5}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-9 px-2"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsEditingName(true);
                        setIsCardActionsPopoverOpen(false);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-9 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsCardActionsPopoverOpen(false);
                        handleDeleteCard();
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Breadcrumb do pipeline */}
        {pipelineIdForColumns && columns && Array.isArray(columns) && columns.length > 0 && cardData && cardData.column_id && (
          <div className="px-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <button 
                className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-0 p-0 cursor-pointer"
                data-testid="pipeline-info"
              >
                <span>
                  {pipelineData?.name ||
                    availablePipelines?.find((p: any) => p.id === cardData?.pipeline_id)?.name ||
                    "Pipeline"}
                </span>
                <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
                <Popover open={isColumnSelectModalOpen} onOpenChange={setIsColumnSelectModalOpen}>
                  <PopoverTrigger asChild>
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedColumnId(cardData?.column_id || "");
                      }}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {currentColumn?.name ||
                        columns?.find((c: any) => c.id === cardData?.column_id)?.name ||
                        'Coluna não encontrada'}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] shadow-lg"
                    align="start"
                    sideOffset={8}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-4 min-w-[400px]">
                      {/* Select do Pipeline */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 block">
                          Pipeline
                        </label>
                        <Select
                          value={selectedPipelineId || ""}
                          onValueChange={(value) => {
                            setSelectedPipelineId(value);
                            setSelectedColumnId("");
                          }}
                        >
                          <SelectTrigger className="w-full rounded-md border border-gray-300 dark:border-gray-600">
                            <SelectValue placeholder={isLoadingPipelines ? "Carregando pipelines..." : "Selecione um pipeline"}>
                              {availablePipelines?.find(p => p.id === selectedPipelineId)?.name || pipelineData?.name || 'Selecione um pipeline'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingPipelines ? (
                              <SelectItem value="__loading__" disabled>Carregando...</SelectItem>
                            ) : availablePipelines && availablePipelines.length > 0 ? (
                              availablePipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__empty__" disabled>
                                Nenhum pipeline disponível
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Select das Colunas do Pipeline */}
                      <Select
                        value={selectedColumnId || ""}
                        onValueChange={(value) => {
                          setSelectedColumnId(value);
                        }}
                      >
                        <SelectTrigger className="w-full rounded-md border border-gray-300 dark:border-gray-600">
                          <SelectValue placeholder={selectedPipelineId ? "Selecione uma coluna" : "Selecione um pipeline primeiro"}>
                            {columns?.find(c => c.id === selectedColumnId)?.name || 'Selecione uma coluna'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {columns && columns.length > 0 ? (
                            columns.map((column) => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="" disabled>
                              Nenhuma coluna disponível
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {/* Etapa do funil - Visualização com segmentos */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 block">
                          Etapa do funil
                        </label>
                        {columns && columns.length > 0 ? (
                          <div className="flex items-center gap-0.5" role="listbox">
                            {columns.map((column, index) => {
                              const selectedIndex = columns.findIndex(c => c.id === selectedColumnId);
                              // Verde do segmento 0 até o índice selecionado (inclusive)
                              const isGreen = selectedIndex !== -1 && index <= selectedIndex;
                              const isFirst = index === 0;
                              const isLast = index === columns.length - 1;
                              
                              return (
                                <div
                                  key={column?.id || index}
                                  className={cn(
                                    "relative flex items-center justify-center text-xs font-medium transition-colors",
                                    "cursor-pointer hover:opacity-90"
                                  )}
                                  onClick={() => {
                                    setSelectedColumnId(column.id);
                                  }}
                                  style={{ 
                                    flex: 1,
                                    height: '32px',
                                    clipPath: isLast 
                                      ? "polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)"
                                      : isFirst
                                      ? "polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)"
                                      : "polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%, 6px 50%)",
                                    marginLeft: isFirst ? 0 : -6,
                                    paddingLeft: isFirst ? "0.5rem" : "0.75rem",
                                    paddingRight: isLast ? "0.5rem" : "0.75rem",
                                    zIndex: columns.length - index,
                                    backgroundColor: isGreen
                                      ? "#16a34a" // green-600
                                      : "#e5e7eb", // gray-200
                                    color: isGreen ? "#ffffff" : "#374151", // gray-700
                                  }}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                            Nenhuma coluna disponível
                          </div>
                        )}
                      </div>

                      {/* Botões */}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsColumnSelectModalOpen(false)}
                          className="bg-white dark:bg-[#1f1f1f] border-gray-300 dark:border-gray-600"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => {
                            if (selectedPipelineId && selectedColumnId) {
                              handleMoveCardToColumn(selectedPipelineId, selectedColumnId);
                            }
                          }}
                          disabled={
                            !selectedPipelineId ||
                            !selectedColumnId ||
                            (selectedPipelineId === cardData?.pipeline_id && selectedColumnId === cardData?.column_id)
                          }
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Esquerda */}
        <div className="w-80 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Resumo */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left font-medium text-sm py-2.5 px-3">
                <span>Resumo</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                {/* Pessoa/Contato */}
                {contact && (
                  <>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-400" />
                      <div className="flex-1">
                        {isEditingContactName ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={tempContactName}
                              onChange={(e) => setTempContactName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateContactName();
                                if (e.key === 'Escape') setIsEditingContactName(false);
                              }}
                              className="h-7 text-xs py-0"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-green-600"
                              onClick={handleUpdateContactName}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-600"
                              onClick={() => setIsEditingContactName(false)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-900 dark:text-gray-100">
                            {contact.name || contact.phone || 'Sem contato'}
                          </span>
                        )}
                      </div>
                      {!isEditingContactName && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                          onClick={() => {
                            setTempContactName(contact.name || "");
                            setIsEditingContactName(true);
                          }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatPhone(contact.phone) || 'Sem telefone'}
                      </span>
                      {contact.phone && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-none"
                          onClick={handleCopyContactPhone}
                          title="Copiar número"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Valor/Produtos */}
                <div className="flex items-start gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    {cardProducts.length > 0 ? (
                      <>
                        {/* Lista de todos os produtos vinculados */}
                        {cardProducts.map((cp, index) => {
                          const productValue = cp.total_value || cp.unit_value || cp.product?.value || 0;
                          const productName = cp.product?.name || cp.product_name_snapshot || 'Produto sem nome';
                          const quantity = cp.quantity || 1;
                          return (
                            <div key={cp.id} className="flex items-center justify-between group">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {productName} {quantity > 1 && <span className="text-gray-500 dark:text-gray-400 font-normal">({quantity}x)</span>}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400 text-xs">
                                  R$ {productValue ? Number(productValue).toFixed(2).replace('.', ',') : '0,00'}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveProduct(cp.id)}
                                title="Remover produto"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {/* Total se houver mais de 1 produto */}
                        {cardProducts.length > 1 && (
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total:</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                R$ {cardProducts.reduce((sum, cp) => {
                                  const val = cp.total_value || cp.unit_value || cp.product?.value || 0;
                                  return sum + Number(val);
                                }, 0).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : cardData.value && cardData.value > 0 ? (
                      <div className="flex items-center justify-between group">
                        <div className="font-medium">
                          R$ {cardData.value.toFixed(2).replace('.', ',')}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemoveValue}
                          title="Remover valor"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-400">
                        R$ 0,00
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs shrink-0"
                    onClick={() => setIsProductModalOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Produtos
                  </Button>
                </div>

                {/* Empresa */}
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-gray-700 dark:text-gray-300 text-xs font-medium">
                      Empresa
                    </div>
                    {isEditingCompany ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={tempCompany}
                          onChange={(e) => setTempCompany(e.target.value)}
                          placeholder="Digite a empresa..."
                          className="h-7 text-xs rounded-none border border-gray-300 bg-white dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100"
                          disabled={isSavingCompany}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={handleSaveCompany}
                          disabled={isSavingCompany}
                          title="Salvar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setIsEditingCompany(false);
                            setTempCompany(companyInfo.value || "");
                          }}
                          disabled={isSavingCompany}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className={cn("text-sm", companyInfo.value ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400")}>
                          {companyInfo.value || "Adicionar empresa"}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setTempCompany(companyInfo.value || "");
                            setIsEditingCompany(true);
                          }}
                          title={companyInfo.value ? "Editar empresa" : "Adicionar empresa"}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Qualificação do Negócio */}
                <div className="flex items-center gap-2 text-sm">
                  <CheckSquare className="h-4 w-4 text-gray-400" />
                  <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                    <div className="text-gray-700 dark:text-gray-300 text-xs font-medium whitespace-nowrap">
                      Qualificar Oportunidade
                    </div>
                    <Select
                      value={normalizeDealQualification(cardData?.qualification)}
                      onValueChange={(value) => handleUpdateDealQualification(value as any)}
                      disabled={isUpdatingQualification}
                    >
                      <SelectTrigger className="h-7 w-[170px] text-xs rounded-none border border-gray-300 bg-white dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none [&_.absolute.left-2]:hidden [&_[data-radix-select-item-indicator]]:hidden [&_[data-state=checked]]:hidden">
                        <SelectItem value="unqualified" className="pl-2 pr-2">Selecionar</SelectItem>
                        <SelectItem value="qualified" className="pl-2 pr-2">Qualificado</SelectItem>
                        <SelectItem value="disqualified" className="pl-2 pr-2">Desqualificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Etiquetas */}
                <div className="flex items-start gap-2 text-sm">
                  <Tag className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div className="flex-1 flex flex-wrap gap-1">
                    {contactTags.length > 0 ? (
                      contactTags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                                className="text-[11px] font-semibold h-5 rounded-none border-none px-2 py-0.5 inline-flex items-center gap-1 text-black dark:text-white"
                                style={{
                                  backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)'
                                }}
                        >
                          <span>{tag.name}</span>
                          <button
                            className="ml-1 rounded-sm hover:bg-black/10 transition-colors flex items-center justify-center"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!contact?.id) return;
                              try {
                                const { error } = await supabase
                                  .from('contact_tags')
                                  .delete()
                                  .eq('contact_id', contact.id)
                                  .eq('tag_id', tag.id);
                                
                                if (error) throw error;
                                
                                setContactTags(prev => prev.filter(t => t.id !== tag.id));
                                toast({
                                  title: "Etiqueta removida",
                                  description: "A etiqueta foi removida com sucesso."
                                });
                              } catch (error) {
                                console.error('Erro ao remover etiqueta:', error);
                                toast({
                                  title: "Erro",
                                  description: "Não foi possível remover a etiqueta.",
                                  variant: "destructive"
                                });
                              }
                            }}
                            title="Remover etiqueta"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Adicionar etiquetas</span>
                    )}
                  </div>
                  {contact?.id && (
                    <AddContactTagButton
                      contactId={contact.id}
                      onTagAdded={(tag) => {
                        setContactTags((prev) => {
                          if (prev.some((existing) => existing.id === tag.id)) {
                            return prev;
                          }
                          return [...prev, tag];
                        });
                      }}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Visão Geral */}
            <Collapsible defaultOpen>
              {/* ✅ Evita <button> dentro de <button>: CollapsibleTrigger vira um <div> via asChild */}
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full text-left font-medium text-sm py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    <span>Visão geral</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Recarregar dados
                      if (cardId && contact?.id) {
                        fetchActivities();
                      }
                    }}
                    title="Atualizar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-4">
                {overviewData ? (
                  <>
                    {/* Informações Gerais */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          Responsável
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          {owner?.name ? (
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px]">
                              {owner.name}
                            </span>
                          ) : null}
                          <Select
                            value={cardData?.responsible_user_id || ""}
                            onValueChange={(value) => handleTransferResponsibleUser(value)}
                            disabled={isUpdatingResponsibleUser}
                          >
                            <SelectTrigger className="h-7 w-[170px] text-xs rounded-none border border-gray-300 bg-white dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100">
                              <SelectValue placeholder="Trocar" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none [&>div>div>span.absolute]:hidden [&>div>div]:pl-2 [&>div>div]:pr-2">
                              {eligibleTransferUsers.length === 0 ? (
                                <SelectItem value="__empty__" disabled>
                                  Nenhum usuário disponível
                                </SelectItem>
                              ) : (
                                eligibleTransferUsers.map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Transferir Oportunidade
                          </span>
                          {/* Botão de transferir removido a pedido */}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={transferPipelineId || ""}
                            onValueChange={(value) => {
                              // Trocar pipeline NÃO deve disparar transferência.
                              transferTouchedRef.current = false;
                              setTransferPipelineId(value);
                              setTransferColumnId("");
                            }}
                            disabled={isLoadingPipelines || (availablePipelines || []).length === 0}
                          >
                            <SelectTrigger className="h-7 w-full text-xs rounded-none border border-gray-300 bg-white dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100">
                              <SelectValue placeholder={isLoadingPipelines ? "Carregando..." : "Pipeline"} />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {isLoadingPipelines ? (
                                <SelectItem value="__loading__" disabled>
                                  Carregando...
                                </SelectItem>
                              ) : (availablePipelines || []).length > 0 ? (
                                (availablePipelines || []).map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__empty__" disabled>
                                  Nenhum pipeline disponível
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>

                          <Select
                            value={transferColumnId || ""}
                            onValueChange={(value) => {
                              transferTouchedRef.current = true;
                              setTransferColumnId(value);
                            }}
                            disabled={
                              !transferPipelineId ||
                              isLoadingTransferColumns ||
                              !(transferColumns && transferColumns.length > 0)
                            }
                          >
                            <SelectTrigger className="h-7 w-full text-xs rounded-none border border-gray-300 bg-white dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100">
                              <SelectValue
                                placeholder={
                                  !transferPipelineId
                                    ? "Coluna"
                                    : isLoadingTransferColumns
                                      ? "Carregando..."
                                      : "Coluna"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {transferColumns && transferColumns.length > 0 ? (
                                transferColumns.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="__empty__" disabled>
                                  Nenhuma coluna disponível
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Tempo da Oportunidade</span>
                        <span className="font-medium">{overviewData.businessAge} dias</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 dark:text-gray-400">Inativo (dias)</span>
                          <Info className="h-3 w-3 text-gray-400" />
                        </div>
                        <span className="font-medium">{overviewData.inactiveDays}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Criado em</span>
                        <span className="font-medium">{overviewData.createdAt}</span>
                      </div>
                    </div>

                    {/* Atividades Principais */}
                    {overviewData.activityStats.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Atividades principais</h3>
                        
                        {/* Gráfico de barras */}
                        <div className="flex gap-0.5 h-4 rounded overflow-hidden">
                          {overviewData.activityStats.map((stat, index) => {
                            const colors = ['bg-yellow-500', 'bg-yellow-400', 'bg-yellow-300', 'bg-yellow-200'];
                            return (
                              <div
                                key={stat.type}
                                className={colors[index] || 'bg-gray-300'}
                                style={{ width: `${stat.percentage}%` }}
                                title={`${stat.type}: ${stat.count} (${stat.percentage}%)`}
                              />
                            );
                          })}
                        </div>

                        {/* Tabela de atividades */}
                        <table className="w-full text-xs">
                          <tbody>
                            {overviewData.activityStats.map((stat) => (
                              <tr key={stat.type} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-1 text-gray-700 dark:text-gray-300">{stat.type}</td>
                                <td className="py-1 text-right font-medium">{stat.count}</td>
                                <td className="py-1 text-right text-gray-500 dark:text-gray-400">{stat.percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Usuários Mais Ativos */}
                    {overviewData.userStats.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usuários mais ativos</h3>
                        
                        {/* Gráfico de barras */}
                        <div className="flex gap-0.5 h-4 rounded overflow-hidden">
                          {overviewData.userStats.map((stat, index) => {
                            const maxPercentage = overviewData.userStats[0]?.percentage || 100;
                            const width = (stat.percentage / maxPercentage) * 100;
                            return (
                              <div
                                key={stat.name}
                                className="bg-blue-500"
                                style={{ width: `${width}%` }}
                                title={`${stat.name}: ${stat.count} (${stat.percentage}%)`}
                              />
                            );
                          })}
                        </div>

                        {/* Tabela de usuários */}
                        <table className="w-full text-xs">
                          <tbody>
                            {overviewData.userStats.map((stat) => (
                              <tr key={stat.name} className="border-b border-gray-200 dark:border-gray-700">
                                <td className="py-1 text-gray-700 dark:text-gray-300">{stat.name}</td>
                                <td className="py-1 text-right font-medium">{stat.count}</td>
                                <td className="py-1 text-right text-gray-500 dark:text-gray-400">{stat.percentage}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : cardData ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Sem dados disponíveis
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Carregando dados...
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Detalhes */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left font-medium text-sm py-2.5 px-3">
                <span>Detalhes</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2 text-sm">
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-none border-gray-300 dark:border-gray-700"
                    onClick={openDetailsEditor}
                    disabled={!contact?.id}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Editar
                  </Button>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>
                  <Badge className="ml-2">{cardData.status || 'aberto'}</Badge>
                </div>
                {contact && (
                  <div className="space-y-1.5">
                    {additionalContactInfo.length > 0 && (
                      <div className="space-y-1">
                        {additionalContactInfo.map((item, idx) => (
                          <div key={`${item.label}-${idx}`} className="flex items-start gap-1.5">
                            <span className="text-gray-500 dark:text-gray-400">{item.label}:</span>
                            <span className={cn(
                              "break-words",
                              item.value ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
                            )}>
                              {item.value || "0"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Área Principal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <>
          {/* Tabs */}
          <Tabs
            value={mainTab}
            className="flex-1 flex flex-col overflow-hidden"
            onValueChange={(tab) => {
              setMainTab(tab as any);
              if (tab !== "atividade") return;
              if (didInitActivityTimeRef.current) return;

              // Só aplicar automaticamente se o usuário ainda não começou a preencher
              const shouldApply =
                !activityForm.subject?.trim() &&
                !activityForm.description?.trim() &&
                activityForm.startTime === "13:00" &&
                activityForm.endTime === "13:30";

              if (!shouldApply) {
                didInitActivityTimeRef.current = true;
                return;
              }

              const range = getBrasiliaRoundedTimeRange();
              setActivityForm((prev) => ({
                ...prev,
                startDate: range.startDate,
                endDate: range.endDate,
                startTime: range.startTime,
                endTime: range.endTime,
              }));
              setSelectedStartHour(range.startHour);
              setSelectedStartMinute(range.startMinute);
              setSelectedEndHour(range.endHour);
              setSelectedEndMinute(range.endMinute);
              didInitActivityTimeRef.current = true;
            }}
          >
            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <TabsList className="bg-transparent gap-4">
                {mode !== "activity_edit" && (
                  <TabsTrigger 
                    value="anotacoes" 
                    className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:text-gray-400 dark:data-[state=active]:text-white"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Anotações</span>
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="atividade" 
                  className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:text-gray-400 dark:data-[state=active]:text-white"
                >
                  <CalendarIconLucide className="h-4 w-4" />
                  <span>Atividades</span>
                </TabsTrigger>
                {mode !== "activity_edit" && (
                  <TabsTrigger 
                    value="mensagens" 
                    className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:text-gray-400 dark:data-[state=active]:text-white"
                  >
                    <MessageSquareIcon className="h-4 w-4" />
                    <span>Mensagens</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="anotacoes" className="mt-0">
                <div className="space-y-4">
                  {/* Área de texto com fundo amarelo */}
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-none border border-gray-200 dark:border-gray-700 min-h-[300px] flex flex-col">
                    {/* Editor de texto */}
                    <div className="flex-1 relative">
                      {!noteContent && (
                        <div className="absolute top-4 left-4 text-gray-400 pointer-events-none text-sm">
                          Escreva uma anotação, @nome...
                        </div>
                      )}
                      <style>
                        {`
                          .note-editor ul { list-style-type: disc !important; margin-left: 1.5rem !important; margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
                          .note-editor ol { list-style-type: decimal !important; margin-left: 1.5rem !important; margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
                          .note-editor li { display: list-item !important; margin-bottom: 0.25rem !important; }
                          .note-editor b, .note-editor strong { font-weight: 700 !important; }
                          .note-editor i, .note-editor em { font-style: italic !important; }
                          .note-editor u { text-decoration: underline !important; }
                        `}
                      </style>
                      <div
                        ref={noteContentRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML || "";
                          setNoteContent(html);
                        }}
                        onFocus={(e) => {
                          if (!e.currentTarget.innerHTML) {
                            e.currentTarget.innerHTML = "";
                          }
                        }}
                        className="flex-1 p-4 outline-none text-sm min-h-[200px] relative z-10 text-gray-900 dark:text-gray-100 note-editor prose prose-sm dark:prose-invert max-w-none"
                      />
                    </div>
                    
                    {/* Toolbar de formatação */}
                    <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex items-center gap-1 flex-wrap">
                      <TooltipProvider delayDuration={700}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('bold');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Negrito</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('italic');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Itálico</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('underline');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <Underline className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Sublinhado</p>
                          </TooltipContent>
                        </Tooltip>

                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('insertUnorderedList');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                            >
                              <List className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Lista de marcadores</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('insertOrderedList');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Lista numerada</p>
                          </TooltipContent>
                        </Tooltip>

                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('outdent');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <AlignLeft className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Diminuir indentação</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('indent');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <AlignRight className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Aumentar indentação</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                      <button
                        type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                executeEditorCommand('removeFormat');
                              }}
                              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                            <p>Remover formatação</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Botões de ação */}
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNoteContent("");
                            if (noteContentRef.current) {
                              noteContentRef.current.innerHTML = "";
                            }
                          }}
                          className="h-8 dark:bg-transparent dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!noteContent.trim() || !cardId || !effectiveWorkspaceId) {
                              toast({
                                title: "Erro",
                                description: "Por favor, escreva uma anotação antes de salvar.",
                                variant: "destructive"
                              });
                              return;
                            }

                            try {
                              // Obter usuário atual do system_users
                              const currentUserStr = localStorage.getItem('currentUser');
                              if (!currentUserStr) {
                                throw new Error('Usuário não autenticado');
                              }
                              const currentUser = JSON.parse(currentUserStr);
                              
                              if (!currentUser.id) {
                                throw new Error('ID do usuário não encontrado');
                              }

                              // Salvar anotação na tabela pipeline_card_notes
                              // O trigger automaticamente registra no pipeline_card_history
                              const { error } = await supabase
                                .from('pipeline_card_notes')
                                .insert({
                                  card_id: cardId,
                                  content: noteContent.trim(),
                                  created_by: currentUser.id,
                                  workspace_id: effectiveWorkspaceId
                                });

                              if (error) throw error;

                              // Limpar campo de anotação
                              setNoteContent("");
                              if (noteContentRef.current) {
                                noteContentRef.current.innerHTML = "";
                              }

                              toast({
                                title: "Anotação salva",
                                description: "A anotação foi salva com sucesso e aparecerá no histórico.",
                              });

                              // Invalidar query do histórico para atualizar
                              const queryKey = ['card-history', cardId];
                              queryClient.invalidateQueries({ queryKey });
                            } catch (error: any) {
                              console.error('Erro ao salvar anotação:', error);
                              toast({
                                title: "Erro",
                                description: error.message || "Não foi possível salvar a anotação.",
                                variant: "destructive"
                              });
                            }
                          }}
                          disabled={!noteContent.trim()}
                          className="bg-green-600 hover:bg-green-700 text-white h-8 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                    
                    {/* Contador de caracteres */}
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{noteContent.length}/100 notes</span>
                    </div>
                  </div>

                  {/* Seção de Histórico na aba de Anotações */}
                  <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="space-y-4">
                      {/* Cabeçalho do Histórico */}
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico</h3>
                      </div>
                      
                      {/* Filtros */}
                      <div className="flex items-center gap-2 flex-wrap mb-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("all")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "all" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Todos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("notes")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "notes" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Anotações ({historyEvents.filter(e => e.type === "notes").length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("activities_done")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "activities_done" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Atividades Realizadas ({getFilteredHistoryEvents(historyEvents, "activities_done").length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("activities_future")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "activities_future" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Atividades Futuras ({getFilteredHistoryEvents(historyEvents, "activities_future").length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("changelog")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "changelog" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Registro de alterações ({historyEvents.filter(e => ["column_transfer", "pipeline_transfer", "tag", "user_assigned", "queue_transfer", "agent_activity", "qualification"].includes(e.type)).length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryFilter("files")}
                          className={cn(
                            "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-none transition-colors",
                            historyFilter === "files" && "bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-black dark:text-white font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                          )}
                        >
                          Arquivos ({filesCount})
                        </Button>
                      </div>

                      {/* Timeline / Arquivos */}
                      {isLoadingHistory ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Carregando histórico...
                        </div>
                      ) : historyFilter === "files" ? (
                        <div className="space-y-3">
                          {activityAttachmentEvents.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              Nenhum arquivo encontrado
                            </div>
                          ) : (
                            activityAttachmentEvents.map((ev: any) => {
                              const eventDate = ev?.timestamp ? new Date(ev.timestamp) : new Date();
                              const userName = ev?.user_name || ev?.metadata?.changed_by_name || "Sistema";
                              const subject = ev?.metadata?.subject || ev?.metadata?.activity_subject || "Atividade";
                              const url = ev?.metadata?.attachment_url;
                              const name = ev?.metadata?.attachment_name;

                              return (
                                <div
                                  key={ev.id}
                                  className="border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] rounded-none p-3"
                                >
                                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                    {format(eventDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} • {userName} • {contact?.name || "-"}
                                  </div>

                                  <div className="mt-2 flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                                      {subject}
                                    </span>
                                  </div>

                                  {url ? (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">Anexos</span>
                                      <button
                                        type="button"
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                        onClick={() =>
                                          setSelectedFileForPreview({
                                            url,
                                            name: name || "Anexo 1",
                                          })
                                        }
                                      >
                                        Anexo 1
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {getFilteredHistoryEvents(historyEvents, historyFilter).map((event, index) => (
                            <HistoryTimelineItem
                              key={event.id}
                              event={event}
                              isLast={index === getFilteredHistoryEvents(historyEvents, historyFilter).length - 1}
                              contact={contact}
                              onEdit={handleHistoryEdit}
                              onDelete={handleHistoryDelete}
                              editingNoteId={editingNoteId}
                              editingNoteContent={editingNoteContent}
                              setEditingNoteContent={setEditingNoteContent}
                              onSaveNote={handleUpdateNote}
                              onCancelNote={cancelNoteEdit}
                              setSelectedFileForPreview={setSelectedFileForPreview}
                            />
                          ))}
                          {getFilteredHistoryEvents(historyEvents, historyFilter).length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              Nenhum evento encontrado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="atividade" className="mt-0">
                {/* Quando estamos editando uma atividade específica (vindo do histórico/Kanban),
                   mostrar o formulário de EDIÇÃO no mesmo layout do Detalhes (sem abrir Dialog separado). */}
                {selectedActivityForEdit ? (
                  <div className="flex flex-col h-full">
                    <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Edição de atividade
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {selectedActivityForEdit?.type || "Atividade"}
                          </div>
                        </div>
                      </div>

                      {/* Assunto */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Assunto</label>
                        <Input
                          placeholder={activityEditForm.type}
                          value={activityEditForm.subject}
                          onChange={(e) => setActivityEditForm({ ...activityEditForm, subject: e.target.value })}
                          className={cn(
                            "h-11 focus:border-blue-500",
                            isUiDarkMode
                              ? "bg-[#1a1a1a] border-gray-700 text-gray-100 placeholder:text-gray-500"
                              : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                          )}
                        />
                      </div>

                      {/* Tipo */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Tipo de atividade</label>
                        <TooltipProvider>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { label: "Mensagem", type: "Mensagem", icon: MessageSquareIcon },
                              { label: "Ligação não atendida", type: "Ligação não atendida", icon: Phone },
                              { label: "Ligação atendida", type: "Ligação atendida", icon: Phone },
                              { label: "Ligação abordada", type: "Ligação abordada", icon: Phone },
                              { label: "Ligação agendada", type: "Ligação agendada", icon: Phone },
                              { label: "Ligação de follow up", type: "Ligação de follow up", icon: Phone },
                              { label: "Reunião agendada", type: "Reunião agendada", icon: CalendarIconLucide },
                              { label: "Reunião realizada", type: "Reunião realizada", icon: CalendarIconLucide },
                              { label: "Reunião não realizada", type: "Reunião não realizada", icon: CalendarIconLucide },
                              { label: "Reunião reagendada", type: "Reunião reagendada", icon: CalendarIconLucide },
                              { label: "WhatsApp enviado", type: "WhatsApp enviado", icon: MessageSquareIcon },
                            ].map((option) => {
                              const Icon = option.icon;
                              return (
                                <Tooltip key={option.type}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setActivityEditForm({ ...activityEditForm, type: option.type })}
                                      className={cn(
                                        "p-2 rounded-md transition-colors",
                                        activityEditForm.type === option.type
                                          ? "bg-[#eab308] text-black"
                                          : isUiDarkMode
                                            ? "bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:bg-[#252525] hover:text-gray-100"
                                            : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                      )}
                                    >
                                      <Icon className="h-5 w-5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                                    <p>{option.label}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      </div>

                      {/* Data/Hora */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Data de início</label>
                          <Popover open={showEditStartDatePicker} onOpenChange={setShowEditStartDatePicker}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-11 rounded-md",
                                  isUiDarkMode
                                    ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                    : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                                )}
                              >
                                <CalendarIconLucide className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")} />
                                {format(activityEditForm.startDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className={cn("w-auto p-0", isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200")} align="start">
                              <Calendar
                                mode="single"
                                selected={activityEditForm.startDate}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setActivityEditForm({ ...activityEditForm, startDate: date, endDate: date });
                                  setShowEditStartDatePicker(false);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Hora de início</label>
                          <select
                            className={cn(
                              "h-11 px-3 py-1 text-sm font-normal border rounded-md w-full",
                              isUiDarkMode ? "bg-[#1a1a1a] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"
                            )}
                            value={activityEditForm.startTime}
                            onChange={(e) => {
                              const time = e.target.value;
                              const [hour, minute] = time.split(":").map(Number);
                              // manter o comportamento atual: ajustar fim automaticamente (+5 min)
                              let endHour = hour;
                              let endMinute = minute + 5;
                              if (endMinute >= 60) {
                                endMinute -= 60;
                                endHour = (endHour + 1) % 24;
                              }
                              const endTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
                              setActivityEditForm({ ...activityEditForm, startTime: time, endTime });
                            }}
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Data de fim</label>
                          <Popover open={showEditEndDatePicker} onOpenChange={setShowEditEndDatePicker}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal h-11 rounded-md",
                                  isUiDarkMode
                                    ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                    : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                                )}
                              >
                                <CalendarIconLucide className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")} />
                                {format(activityEditForm.endDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className={cn("w-auto p-0", isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200")} align="start">
                              <Calendar
                                mode="single"
                                selected={activityEditForm.endDate}
                                onSelect={(date) => {
                                  if (!date) return;
                                  setActivityEditForm({ ...activityEditForm, endDate: date });
                                  setShowEditEndDatePicker(false);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Hora de fim</label>
                          <select
                            className={cn(
                              "h-11 px-3 py-1 text-sm font-normal border rounded-md w-full",
                              isUiDarkMode ? "bg-[#1a1a1a] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"
                            )}
                            value={activityEditForm.endTime}
                            onChange={(e) => setActivityEditForm({ ...activityEditForm, endTime: e.target.value })}
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Responsável */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Responsável</label>
                        <Select
                          value={activityEditForm.responsibleId}
                          onValueChange={(v) => setActivityEditForm({ ...activityEditForm, responsibleId: v })}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-11",
                              isUiDarkMode ? "bg-[#1a1a1a] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"
                            )}
                          >
                            <SelectValue placeholder="Responsável" />
                          </SelectTrigger>
                          <SelectContent className={cn(isUiDarkMode ? "bg-[#1b1b1b] border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900")}>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Descrição */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Descrição</label>
                        <Textarea
                          placeholder="Adicione detalhes sobre a atividade..."
                          value={activityEditForm.description}
                          onChange={(e) => setActivityEditForm({ ...activityEditForm, description: e.target.value })}
                          className={cn(
                            "min-h-[120px] focus:border-blue-500",
                            isUiDarkMode
                              ? "bg-[#1a1a1a] border-gray-700 text-gray-100 placeholder:text-gray-500"
                              : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                          )}
                        />
                      </div>

                      {/* Conclusão */}
                      <div className="flex items-center gap-3 pt-2">
                        <Checkbox
                          id="activity-edit-done-inline"
                          checked={activityEditForm.markAsDone}
                          onCheckedChange={(checked) =>
                            setActivityEditForm({ ...activityEditForm, markAsDone: checked === true })
                          }
                          className={cn(
                            isUiDarkMode ? "border-gray-700" : "border-gray-300",
                            "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          )}
                        />
                        <label
                          htmlFor="activity-edit-done-inline"
                          className={cn(
                            "text-sm font-medium cursor-pointer",
                            isUiDarkMode ? "text-gray-200" : "text-gray-900"
                          )}
                        >
                          Marcar como concluída
                        </label>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-0 mx-0 mb-0 border-t flex items-center justify-end gap-4 shrink-0 px-6 py-4",
                        isUiDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-white"
                      )}
                    >
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedActivityForEdit(null);
                          if (mode === "activity_edit") onClose?.();
                        }}
                        className={cn(
                          "h-10 rounded-none",
                          isUiDarkMode
                            ? "border-gray-600 text-gray-200 hover:bg-[#252525] hover:text-white"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleDeleteActivity}
                        className="text-red-200 hover:text-red-100 hover:bg-red-500/20 h-10 px-2 flex items-center gap-2 rounded-none"
                      >
                        <X className="h-4 w-4" />
                        Excluir
                      </Button>
                      <Button
                        onClick={handleUpdateActivity}
                        className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold h-10 px-8 rounded-none"
                      >
                        Salvar Alterações
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                  <div className="flex gap-6 h-full">
                    {/* Área Principal - Formulário de Atividade */}
                    <div className="flex-1 space-y-6 p-6">
                    {/* Título da Atividade */}
                    <div>
                      <Input
                        placeholder={activityForm.type}
                        value={activityForm.subject}
                        onChange={(e) => setActivityForm({...activityForm, subject: e.target.value})}
                        className="text-lg font-semibold border-0 border-b-2 border-gray-300 dark:border-gray-600 rounded-none pl-2 pr-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent"
                      />
                    </div>

                    {/* Opções de Tipo de Atividade */}
                    <TooltipProvider>
                      <div className="flex items-center gap-2 flex-wrap">
                        {[
                          { label: "Mensagem", type: "Mensagem", icon: MessageSquareIcon },
                          { label: "Ligação não atendida", type: "Ligação não atendida", icon: Phone },
                          { label: "Ligação atendida", type: "Ligação atendida", icon: Phone },
                          { label: "Ligação abordada", type: "Ligação abordada", icon: Phone },
                          { label: "Ligação agendada", type: "Ligação agendada", icon: Phone },
                          { label: "Ligação de follow up", type: "Ligação de follow up", icon: Phone },
                          { label: "Reunião agendada", type: "Reunião agendada", icon: CalendarIconLucide },
                          { label: "Reunião realizada", type: "Reunião realizada", icon: CalendarIconLucide },
                          { label: "Reunião não realizada", type: "Reunião não realizada", icon: CalendarIconLucide },
                          { label: "Reunião reagendada", type: "Reunião reagendada", icon: CalendarIconLucide },
                          { label: "WhatsApp enviado", type: "WhatsApp enviado", icon: MessageSquareIcon },
                        ].map((option) => {
                          const Icon = option.icon;
                          return (
                            <Tooltip key={option.type}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setActivityForm({...activityForm, type: option.type})}
                                  className={cn(
                                    "p-2 rounded-md transition-colors",
                                    activityForm.type === option.type
                                      ? "bg-[#eab308] text-black"
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-md">
                                <p>{option.label}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>

                    {/* Data e Hora - Estilo Unificado */}
                    <div className="flex items-center gap-2">
                      <div className="shrink-0">
                        <Clock className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 flex-wrap md:flex-nowrap">
                        {/* Data Início */}
                        <Popover open={showStartDatePicker} onOpenChange={setShowStartDatePicker}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 px-3 py-1 text-sm font-normal border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1b1b1b] min-w-[140px]"
                            >
                              {format(activityForm.startDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-white dark:bg-[#1b1b1b] border border-gray-200 dark:border-gray-700 shadow-md" align="start">
                            <Calendar
                              mode="single"
                              selected={activityForm.startDate}
                              onSelect={(date) => {
                                if (date) {
                                  setActivityForm({
                                    ...activityForm,
                                    startDate: date,
                                    endDate: date,
                                  });
                                  setShowStartDatePicker(false);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Hora Início */}
                        <select
                          className="h-9 px-3 py-1 text-sm font-normal border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1b1b1b] min-w-[90px]"
                          value={activityForm.startTime}
                          onChange={(e) => {
                            const time = e.target.value;
                            const [hour, minute] = time.split(':').map(Number);
                            setSelectedStartHour(hour);
                            setSelectedStartMinute(minute);
                            
                            // Calcular hora fim (5 minutos depois)
                            let endHour = hour;
                            let endMinute = minute + 5;
                            if (endMinute >= 60) {
                              endMinute -= 60;
                              endHour = (endHour + 1) % 24;
                            }
                            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
                            
                            setActivityForm({ 
                              ...activityForm, 
                              startTime: time,
                              endTime: endTime 
                            });
                            setSelectedEndHour(endHour);
                            setSelectedEndMinute(endMinute);
                          }}
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>

                        <span className="text-gray-400 mx-0.5">–</span>

                        {/* Hora Fim */}
                        <select
                          className="h-9 px-3 py-1 text-sm font-normal border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1b1b1b] min-w-[90px]"
                          value={activityForm.endTime}
                          onChange={(e) => {
                            const time = e.target.value;
                            const [hour, minute] = time.split(':').map(Number);
                            setSelectedEndHour(hour);
                            setSelectedEndMinute(minute);
                            setActivityForm({ ...activityForm, endTime: time });
                          }}
                        >
                          {timeOptions.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>

                        {/* Data Fim */}
                        <Popover open={showEndDatePicker} onOpenChange={setShowEndDatePicker}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="h-9 px-3 py-1 text-sm font-normal border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#1b1b1b] min-w-[140px]"
                            >
                              {format(activityForm.endDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-white dark:bg-[#1b1b1b] border border-gray-200 dark:border-gray-700 shadow-md" align="start">
                            <Calendar
                              mode="single"
                              selected={activityForm.endDate}
                              onSelect={(date) => {
                                if (date) {
                                  setActivityForm({...activityForm, endDate: date});
                                  setShowEndDatePicker(false);
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Descrição da atividade..."
                        value={activityForm.description}
                        onChange={(e) => setActivityForm({...activityForm, description: e.target.value})}
                        className="min-h-[150px] bg-yellow-50 dark:bg-yellow-900/20 border-gray-300 dark:border-gray-600"
                      />
                    </div>

                    {/* Anexo (opcional) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Anexo (opcional)
                        </label>
                        {activityAttachmentFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setActivityAttachmentFile(null)}
                            disabled={isUploadingFile}
                          >
                            Remover
                          </Button>
                        )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-900/20 border border-dashed border-gray-200 dark:border-gray-700 p-4 rounded-none">
                        <input
                          type="file"
                          id="activity-file-upload"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setActivityAttachmentFile(f);
                            // permitir selecionar o mesmo arquivo novamente
                            if (e.target) e.target.value = '';
                          }}
                          disabled={isUploadingFile}
                        />
                        <label
                          htmlFor="activity-file-upload"
                          className={cn(
                            "flex items-center justify-between gap-3 cursor-pointer",
                            isUploadingFile && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                              <Upload className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {activityAttachmentFile ? activityAttachmentFile.name : (isUploadingFile ? "Enviando..." : "Clique para anexar um arquivo")}
                              </p>
                              {!activityAttachmentFile && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  PDF, DOC, XLS, PNG, JPG
                                </p>
                              )}
                            </div>
                          </div>
                          {/* removido: botão "Selecionar" (era redundante e ficava vazio) */}
                        </label>
                      </div>
                    </div>

                    {/* Responsável */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <Select
                        value={activityForm.responsibleId}
                        onValueChange={(value) => setActivityForm({...activityForm, responsibleId: value})}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Selecione o responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={activityForm.markAsDone}
                            onChange={(e) => setActivityForm({...activityForm, markAsDone: e.target.checked})}
                            className="rounded"
                          />
                          <label className="text-sm text-gray-700 dark:text-gray-300">Marcar como feito</label>
                        </div>
                        <Button variant="outline" onClick={() => {
                          const range = getBrasiliaRoundedTimeRange();
                          setActivityForm({
                            type: "Ligação abordada",
                            subject: "",
                            description: "",
                            availability: "livre",
                            startDate: range.startDate,
                            startTime: range.startTime,
                            endDate: range.endDate,
                            endTime: range.endTime,
                            // ✅ Não resetar responsável ao cancelar
                            responsibleId: activityForm.responsibleId,
                            location: "",
                            videoCall: false,
                            markAsDone: false
                          });
                          setSelectedStartHour(range.startHour);
                          setSelectedStartMinute(range.startMinute);
                          setSelectedEndHour(range.endHour);
                          setSelectedEndMinute(range.endMinute);
                          setActivityAttachmentFile(null);
                        }}>Cancelar</Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={handleSaveActivity}
                          disabled={isUploadingFile}
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Direita - Calendário */}
                  <div className="w-80 shrink-0 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full overflow-hidden">
                    {/* Header do Calendário */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {format(selectedCalendarDate, "EEEE, 'de' MMMM", { locale: ptBR })}
                        </h3>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(selectedCalendarDate, "dd", { locale: ptBR })}°
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            const prevDay = new Date(selectedCalendarDate);
                            prevDay.setDate(prevDay.getDate() - 1);
                            setSelectedCalendarDate(prevDay);
                          }}
                        >
                          <ChevronRight className="h-4 w-4 rotate-180" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            const nextDay = new Date(selectedCalendarDate);
                            nextDay.setDate(nextDay.getDate() + 1);
                            setSelectedCalendarDate(nextDay);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Timeline do Calendário */}
                    <div className="flex-1 overflow-y-auto relative" style={{ minHeight: '600px', maxHeight: '800px' }}>
                      <div className="relative" style={{ minHeight: '2400px' }}>
                        {/*
                          Horas e linhas - de 00:00 a 23:00
                          IMPORTANT: a timeline de atividades usa percent baseado em minutos do dia (24*60).
                          Para alinhar perfeitamente, as linhas de hora também precisam usar a mesma base
                          (e não hour/23, que desloca as linhas e faz blocos aparecerem "antes" da hora correta).
                        */}
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i;
                          const totalMinutesInDay = 24 * 60;
                          const hourPosition = ((hour * 60) / totalMinutesInDay) * 100;
                          
                          return (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 flex items-start"
                              style={{ top: `${hourPosition}%` }}
                            >
                              <div className="w-14 text-xs text-gray-400 dark:text-gray-500 mr-2 mt-0.5 font-normal">
                                {hour.toString().padStart(2, '0')}:00
                              </div>
                              <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
                            </div>
                          );
                        })}

                        {/* Linha do tempo atual (se for hoje) */}
                        {format(selectedCalendarDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && (() => {
                          const now = new Date();
                          const currentHour = now.getHours();
                          const currentMinute = now.getMinutes();
                          const currentTimeInMinutes = currentHour * 60 + currentMinute;
                          const totalMinutesInDay = 24 * 60;
                          const topPosition = (currentTimeInMinutes / totalMinutesInDay) * 100;
                          
                          return (
                            <div
                              className="absolute left-0 right-0 z-10 flex items-center"
                              style={{ top: `${topPosition}%` }}
                            >
                              <div className="flex items-center w-full">
                                <span className="w-14 text-xs font-medium text-red-600 dark:text-red-400 mr-2 whitespace-nowrap">
                                  {format(now, "HH:mm")}
                                </span>
                                <div className="flex-1 h-0.5 bg-red-600 dark:bg-red-400"></div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Container para posicionar atividades - altura total da timeline */}
                        <div className="absolute left-14 right-0" style={{ top: 0, bottom: 0 }}>

                        {/* Atividades do dia */}
                        {activities
                          .filter(activity => {
                            if (!activity.scheduled_for) return false;
                            try {
                              const activityDate = new Date(activity.scheduled_for);
                              const selectedDateStr = format(selectedCalendarDate, "yyyy-MM-dd");
                              const activityDateStr = format(activityDate, "yyyy-MM-dd");
                              return activityDateStr === selectedDateStr;
                            } catch (error) {
                              console.error('Erro ao processar data da atividade:', error, activity);
                              return false;
                            }
                          })
                          .map(activity => {
                            const activityDate = new Date(activity.scheduled_for);
                            const startHour = activityDate.getHours();
                            const startMinute = activityDate.getMinutes();
                            const startTimeInMinutes = startHour * 60 + startMinute;
                            const durationMinutes = activity.duration_minutes || 30;
                            const endTimeInMinutes = startTimeInMinutes + durationMinutes;
                            
                            // Timeline completa de 00:00 a 23:59
                            const totalMinutesInDay = 24 * 60;
                            
                            // Calcular posição e altura baseado no dia completo
                            const topPercent = (startTimeInMinutes / totalMinutesInDay) * 100;
                            const heightPercent = (durationMinutes / totalMinutesInDay) * 100;

                            // Cor baseada no tipo
                            const getActivityColor = () => {
                              if (activity.type?.toLowerCase().includes('almoço') || activity.subject?.toLowerCase().includes('almoço')) {
                                return 'bg-gray-200 dark:bg-gray-700';
                              }
                              return 'bg-blue-500 dark:bg-blue-600';
                            };

                            const getActivityTextColor = () => {
                              if (activity.type?.toLowerCase().includes('almoço') || activity.subject?.toLowerCase().includes('almoço')) {
                                return 'text-gray-800 dark:text-gray-200';
                              }
                              return 'text-white';
                            };

                            return (
                              <div
                                key={activity.id}
                                className={`absolute left-14 right-0 ${getActivityColor()} ${getActivityTextColor()} rounded px-2 py-1 text-xs shadow-sm z-20 cursor-pointer hover:opacity-90 transition-opacity`}
                                style={{
                                  top: `${topPercent}%`,
                                  height: `${Math.max(heightPercent, 1.5)}%`,
                                  minHeight: '32px'
                                }}
                              >
                                <div className="flex items-center gap-1 mb-0.5">
                                  <Phone className="h-3 w-3 flex-shrink-0" />
                                  <span className="font-medium truncate">{activity.subject || activity.type}</span>
                                </div>
                                {durationMinutes > 0 && (
                                  <div className="text-[10px] opacity-90">
                                    {format(activityDate, "HH:mm")} → {format(new Date(activityDate.getTime() + durationMinutes * 60000), "HH:mm")}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção de Histórico */}
                <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="space-y-4">
                    {/* Cabeçalho do Histórico */}
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Histórico</h3>
                    </div>
                        {/* Filtros */}
                        <div className="flex items-center gap-2 flex-wrap mb-6">
                          <Button
                            variant={historyFilter === "all" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("all")}
                            className={cn(
                              "text-xs h-8",
                              historyFilter === "all" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Todos
                          </Button>
                          <Button
                            variant={historyFilter === "notes" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("notes")}
                            className={cn(
                              "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800",
                              historyFilter === "notes" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Anotações ({historyEvents.filter(e => e.type === "notes").length})
                          </Button>
                          <Button
                            variant={historyFilter === "files" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("files")}
                            className={cn(
                              "text-xs h-8",
                              historyFilter === "files" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Arquivos ({filesCount})
                          </Button>
                          <Button
                            variant={historyFilter === "activities_done" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("activities_done")}
                            className={cn(
                              "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800",
                              historyFilter === "activities_done" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Atividades Realizadas ({getFilteredHistoryEvents(historyEvents, "activities_done").length})
                          </Button>
                          <Button
                            variant={historyFilter === "activities_future" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("activities_future")}
                            className={cn(
                              "text-xs h-8 hover:bg-gray-100 dark:hover:bg-gray-800",
                              historyFilter === "activities_future" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Atividades Futuras ({getFilteredHistoryEvents(historyEvents, "activities_future").length})
                          </Button>
                          <Button
                            variant={historyFilter === "changelog" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setHistoryFilter("changelog")}
                            className={cn(
                              "text-xs h-8",
                              historyFilter === "changelog" && "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-semibold hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                            )}
                          >
                            Registro de alterações ({historyEvents.filter(e => ["column_transfer", "pipeline_transfer", "tag", "user_assigned", "queue_transfer", "agent_activity", "qualification"].includes(e.type)).length})
                          </Button>
                        </div>

                        {/* Timeline / Arquivos */}
                        {isLoadingHistory ? (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            Carregando histórico...
                          </div>
                        ) : historyFilter === "files" ? (
                          <div className="space-y-3">
                            {activityAttachmentEvents.length === 0 ? (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                Nenhum arquivo encontrado
                              </div>
                            ) : (
                              activityAttachmentEvents.map((ev: any) => {
                                const eventDate = ev?.timestamp ? new Date(ev.timestamp) : new Date();
                                const userName = ev?.user_name || ev?.metadata?.changed_by_name || "Sistema";
                                const subject = ev?.metadata?.subject || ev?.metadata?.activity_subject || "Atividade";
                                const url = ev?.metadata?.attachment_url;
                                const name = ev?.metadata?.attachment_name;

                                return (
                                  <div
                                    key={ev.id}
                                    className="border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] rounded-none p-3"
                                  >
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                      {format(eventDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })} • {userName} • {contact?.name || "-"}
                                    </div>

                                    <div className="mt-2 flex items-center gap-2 text-xs">
                                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                                        {subject}
                                      </span>
                                    </div>

                                    {url ? (
                                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">Anexos</span>
                                        <button
                                          type="button"
                                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                          onClick={() =>
                                            setSelectedFileForPreview({
                                              url,
                                              name: name || "Anexo 1",
                                            })
                                          }
                                        >
                                          Anexo 1
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0">
                            {getFilteredHistoryEvents(historyEvents, historyFilter).map((event, index) => (
                              <HistoryTimelineItem
                                key={event.id}
                                event={event}
                                isLast={index === getFilteredHistoryEvents(historyEvents, historyFilter).length - 1}
                                contact={contact}
                                onEdit={handleHistoryEdit}
                                onDelete={handleHistoryDelete}
                                editingNoteId={editingNoteId}
                                editingNoteContent={editingNoteContent}
                                setEditingNoteContent={setEditingNoteContent}
                                onSaveNote={handleUpdateNote}
                                onCancelNote={cancelNoteEdit}
                                setSelectedFileForPreview={setSelectedFileForPreview}
                              />
                            ))}
                            {getFilteredHistoryEvents(historyEvents, historyFilter).length === 0 && (
                              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                Nenhum evento encontrado
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mensagens" className="mt-0">
                <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm rounded-none h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <MessageSquareIcon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mensagens</h3>
                    </div>
                    {contact?.name && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Contato: {contact.name}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {conversationId ? (
                      <WhatsAppChat
                        isDarkMode={false}
                        selectedConversationId={conversationId}
                        onlyMessages={true}
                        headerContact={{
                          id: contact?.id || null,
                          name: contact?.name || null,
                          phone: contact?.phone || null,
                          profile_image_url: (contact as any)?.profile_image_url || null,
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400 px-4 text-center">
                        Nenhuma conversa vinculada a este contato. Abra uma conversa na aba Conversas e volte aqui para visualizar.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
          </>
        </div>
      </div>
      
      {/* Modal de edição de atividade */}
      <Dialog open={isActivityEditModalOpen} onOpenChange={setIsActivityEditModalOpen}>
        <DialogContent
          className={cn(
            "max-w-6xl w-full h-[90vh] p-0 gap-0 flex flex-col",
            isUiDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white border-gray-200"
          )}
        >
          {/* Header no padrão do modal de Detalhes da Oportunidade (resumido) */}
          <DialogHeader
            className={cn(
              "mx-0 mt-0 px-6 py-4 border-b shrink-0 bg-primary text-primary-foreground",
              isUiDarkMode ? "border-gray-600" : "border-gray-200"
            )}
          >
            <div className="flex items-center gap-4 flex-1 pr-8">
              <Avatar className="w-12 h-12 border-2 border-white/20">
                <AvatarImage
                  src={(contact as any)?.profile_image_url}
                  alt={contact?.name || "Contato"}
                />
                <AvatarFallback className="bg-white/20 text-primary-foreground font-semibold text-lg">
                  {contact?.name ? String(contact.name).charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="flex flex-col min-w-0">
                  <DialogTitle className="text-xl font-bold text-left truncate text-primary-foreground">
                    {contact?.name || dealName || contact?.phone || "Sem nome"}
                  </DialogTitle>
                  <div className="flex items-center gap-2 text-primary-foreground/80">
                    <p className="text-sm text-left">{contact?.phone || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(contactTags || []).slice(0, 3).map((tag: any) => (
                    <Badge
                      key={tag.id || tag.name}
                      variant="outline"
                      className="border-white/40 bg-white/10 px-2 py-0.5 text-xs text-primary-foreground"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {(contactTags || []).length > 3 && (
                    <Badge
                      variant="outline"
                      className="border-white/40 bg-white/10 px-2 py-0.5 text-xs text-primary-foreground"
                    >
                      +{(contactTags || []).length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={activityEditModalTab}
            onValueChange={(v) => setActivityEditModalTab(v as any)}
            className="flex-1 min-h-0 flex flex-col"
          >
            <div
              className={cn(
                "px-6 py-3 border-b shrink-0",
                isUiDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-white"
              )}
            >
              <TabsList
                className={cn(
                  "rounded-none bg-transparent p-0 h-auto gap-2",
                  isUiDarkMode ? "text-gray-200" : "text-gray-900"
                )}
              >
                <TabsTrigger
                  value="detalhes"
                  className={cn(
                    "rounded-none px-4 py-2 text-sm font-semibold border",
                    isUiDarkMode
                      ? "border-gray-600 data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-white"
                      : "border-gray-200 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                  )}
                >
                  Detalhes da oportunidade
                </TabsTrigger>
                <TabsTrigger
                  value="atividade"
                  className={cn(
                    "rounded-none px-4 py-2 text-sm font-semibold border",
                    isUiDarkMode
                      ? "border-gray-600 data-[state=active]:bg-[#2a2a2a] data-[state=active]:text-white"
                      : "border-gray-200 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900"
                  )}
                >
                  Atividade (edição)
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Resumo: Detalhes da oportunidade */}
            <TabsContent value="detalhes" className="mt-0 flex-1 min-h-0 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={cn(
                    "border p-4 rounded-none",
                    isUiDarkMode ? "border-gray-600 bg-[#1f1f1f] text-gray-100" : "border-gray-200 bg-white text-gray-900"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Oportunidade</h3>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-none text-xs",
                        isUiDarkMode ? "border-gray-600 text-gray-200" : "border-gray-200 text-gray-700"
                      )}
                    >
                      {String(cardData?.status || "aberto")}
                    </Badge>
                  </div>
                  <p className={cn("mt-2 text-sm", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>
                    {dealName || cardData?.description || "-"}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className={cn("font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Pipeline</div>
                      <div className={cn("mt-0.5", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {pipelineData?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Etapa</div>
                      <div className={cn("mt-0.5", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {currentColumn?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Responsável</div>
                      <div className={cn("mt-0.5", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {owner?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Valor</div>
                      <div className={cn("mt-0.5", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {typeof cardData?.value === "number"
                          ? cardData.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : typeof cardData?.value === "string" && cardData.value
                            ? cardData.value
                            : "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "border p-4 rounded-none",
                    isUiDarkMode ? "border-gray-600 bg-[#1f1f1f] text-gray-100" : "border-gray-200 bg-white text-gray-900"
                  )}
                >
                  <h3 className="font-semibold">Contato</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("text-xs font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Nome</span>
                      <span className={cn("text-sm", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {contact?.name || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("text-xs font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Telefone</span>
                      <span className={cn("text-sm", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {contact?.phone || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className={cn("text-xs font-semibold", isUiDarkMode ? "text-gray-200" : "text-gray-700")}>Empresa</span>
                      <span className={cn("text-sm", isUiDarkMode ? "text-gray-100" : "text-gray-900")}>
                        {(contact as any)?.company || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba: Edição da atividade (mantém o formulário atual) */}
            <TabsContent value="atividade" className="mt-0 flex-1 min-h-0 overflow-hidden">
              <div className="flex flex-col h-full">
                <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                  {/* Assunto/Título */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Assunto</label>
                    <Input
                      placeholder={activityEditForm.type}
                      value={activityEditForm.subject}
                      onChange={(e) => setActivityEditForm({ ...activityEditForm, subject: e.target.value })}
                      className={cn(
                        "h-11 focus:border-blue-500",
                        isUiDarkMode
                          ? "bg-[#1a1a1a] border-gray-700 text-gray-100 placeholder:text-gray-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      )}
                    />
                  </div>

                  {/* Ícones de tipo */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Tipo de atividade</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: "Mensagem", type: "Mensagem", icon: MessageSquareIcon },
                        { label: "Ligação não atendida", type: "Ligação não atendida", icon: Phone },
                        { label: "Ligação atendida", type: "Ligação atendida", icon: Phone },
                        { label: "Ligação abordada", type: "Ligação abordada", icon: Phone },
                        { label: "Ligação agendada", type: "Ligação agendada", icon: Phone },
                        { label: "Ligação de follow up", type: "Ligação de follow up", icon: Phone },
                        { label: "Reunião agendada", type: "Reunião agendada", icon: CalendarIconLucide },
                        { label: "Reunião realizada", type: "Reunião realizada", icon: CalendarIconLucide },
                        { label: "Reunião não realizada", type: "Reunião não realizada", icon: CalendarIconLucide },
                        { label: "Reunião reagendada", type: "Reunião reagendada", icon: CalendarIconLucide },
                        { label: "WhatsApp enviado", type: "WhatsApp enviado", icon: MessageSquareIcon },
                        { label: "Proposta enviada", type: "Proposta enviada", icon: FileTextIcon },
                        { label: "Venda realizada", type: "Venda realizada", icon: DollarSign },
                      ].map((option) => {
                        const Icon = option.icon;
                        return (
                          <Tooltip key={option.type}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setActivityEditForm({ ...activityEditForm, type: option.type })}
                                className={cn(
                                  "p-2 rounded-md transition-colors",
                                  activityEditForm.type === option.type
                                    ? "bg-[#eab308] text-black"
                                    : isUiDarkMode
                                      ? "bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:bg-[#252525] hover:text-gray-100"
                                      : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              className={cn(
                                "shadow-md",
                                isUiDarkMode
                                  ? "bg-[#1b1b1b] border-gray-700 text-gray-100"
                                  : "bg-white border-gray-200 text-gray-900"
                              )}
                            >
                              <p>{option.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grid para Datas e Horas */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Data de início */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Data de início</label>
                      <Popover open={showEditStartDatePicker} onOpenChange={setShowEditStartDatePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11 rounded-md",
                              isUiDarkMode
                                ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                            )}
                          >
                            <CalendarIconLucide
                              className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")}
                            />
                            {format(activityEditForm.startDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className={cn(
                            "w-auto p-0",
                            isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200"
                          )}
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={activityEditForm.startDate}
                            onSelect={(date) => {
                              if (date) {
                                setActivityEditForm({ ...activityEditForm, startDate: date, endDate: date });
                                setShowEditStartDatePicker(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {/* Hora de início */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Hora de início</label>
                      <Popover open={showEditStartTimePicker} onOpenChange={setShowEditStartTimePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11 rounded-md",
                              isUiDarkMode
                                ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                            )}
                          >
                            <Clock className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")} />
                            {activityEditForm.startTime}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className={cn(
                            "w-32 p-0",
                            isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200"
                          )}
                          align="start"
                        >
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {timeOptions.map((time) => (
                                <button
                                  key={time}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-sm transition-colors",
                                    isUiDarkMode ? "text-gray-100 hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100",
                                    activityEditForm.startTime === time && "bg-primary text-primary-foreground font-semibold"
                                  )}
                                  onClick={() => {
                                    const [hour, minute] = time.split(":").map(Number);

                                    // Calcular hora fim (5 minutos depois)
                                    let endHour = hour;
                                    let endMinute = minute + 5;
                                    if (endMinute >= 60) {
                                      endMinute -= 60;
                                      endHour = (endHour + 1) % 24;
                                    }
                                    const endTime = `${endHour.toString().padStart(2, "0")}:${endMinute
                                      .toString()
                                      .padStart(2, "0")}`;

                                    setActivityEditForm({
                                      ...activityEditForm,
                                      startTime: time,
                                      endTime: endTime,
                                    });
                                    setShowEditStartTimePicker(false);
                                  }}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Data de fim */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Data de fim</label>
                      <Popover open={showEditEndDatePicker} onOpenChange={setShowEditEndDatePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11 rounded-md",
                              isUiDarkMode
                                ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                            )}
                          >
                            <CalendarIconLucide
                              className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")}
                            />
                            {format(activityEditForm.endDate, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className={cn(
                            "w-auto p-0",
                            isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200"
                          )}
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={activityEditForm.endDate}
                            onSelect={(date) => {
                              if (date) {
                                setActivityEditForm({ ...activityEditForm, endDate: date });
                                setShowEditEndDatePicker(false);
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {/* Hora de fim */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Hora de fim</label>
                      <Popover open={showEditEndTimePicker} onOpenChange={setShowEditEndTimePicker}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-11 rounded-md",
                              isUiDarkMode
                                ? "bg-[#1a1a1a] border-gray-700 text-gray-100 hover:bg-[#252525]"
                                : "bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
                            )}
                          >
                            <Clock className={cn("mr-3 h-4 w-4", isUiDarkMode ? "text-gray-400" : "text-gray-500")} />
                            {activityEditForm.endTime}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className={cn(
                            "w-32 p-0",
                            isUiDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-gray-200"
                          )}
                          align="start"
                        >
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {timeOptions.map((time) => (
                                <button
                                  key={time}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-sm transition-colors",
                                    isUiDarkMode ? "text-gray-100 hover:bg-gray-800" : "text-gray-900 hover:bg-gray-100",
                                    activityEditForm.endTime === time && "bg-primary text-primary-foreground font-semibold"
                                  )}
                                  onClick={() => {
                                    setActivityEditForm({ ...activityEditForm, endTime: time });
                                    setShowEditEndTimePicker(false);
                                  }}
                                >
                                  {time}
                                </button>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Responsável */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Responsável</label>
                      <Select
                        value={activityEditForm.responsibleId}
                        onValueChange={(v) => setActivityEditForm({ ...activityEditForm, responsibleId: v })}
                      >
                        <SelectTrigger
                          className={cn(
                            "h-11",
                            isUiDarkMode
                              ? "bg-[#1a1a1a] border-gray-700 text-gray-100"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        >
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent
                          className={cn(
                            isUiDarkMode
                              ? "bg-[#1b1b1b] border-gray-700 text-gray-100"
                              : "bg-white border-gray-200 text-gray-900"
                          )}
                        >
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">Descrição</label>
                    <Textarea
                      placeholder="Adicione detalhes sobre a atividade..."
                      value={activityEditForm.description}
                      onChange={(e) => setActivityEditForm({ ...activityEditForm, description: e.target.value })}
                      className={cn(
                        "min-h-[120px] focus:border-blue-500",
                        isUiDarkMode
                          ? "bg-[#1a1a1a] border-gray-700 text-gray-100 placeholder:text-gray-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      )}
                    />
                  </div>

                  {/* Checkbox de conclusão */}
                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox
                      id="activity-edit-done"
                      checked={activityEditForm.markAsDone}
                      onCheckedChange={(checked) =>
                        setActivityEditForm({ ...activityEditForm, markAsDone: checked === true })
                      }
                      className={cn(
                        isUiDarkMode ? "border-gray-700" : "border-gray-300",
                        "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      )}
                    />
                    <label
                      htmlFor="activity-edit-done"
                      className={cn(
                        "text-sm font-medium cursor-pointer",
                        isUiDarkMode ? "text-gray-200" : "text-gray-900"
                      )}
                    >
                      Marcar como concluída
                    </label>
                  </div>
                </div>

                <DialogFooter
                  className={cn(
                    "mt-0 mx-0 mb-0 border-t flex items-center justify-end gap-4 shrink-0 px-6 py-4",
                    isUiDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-white"
                  )}
                >
                  <Button
                    variant="outline"
                    onClick={() => setIsActivityEditModalOpen(false)}
                    className={cn(
                      "h-10 rounded-none",
                      isUiDarkMode
                        ? "border-gray-600 text-gray-200 hover:bg-[#252525] hover:text-white"
                        : "border-gray-300 text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDeleteActivity}
                    className="text-red-200 hover:text-red-100 hover:bg-red-500/20 h-10 px-2 flex items-center gap-2 rounded-none"
                  >
                    <X className="h-4 w-4" />
                    Excluir
                  </Button>
                  <Button
                    onClick={handleUpdateActivity}
                    className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold h-10 px-8 rounded-none"
                  >
                    Salvar Alterações
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal de Produtos */}
      <Dialog open={isProductModalOpen} onOpenChange={(open) => {
        setIsProductModalOpen(open);
        if (!open) {
          setSelectedProductId("");
          setManualValue("");
          setProductQuantity(1);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="bg-gray-100 text-gray-900 px-4 py-3 border-b border-gray-200 dark:bg-[#1a1a1a] dark:text-gray-100 dark:border-gray-700">
            <DialogTitle>Adicionar produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
              <Select value={selectedProductId} onValueChange={(v) => {
                setSelectedProductId(v);
                // Preencher o preço automaticamente ao selecionar um produto
                const product = availableProducts.find(p => p.id === v);
                if (product && product.value) {
                  const qty = productQuantity || 1;
                  setManualValue((product.value * qty).toFixed(2).replace('.', ','));
                } else {
                  setManualValue("");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.value || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade</label>
              <Input
                type="number"
                min="1"
                value={productQuantity}
                onChange={(e) => {
                  const qty = Math.max(1, parseInt(e.target.value) || 1);
                  setProductQuantity(qty);
                  // Recalcular o preço total se tiver produto selecionado
                  if (selectedProductId) {
                    const product = availableProducts.find(p => p.id === selectedProductId);
                    if (product && product.value) {
                      setManualValue((product.value * qty).toFixed(2).replace('.', ','));
                    }
                  }
                }}
                className="dark:bg-[#1a1a1a] dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preço Total</label>
              <Input
                type="text"
                placeholder="R$ 0,00"
                value={manualValue}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,]/g, '').replace(',', '.');
                  setManualValue(value);
                  setSelectedProductId(""); // Limpar produto quando digita valor manual
                }}
                onBlur={(e) => {
                  const value = e.target.value.replace(',', '.');
                  if (value && !isNaN(parseFloat(value))) {
                    setManualValue(parseFloat(value).toFixed(2).replace('.', ','));
                  }
                }}
                className="dark:bg-[#1a1a1a] dark:border-gray-700 dark:text-gray-100"
              />
              {selectedProductId && productQuantity > 1 && (
                <p className="text-xs text-muted-foreground">
                  {productQuantity}x unidades
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-0 mx-0 mb-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] px-6 py-4">
            <Button variant="outline" onClick={() => {
              setIsProductModalOpen(false);
              setSelectedProductId("");
              setManualValue("");
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddProductToCard} 
              disabled={!selectedProductId && !manualValue}
              className="bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkAsLostModal
        open={isMarkAsLostModalOpen}
        onOpenChange={(open) => {
          setIsMarkAsLostModalOpen(open);
          if (!open) {
            setConfirmLossAction(null);
          }
        }}
        onConfirm={handleMarkAsLost}
        workspaceId={cardData?.workspace_id || effectiveWorkspaceId || selectedWorkspace?.workspace_id || ""}
        isLoading={isMarkingAsLost}
      />

      <DealStatusMoveModal
        open={dealStatusMoveOpen}
        onOpenChange={setDealStatusMoveOpen}
        mode={dealStatusMoveMode}
        workspaceId={cardData?.workspace_id || effectiveWorkspaceId || selectedWorkspace?.workspace_id || ""}
        pipelines={(availablePipelines || []).map((p: any) => ({ id: p.id, name: p.name }))}
        defaultPipelineId={cardData?.pipeline_id || ""}
        defaultColumnId={cardData?.column_id || ""}
        isLoading={isDealStatusMoveLoading}
        onConfirm={handleDealStatusMoveConfirm}
      />

      <AttachmentPreviewModal
        isOpen={Boolean(selectedFileForPreview)}
        onClose={() => setSelectedFileForPreview(null)}
        attachment={selectedFileForPreview}
      />

      {/* Editor sofisticado: detalhes do contato (campos obrigatórios + customizáveis) */}
      <Dialog open={isDetailsEditorOpen} onOpenChange={setIsDetailsEditorOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-800">
          <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f]">
            <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white">
              Detalhes do contato
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Campos obrigatórios
              </div>
              <div className="space-y-3">
                {(workspaceContactFields || [])
                  .filter((f: any) => f?.is_required && f?.field_name)
                  .sort((a: any, b: any) => (a.field_order ?? 0) - (b.field_order ?? 0))
                  .map((f: any) => {
                    const name = String(f.field_name || "").trim();
                    return (
                      <div key={name} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-4">
                          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={name}>
                            {humanizeLabel(name)}
                          </div>
                        </div>
                        <div className="md:col-span-8">
                          <Input
                            value={detailsDraft[name] ?? "0"}
                            onChange={(e) =>
                              setDetailsDraft((prev) => ({
                                ...prev,
                                [name]: e.target.value === "" ? "0" : e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="h-9 rounded-none text-sm border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Campos personalizados
                </div>
              </div>

              {customDetailKeys.length > 0 ? (
                <div className="space-y-3">
                  {customDetailKeys.map((name) => (
                    <div key={name} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <div className="md:col-span-4">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={name}>
                          {humanizeLabel(name)}
                        </div>
                      </div>
                      <div className="md:col-span-7">
                        <Input
                          value={detailsDraft[name] ?? "0"}
                          onChange={(e) =>
                            setDetailsDraft((prev) => ({
                              ...prev,
                              [name]: e.target.value === "" ? "0" : e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="h-9 rounded-none text-sm border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-none"
                          title="Remover campo"
                          onClick={() => removeCustomDetailField(name)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhum campo personalizado.
                </div>
              )}

              <div className="mt-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-none p-3 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Adicionar campo
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={newDetailFieldName}
                    onChange={(e) => setNewDetailFieldName(e.target.value)}
                    placeholder="Nome do campo"
                    className="h-9 rounded-none text-sm border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
                  />
                  <Input
                    value={newDetailFieldValue}
                    onChange={(e) => setNewDetailFieldValue(e.target.value)}
                    placeholder="Valor"
                    className="h-9 rounded-none text-sm border-gray-300 dark:border-gray-700 dark:bg-[#111111] dark:text-gray-100"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-none text-xs border-gray-300 dark:border-gray-700"
                    onClick={handleAddCustomDetailField}
                    disabled={!newDetailFieldName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f0f0f] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-none border-gray-300 dark:border-gray-700"
              onClick={() => setIsDetailsEditorOpen(false)}
              disabled={isSavingDetails}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-9 rounded-none"
              onClick={handleSaveDetailsEditor}
              disabled={isSavingDetails}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Função auxiliar para obter ícone (precisa estar fora do componente)
function getEventIcon(eventType: string, action?: string) {
  if (eventType?.startsWith("activity_")) {
    if (action === "completed") return CheckCircle;
    if (eventType === "activity_ligacao") return Phone;
    if (eventType === "activity_reuniao") return Video;
    if (eventType === "activity_mensagem") return MessageSquareIcon;
    if (eventType === "activity_lembrete") return Clock;
    return Lock;
  }
  if (eventType === "column_transfer" || eventType === "pipeline_transfer") return ChevronRight;
  if (eventType === "tag") return FileTextIcon;
  if (eventType === "user_assigned" || eventType === "queue_transfer") return User;
  if (eventType === "agent_activity") return Lock;
  return Info;
}

// Componente para item da timeline do histórico
function HistoryTimelineItem({ 
  event, 
  isLast, 
  contact,
  onEdit,
  onDelete,
  editingNoteId,
  editingNoteContent,
  setEditingNoteContent,
  onSaveNote,
  onCancelNote,
  setSelectedFileForPreview
}: { 
  event: any; 
  isLast: boolean; 
  contact: any;
  onEdit: (event: any) => void;
  onDelete: (event: any) => void;
  editingNoteId: string | null;
  editingNoteContent: string;
  setEditingNoteContent: (value: string) => void;
  onSaveNote: () => void;
  onCancelNote: () => void;
  setSelectedFileForPreview: (file: any) => void;
}) {
  // ✅ local helper (HistoryTimelineItem fica fora do DealDetailsPage e não enxerga helpers internos)
  const formatPhone = (raw?: string | null) => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
    if (withoutCountry.length === 10) {
      return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 6)}-${withoutCountry.slice(6)}`;
    }
    if (withoutCountry.length >= 11) {
      return `(${withoutCountry.slice(0, 2)}) ${withoutCountry.slice(2, 7)}-${withoutCountry.slice(7, 11)}`;
    }
    return withoutCountry;
  };

  const parseDateSafe = (value: any): Date | null => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const EventIcon = getEventIcon(event.type, event.action);
  const isActivity = event.type?.startsWith("activity_");
  const isCompleted = event.action === "completed";
  const eventDate = event.timestamp ? new Date(event.timestamp) : new Date();
  const scheduledForDate = parseDateSafe(event?.metadata?.scheduled_for);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const isNote = event.type === "notes";
  const isEditingNote = isNote && editingNoteId === event.metadata?.note_id;
  const cleanNoteText = (text?: string) =>
    (text || "")
      .replace(/^Anotação adicionada:\s*/i, "")
      .replace(/^Anotação adicionada\s*/i, "")
      .trim();
  const descriptionHtml = event.metadata?.description;
  const hasDescription = Boolean(descriptionHtml);
  const descPlainText = cleanNoteText(String(descriptionHtml || "")).replace(/<[^>]*>/g, "").trim();
  const descIsLong = descPlainText.length > 220 || descPlainText.includes("\n");
  // ✅ Priorizar `content` (texto completo). `description` pode ser resumo legado.
  const noteBodyHtmlRaw = (event.metadata?.content || event.metadata?.description || event.description || "") as any;
  const notePlainText = cleanNoteText(String(noteBodyHtmlRaw)).replace(/<[^>]*>/g, "").trim();
  const noteIsLong = notePlainText.length > 220 || notePlainText.includes("\n");
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const activityAttachments = (() => {
    const md = event?.metadata || {};
    const list = Array.isArray(md.attachments) ? md.attachments : null;
    if (list && list.length > 0) {
      return list
        .map((a: any) => ({
          url: a?.url,
          name: a?.name,
        }))
        .filter((a: any) => typeof a.url === 'string' && a.url.length > 0);
    }
    if (md.attachment_url) {
      return [
        {
          url: md.attachment_url,
          name: md.attachment_name,
        },
      ];
    }
    return [];
  })();
  
  return (
    <div className="flex gap-4 relative">
      {/* Linha vertical e ícone */}
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center border-2",
          isActivity && isCompleted 
            ? "bg-green-100 dark:bg-green-900 border-green-500 dark:border-green-600 text-green-600 dark:text-green-400"
            : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
        )}>
          <EventIcon className="h-4 w-4" />
        </div>
        {!isLast && (
          <div className="w-0.5 h-full min-h-[60px] bg-gray-200 dark:bg-gray-700 mt-2" />
        )}
      </div>

      {/* Conteúdo do evento */}
      <div className="flex-1 pb-6">
        <div
          className={cn(
            "border rounded-md p-4",
            isNote
              ? "bg-amber-50 border-amber-100 text-gray-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-200"
              : "bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700"
          )}
        >
          {/* Cabeçalho */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              {isNote ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      Anotação
                    </span>
                    {event.metadata?.subject && (
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {event.metadata.subject}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>{format(eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
                    {event.user_name && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">{event.user_name}</span>
          </>
          )}
        </div>
                </div>
              ) : isActivity ? (
                <div className="space-y-2">
                  {/* Linha superior: tipo + assunto */}
                <div className="flex items-center gap-2">
                    {event.metadata?.activity_type && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {event.metadata.activity_type}
                      </span>
                    )}
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {event.metadata?.subject || event.description}
                  </span>
                  </div>
                  {/* Info da atividade: data, responsável e contato */}
                  {!isNote && (
                    <div className={cn(
                      "flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap mt-1",
                      activityAttachments.length > 0 ? "mb-3" : "mb-2"
                    )}>
                      <span>
                        {isCompleted ? "Concluído em: " : "Criado em: "}
                        {format(eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {scheduledForDate && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <CalendarIconLucide className="h-3 w-3" />
                            <span>
                              Agendado para:{" "}
                              {format(scheduledForDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </>
                      )}
                      {event.user_name && (
                        <>
                          <span>•</span>
                          <span>{event.user_name}</span>
                        </>
                      )}
                      {contact && isActivity && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{contact.name || formatPhone(contact.phone)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Anexos (visual): Anexo 1, Anexo 2, ... */}
                  {activityAttachments.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                      <span className="font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        Anexos
                      </span>
                      {activityAttachments.map((att: any, idx: number) => (
                        <button
                          key={`${att.url}-${idx}`}
                          type="button"
                          className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
                          onClick={() => {
                            const name = att?.name || `Anexo ${idx + 1}`;
                            const ext = String(att?.name || '').split('.').pop()?.toLowerCase();
                            setSelectedFileForPreview({
                              url: att.url,
                              name,
                              type: ext
                            });
                          }}
                        >
                          {`Anexo ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Descrição abaixo com estilo colado e cor diferenciada */}
                  {hasDescription && (
                    <div className="-mx-4 -mb-4 border-t border-amber-100 dark:border-amber-900/30 p-3 bg-[#fffde7] dark:bg-amber-950/20">
                      <div className="relative">
                        <div
                          className={cn(
                            "text-xs text-gray-900 dark:text-white font-sans whitespace-pre-wrap",
                            descIsLong && !isDescExpanded && "max-h-[40px] overflow-hidden pr-16"
                          )}
                        >
                          {descPlainText}
                        </div>
                        {descIsLong && (
                          <button
                            type="button"
                            className="absolute right-2 bottom-2 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-200 transition-colors text-[10px] font-semibold"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDescExpanded((v) => !v);
                            }}
                          >
                            {isDescExpanded ? "Ver menos" : "Ver mais"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {event.metadata?.event_title || 'Registro de Alteração'}
                  </div>
                  <div className="space-y-1">
                    {/* Resumo (sempre) */}
                    <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans">
                      {event.description || event.metadata?.description || ''}
                    </pre>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                      {format(eventDate, "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Observações/descrição no mesmo bloco inferior usado pelas atividades */}
                  {hasDescription && (
                    <div className="-mx-4 -mb-4 border-t border-amber-100 dark:border-amber-900/30 mt-3 p-3 bg-[#fffde7] dark:bg-amber-950/20">
                      <div className="relative">
                        <div
                          className={cn(
                            "text-xs text-gray-900 dark:text-white font-sans whitespace-pre-wrap",
                            descIsLong && !isDescExpanded && "max-h-[40px] overflow-hidden pr-16"
                          )}
                        >
                          {descPlainText}
                        </div>
                        {descIsLong && (
                          <button
                            type="button"
                            className="absolute right-2 bottom-2 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-200 transition-colors text-[10px] font-semibold"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDescExpanded((v) => !v);
                            }}
                          >
                            {isDescExpanded ? "Ver menos" : "Ver mais"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Popover open={isActionsOpen} onOpenChange={setIsActionsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1 bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-md" align="end" side="bottom" sideOffset={4}>
                <div className="space-y-1">
                  {(isNote || isActivity) && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8"
                    onClick={() => {
                      setIsActionsOpen(false);
                      onEdit(event);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setIsActionsOpen(false);
                      onDelete(event);
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Conteúdo */}
          {isNote && (
            <div className="mt-2">
              {!isEditingNote && (
                <div className="relative">
                  <div
                    className={cn(
                      "text-sm leading-relaxed break-words text-gray-900 dark:text-white whitespace-pre-wrap font-sans",
                      noteIsLong && !isNoteExpanded && "max-h-[48px] overflow-hidden pr-16"
                    )}
                  >
                    {notePlainText}
                  </div>
                  {noteIsLong && (
                    <button
                      type="button"
                      className="absolute right-2 bottom-2 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/90 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-900 dark:text-amber-200 transition-colors text-[10px] font-semibold"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsNoteExpanded((v) => !v);
                      }}
                    >
                      {isNoteExpanded ? "Ver menos" : "Ver mais"}
                    </button>
                  )}
                </div>
              )}
              {isEditingNote && (
                <div className="space-y-2">
                  <textarea
                    className="w-full min-h-[140px] rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-gray-300 dark:bg-[#2d2d2d] dark:border-gray-700 dark:text-white dark:focus:ring-gray-600"
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={onCancelNote}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={onSaveNote} disabled={!editingNoteContent.trim()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
                  </div>
      </div>
    </div>
  );
}
