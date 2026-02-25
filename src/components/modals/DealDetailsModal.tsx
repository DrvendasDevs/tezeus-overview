import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, MessageSquare, User, Phone, Plus, Check, X, Clock, Upload, CalendarIcon, Mail, FileText, Info, FileSpreadsheet, File as FileIcon, MessageCircle, ChevronRight, DollarSign } from "lucide-react";
import { ChatModal } from "./ChatModal";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTagModal } from "./AddTagModal";
import { AddContactTagButton } from "@/components/chat/AddContactTagButton";
import { CreateActivityModal } from "./CreateActivityModal";
import { TimePickerModal } from "./TimePickerModal";
import { MinutePickerModal } from "./MinutePickerModal";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import { MarkAsLostModal } from "./MarkAsLostModal";
import { DealStatusMoveModal } from "@/components/modals/DealStatusMoveModal";
import { PipelineTimeline } from "@/components/crm/PipelineTimeline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { useUsersCache } from "@/hooks/useUsersCache";
import { useContactExtraInfo } from "@/hooks/useContactExtraInfo";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { cardHistoryQueryKey, useCardHistory } from "@/hooks/useCardHistory";
import { Bot, UserCheck, Users, ArrowRightLeft, LayoutGrid, Tag as TagIcon, CalendarClock, Calendar as CalendarIconLucide } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logCreate, logUpdate, logDelete } from "@/utils/auditLog";
interface Tag {
  id: string;
  name: string;
  color: string;
}
interface Activity {
  id: string;
  type: string;
  subject: string;
  description?: string | null;
  scheduled_for: string;
  completed_at?: string | null;
  responsible_id: string;
  is_completed: boolean;
  attachment_url?: string | null;
  attachment_name?: string | null;
  pipeline_card_id?: string | null;
  contact_id?: string;
  workspace_id?: string;
  users?: {
    name: string;
  };
}

interface CardHistoryEvent {
  id: string;
  action: string;
  changed_by: string | null;
  changed_at: string;
  metadata: any;
  users?: {
    name: string;
  };
}
type DealDetailsTabId = "negocios" | "atividades" | "historico" | "historico-atividades" | "contato";

interface DealDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealName: string;
  contactNumber: string;
  isDarkMode?: boolean;
  // Dados obrigatórios do card clicado para referência confiável
  cardId: string;
  currentColumnId: string;
  currentPipelineId: string;
  // Dados do contato já disponíveis no card
  contactData?: {
    id: string;
    name: string;
    phone?: string;
    profile_image_url?: string;
  };
  defaultTab?: DealDetailsTabId;
}
interface PipelineStep {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
  isCompleted: boolean;
}

const getReadableActionTextColor = (hexColor?: string) => {
  if (!hexColor) return '#111827';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) {
    return '#FFFFFF';
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#111827' : '#FFFFFF';
};

// Componente separado para cada atividade pendente (evita hooks dentro de .map)
function ActivityItem({
  activity,
  isDarkMode,
  contactId,
  onComplete,
  onUpdate,
  onAttachmentClick,
  onDelete
}: {
  activity: Activity;
  isDarkMode: boolean;
  contactId: string;
  onComplete: (id: string) => void;
  onUpdate: (contactId: string) => void;
  onAttachmentClick: (attachment: { url: string; name: string; type?: string }) => void;
  onDelete: (activity: Activity) => void;
}) {
  const [isEditingActivity, setIsEditingActivity] = useState(false);
  const [editActivityForm, setEditActivityForm] = useState({
    subject: activity.subject,
    description: activity.description || "",
    scheduled_for: activity.scheduled_for
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(activity.scheduled_for));
  const [selectedTime, setSelectedTime] = useState(() => {
    const date = new Date(activity.scheduled_for);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  });
  const [selectedHour, setSelectedHour] = useState<number>(new Date(activity.scheduled_for).getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(new Date(activity.scheduled_for).getMinutes());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const { toast } = useToast();

  // Atualizar o formulário quando a atividade mudar (garante que description apareça corretamente)
  useEffect(() => {
    const scheduledDate = new Date(activity.scheduled_for);
    setEditActivityForm({
      subject: activity.subject,
      description: activity.description || "",
      scheduled_for: activity.scheduled_for
    });
    setSelectedDate(scheduledDate);
    setSelectedTime(`${scheduledDate.getHours().toString().padStart(2, '0')}:${scheduledDate.getMinutes().toString().padStart(2, '0')}`);
    setSelectedHour(scheduledDate.getHours());
    setSelectedMinute(scheduledDate.getMinutes());
  }, [activity.id, activity.subject, activity.description, activity.scheduled_for]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowTimePicker(true);
      return;
    }
    if (!date && selectedDate) {
      setShowTimePicker(true);
    }
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    setShowTimePicker(false);
    setShowMinutePicker(true);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    setShowMinutePicker(false);
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    setSelectedTime(timeString);
  };

  const handleDateTimeClick = () => {
    // Este clique não faz nada, o calendário já abre automaticamente pelo Popover
  };

  const handleSaveActivity = async () => {
    try {
      // Combinar data e hora selecionadas
      const [hour, minute] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hour, minute, 0, 0);

      const { error } = await supabase
        .from('activities')
        .update({
          subject: editActivityForm.subject.trim() || activity.type,
          description: editActivityForm.description,
          scheduled_for: scheduledDateTime.toISOString()
        })
        .eq('id', activity.id);

      if (error) throw error;

      toast({
        title: "Atividade atualizada",
        description: "As alterações foram salvas com sucesso."
      });

      setIsEditingActivity(false);
      onUpdate(contactId);
    } catch (error: any) {
      console.error('Erro ao atualizar atividade:', error);

      const code = error?.code || error?.cause?.code;
      const isOverlap =
        code === "23P01" ||
        String(error?.message || "").toLowerCase().includes("conflito de agenda");

      toast({
        title: "Erro",
        description: isOverlap
          ? "Conflito de agenda: já existe uma atividade para este responsável nesse período."
          : "Não foi possível atualizar a atividade.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className={cn("border border-[#d4d4d4] border-l-4 rounded-none p-3", isDarkMode ? "border-l-yellow-500 bg-[#1f1f1f]" : "border-l-yellow-500 bg-white shadow-sm")}>
      {isEditingActivity ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Assunto
            </label>
            <Input
              placeholder={activity.type}
              value={editActivityForm.subject}
              onChange={(e) => setEditActivityForm({...editActivityForm, subject: e.target.value})}
              className={cn("h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "")}
            />
          </div>
          <div className="space-y-2">
            <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Descrição
            </label>
            <Textarea
              value={editActivityForm.description}
              onChange={(e) => setEditActivityForm({...editActivityForm, description: e.target.value})}
              className={cn("text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "")}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
              Data e Hora
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={cn("w-full justify-start text-left font-normal h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white hover:bg-gray-700" : "bg-white")}
                  onClick={handleDateTimeClick}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {selectedDate && selectedTime ? 
                    `${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} ${selectedTime}` : 
                    "Selecionar data e hora"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className={cn("w-auto p-0 rounded-none border-gray-300", isDarkMode && "border-gray-600 bg-[#1b1b1b]")}
                align="start"
              >
                <Calendar 
                  mode="single" 
                  selected={selectedDate} 
                  onSelect={handleDateSelect} 
                  initialFocus 
                  className="pointer-events-auto rounded-none" 
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditingActivity(false)}
              className="h-8 text-xs rounded-none"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveActivity}
              className="h-8 text-xs rounded-none bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-4">
            {/* Conteúdo principal à esquerda */}
            <div className="flex-1 space-y-1">
              <h4 className={cn("font-bold text-sm", isDarkMode ? "text-white" : "text-gray-900")}>
                {activity.subject}
              </h4>
              <p className={cn("text-[10px]", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                {format(new Date(activity.scheduled_for), "dd/MM/yyyy HH:mm", {
                  locale: ptBR
                })}
              </p>
              <p className={cn("text-xs whitespace-pre-wrap", isDarkMode ? "text-gray-300" : "text-gray-600")}>
                {activity.description || "Sem descrição"}
              </p>
            </div>
            
            {/* Imagem à direita */}
            {activity.attachment_url && (
              <AttachmentPreview
                activity={activity}
                isDarkMode={isDarkMode}
                onPreview={onAttachmentClick}
              />
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm"
              onClick={() => onComplete(activity.id)}
              className="h-8 text-xs rounded-none bg-yellow-500 hover:bg-yellow-600 text-white flex-1"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Concluir
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsEditingActivity(true)}
              className="h-8 w-8 p-0 rounded-none border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="h-8 w-8 p-0 rounded-none border-red-500 text-red-600 hover:bg-red-50"
              onClick={() => onDelete(activity)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      )}
      <TimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onTimeSelect={handleHourSelect}
        selectedHour={selectedHour}
        isDarkMode={isDarkMode}
      />
      <MinutePickerModal
        isOpen={showMinutePicker}
        onClose={() => setShowMinutePicker(false)}
        onMinuteSelect={handleMinuteSelect}
        selectedMinute={selectedMinute}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

function AttachmentPreview({
  activity,
  isDarkMode,
  onPreview,
}: {
  activity: Activity;
  isDarkMode: boolean;
  onPreview: (attachment: { url: string; name: string; type?: string }) => void;
}) {
  const attachmentUrl = activity.attachment_url!;
  const attachmentName = activity.attachment_name || "Anexo";

  const resolveExtension = () => {
    const source = activity.attachment_name || activity.attachment_url || "";
    const sanitized = source.split("?")[0].split("#")[0];
    const parts = sanitized.split(".");
    if (parts.length <= 1) return "";
    return parts.pop()?.toLowerCase() || "";
  };

  const extension = resolveExtension();
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  const sheetExtensions = ["xls", "xlsx", "csv"];

  const isImage =
    (extension && imageExtensions.includes(extension)) ||
    attachmentUrl.startsWith("data:image");
  const isPdf = extension === "pdf";
  const isSheet = extension ? sheetExtensions.includes(extension) : false;

  const attachmentType = isImage
    ? "image"
    : isPdf
    ? "pdf"
    : isSheet
    ? extension
    : extension || "file";

  if (isImage) {
    return (
      <div className="flex-shrink-0">
        <img
          src={attachmentUrl}
          alt={attachmentName}
          className="w-32 h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-border"
          onClick={() =>
            onPreview({
              url: attachmentUrl,
              name: attachmentName,
              type: attachmentType,
            })
          }
        />
      </div>
    );
  }

  const Icon = isPdf ? FileText : isSheet ? FileSpreadsheet : FileIcon;

  return (
    <div className="flex-shrink-0">
      <button
        type="button"
        onClick={() =>
          onPreview({
            url: attachmentUrl,
            name: attachmentName,
            type: attachmentType,
          })
        }
        className={cn(
          "w-32 h-32 border border-dashed rounded-lg flex flex-col items-center justify-center gap-3 text-center px-3 transition-all",
          "hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/50",
          isDarkMode && "border-gray-600 hover:border-yellow-500 hover:bg-yellow-500/10"
        )}
      >
        <Icon className="w-8 h-8 text-primary" />
        <span className="text-xs font-medium text-foreground truncate w-full">
          {attachmentName}
        </span>
        <span className="text-[11px] text-muted-foreground">Clique para visualizar</span>
      </button>
    </div>
  );
}

export function DealDetailsModal({
  isOpen,
  onClose,
  dealName,
  contactNumber,
  isDarkMode: propIsDarkMode,
  cardId,
  currentColumnId,
  currentPipelineId,
  contactData: initialContactData,
  defaultTab = "negocios"
}: DealDetailsModalProps) {
  
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    checkTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  const [activeTab, setActiveTab] = useState<DealDetailsTabId>(defaultTab);
  const [contactId, setContactId] = useState<string>(initialContactData?.id || "");
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [contactTags, setContactTags] = useState<Tag[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contactObservations, setContactObservations] = useState<any[]>([]);
  // Estado cardHistory removido - agora usamos fullHistory do useCardHistory
  // Estados removidos - agora usamos apenas useCardHistory que já busca tudo
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [showCreateActivityModal, setShowCreateActivityModal] = useState(false);
  const [confirmLossAction, setConfirmLossAction] = useState<any>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [isMarkAsLostModalOpen, setIsMarkAsLostModalOpen] = useState(false);
  const [isMarkingAsLost, setIsMarkingAsLost] = useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>("");
  
  // Estados para o formulário de atividade integrado
  const [activityForm, setActivityForm] = useState({
    type: "Lembrete",
    responsibleId: "",
    subject: "",
    description: "",
    durationMinutes: 30,
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("13:00");
  const [selectedHour, setSelectedHour] = useState<number>(13);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMinutePicker, setShowMinutePicker] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());
  const [selectedAttachment, setSelectedAttachment] = useState<{ url: string; name: string; type?: string } | null>(null);
  const renderFileBadge = (fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    const label = (ext || 'file').slice(0, 4).toUpperCase();
    return (
      <div
        className={cn(
          "w-10 h-10 rounded-md border flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide",
          isDarkMode
            ? "border-gray-700 bg-[#1f1f1f] text-gray-200"
            : "border-gray-200 bg-gray-100 text-gray-700"
        )}
      >
        {label}
      </div>
    );
  };
  const [currentSystemUser, setCurrentSystemUser] = useState<{ id: string | null; name: string } | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isDeletingActivity, setIsDeletingActivity] = useState(false);
  
  // Hook otimizado para usuários com cache - filtrado por workspace e sem masters
  const { users, isLoading: isLoadingUsers, loadUsers } = useUsersCache(workspaceId, ['user', 'admin']);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>([]);
  const [contactPipelines, setContactPipelines] = useState<any[]>([]);
  const [pipelineCardsCount, setPipelineCardsCount] = useState(0);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(currentPipelineId);
  const [selectedCardId, setSelectedCardId] = useState<string>(cardId);
  const [selectedColumnId, setSelectedColumnId] = useState<string>(currentColumnId);
  const [cardStatus, setCardStatus] = useState<'aberto' | 'ganho' | 'perda'>('aberto');
  const [cardQualification, setCardQualification] = useState<'unqualified' | 'qualified' | 'disqualified'>('unqualified');
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [cardTimeline, setCardTimeline] = useState<any[]>([]);
  const [pipelineActions, setPipelineActions] = useState<any[]>([]);
  const [availablePipelines, setAvailablePipelines] = useState<Array<{ id: string; name: string; is_active?: boolean }>>(
    []
  );
  const [dealStatusMoveOpen, setDealStatusMoveOpen] = useState(false);
  const [dealStatusMoveMode, setDealStatusMoveMode] = useState<"lost" | "reopen">("lost");
  const [isDealStatusMoveLoading, setIsDealStatusMoveLoading] = useState(false);
  const [contactData, setContactData] = useState<{
    name: string;
    email: string | null;
    phone: string;
    profile_image_url: string | null;
  } | null>(initialContactData ? {
    name: initialContactData.name,
    email: null,
    phone: initialContactData.phone || contactNumber,
    profile_image_url: initialContactData.profile_image_url || null
  } : null);
  const [isMovingCard, setIsMovingCard] = useState(false);
  const [targetStepAnimation, setTargetStepAnimation] = useState<string | null>(null);
  const { toast } = useToast();
  const { selectedPipeline, moveCardOptimistic, updateCard, refreshCurrentPipeline } = usePipelinesContext();
  const { columns, isLoading: isLoadingColumns } = usePipelineColumns(selectedPipelineId);
  const { getHeaders } = useWorkspaceHeaders();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const canViewOpenAction = userRole === 'master' || userRole === 'admin';
  
  // Hook para informações adicionais do contato
  const { fields: extraFields, isLoading: isLoadingExtraInfo } = useContactExtraInfo(contactId, workspaceId);
  
  // Hook para histórico completo do card - usar cardId direto pois selectedCardId pode estar vazio no início
  const { data: fullHistory = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useCardHistory(cardId, contactId);

  // Carregar pipelines do workspace (para escolher destino em Perdido/Reabrir)
  useEffect(() => {
    const load = async () => {
      if (!workspaceId) return;
      try {
        const { data, error } = await supabase
          .from("pipelines")
          .select("id, name, is_active")
          .eq("workspace_id", workspaceId)
          .order("name", { ascending: true });
        if (error) throw error;
        setAvailablePipelines((data || []).filter((p: any) => p.is_active));
      } catch (e) {
        console.error("Erro ao buscar pipelines (DealDetailsModal):", e);
      }
    };
    load();
  }, [workspaceId]);
  
  // Estado para filtro de histórico
  const [historyFilter, setHistoryFilter] = useState<string>("todos");
  const [historyDisplayCount, setHistoryDisplayCount] = useState<number>(5);

  const handleHistoryFilterChange = useCallback((value: string) => {
    setHistoryFilter(value);
    setHistoryDisplayCount(5);
  }, []);

  useEffect(() => {
    if (activeTab === "historico") {
      setHistoryDisplayCount(5);
    }
  }, [cardId, activeTab]);

  // Refresh dos dados do histórico quando o modal abrir
  useEffect(() => {
    if (isOpen && cardId) {
      console.log('🔄 Modal aberto - Atualizando histórico do card');
      const historyKey = cardHistoryQueryKey(cardId);
      queryClient.invalidateQueries({ queryKey: historyKey });
      queryClient.refetchQueries({ queryKey: historyKey });
      refetchHistory();
    }
  }, [isOpen, cardId, contactId, queryClient, refetchHistory]);

  useEffect(() => {
    if (activeTab === "historico" && cardId) {
      console.log('🔄 Aba Histórico selecionada - Recarregando histórico do card');
      const historyKey = cardHistoryQueryKey(cardId);
      queryClient.invalidateQueries({ queryKey: historyKey });
      queryClient.refetchQueries({ queryKey: historyKey });
      refetchHistory();
    }
  }, [activeTab, cardId, contactId, queryClient, refetchHistory]);
  // A aba "negócio" sempre deve aparecer quando o modal é aberto via card
  const tabs: Array<{ id: DealDetailsTabId; label: string }> = [
    { id: "negocios", label: "Negócios" },
    { id: "atividades", label: "Atividades" },
    { id: "historico", label: "Histórico" },
    { id: "historico-atividades", label: "Histórico de Atividades" },
    { id: "contato", label: "Contato" },
  ];
  // CRITICAL: Reset completo quando cardId mudar - cada card é independente
  useEffect(() => {
    if (cardId) {
      console.log('🔄 RESET COMPLETO - Novo card selecionado:', cardId);
      
      // Reset de todos os estados para valores iniciais
      setSelectedCardId(cardId);
      // NÃO usar props aqui - deixar vazio e aguardar fetchCardData popular com dados do banco
      setSelectedColumnId("");
      setSelectedPipelineId("");
      setActiveTab(defaultTab);
      setActivities([]);
      setContactTags([]);
      setCardStatus('aberto');
      setPipelineSteps([]);
      setContactPipelines([]);
      setPipelineCardsCount(0);
      setAvailableCards([]);
      setPipelineActions([]); // CRÍTICO: Limpar ações ao trocar de card
      
      // Resetar dados do contato se não vier de props
      if (!initialContactData) {
        setContactData(null);
        setContactId("");
        setWorkspaceId("");
      } else {
        setContactId(initialContactData.id);
        setContactData({
          name: initialContactData.name,
          email: null,
          phone: initialContactData.phone || contactNumber,
          profile_image_url: initialContactData.profile_image_url || null
        });
      }
    }
  }, [cardId, defaultTab]); // Remover dependência de props desatualizados

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, isOpen]);

  // CRÍTICO: Buscar contactId imediatamente se não estiver disponível (para habilitar useCardHistory)
  useEffect(() => {
    if (isOpen && cardId && !contactId) {
      console.log('⚡ Buscando contactId urgentemente para habilitar histórico...');
      const fetchContactIdQuickly = async () => {
        const { data: card } = await supabase
          .from('pipeline_cards')
          .select('contact_id')
          .eq('id', cardId)
          .maybeSingle();
        
        if (card?.contact_id) {
          console.log('✅ ContactId encontrado:', card.contact_id);
          setContactId(card.contact_id);
        }
      };
      
      fetchContactIdQuickly();
    }
  }, [isOpen, cardId, contactId]);

  // Carregar dados quando modal abrir - usando referência confiável do card
  useEffect(() => {
    if (isOpen && cardId) {
      console.log('🚀 Modal aberto - iniciando preloading dos dados...');
      setIsInitialLoading(true);
      
      const loadAllData = async () => {
        try {
          await Promise.all([
            fetchCardData(),
            contactId && fetchActivities(contactId)
          ]);
        } finally {
          setIsInitialLoading(false);
          console.log('✅ Preloading concluído');
        }
      };
      
      loadAllData();
    }
  }, [isOpen, cardId]);

  // Recarregar atividades quando mudar de negócio
  useEffect(() => {
    if (contactId && selectedCardId) {
      console.log('🔄 Recarregando atividades para o card:', selectedCardId);
      fetchActivities(contactId);
    }
  }, [selectedCardId, contactId]);

  // Converter colunas em steps de progresso
  useEffect(() => {
    if (columns.length > 0 && selectedColumnId) {
      console.log('🎯 [4/4] Montando timeline:', {
        totalColunas: columns.length,
        selectedColumnId,
        colunaEncontrada: columns.find(c => c.id === selectedColumnId)?.name
      });
      
      const sortedColumns = [...columns].sort((a, b) => a.order_position - b.order_position);
      const currentIndex = sortedColumns.findIndex(col => col.id === selectedColumnId);
      
      if (currentIndex === -1) {
        console.warn('⚠️ Coluna selecionada não encontrada nas colunas carregadas!', {
          selectedColumnId,
          columnIds: columns.map(c => c.id)
        });
      }
      
      const steps: PipelineStep[] = sortedColumns.map((column, index) => ({
        id: column.id,
        name: column.name,
        color: column.color,
        icon: column.icon,
        isActive: index === currentIndex,
        isCompleted: currentIndex >= 0 && index < currentIndex
      }));
      
      setPipelineSteps(steps);
      console.log('✅ Timeline montada com sucesso:', steps.length, 'steps');
    } else if (columns.length === 0 && selectedColumnId) {
      console.warn('⚠️ selectedColumnId definido mas nenhuma coluna carregada ainda');
    }
  }, [columns, selectedColumnId]);

  // Configuração de ações do pipeline removida: botões são fixos (Ganho/Perdido/Reabrir)

  const fetchPipelineActions = async (_pipelineId: string) => {
    // noop - mantido apenas para compatibilidade com código legado no arquivo
    return;
  };

  const handleMoveToColumn = async (targetColumnId: string, targetStepIndex: number) => {
    if (isMovingCard || targetColumnId === selectedColumnId) return;
    
    try {
      setIsMovingCard(true);
      setTargetStepAnimation(targetColumnId);
      
      console.log('🎯 [Timeline] Movendo card via contexto:', {
        cardId: selectedCardId,
        fromColumn: selectedColumnId,
        toColumn: targetColumnId
      });
      
      // ✅ USAR O CONTEXTO em vez de UPDATE direto
      await moveCardOptimistic(selectedCardId, targetColumnId);
      
      // Atualizar estado local do modal
      setSelectedColumnId(targetColumnId);
      
      toast({
        title: "Card movido com sucesso",
        description: `Movido para ${pipelineSteps[targetStepIndex]?.name || 'nova etapa'}`,
      });
      
    } catch (error) {
      console.error('❌ Erro ao mover card:', error);
      toast({
        title: "Erro",
        description: "Não foi possível mover o card",
        variant: "destructive",
      });
    } finally {
      setIsMovingCard(false);
      setTargetStepAnimation(null);
    }
  };

  const executeAction = async (action: any) => {
    const actionState = (action?.deal_state || '').toString().toLowerCase();
    const actionName = (action?.action_name || '').toString().toLowerCase();

    const isLossAction =
      actionState === 'perda' ||
      actionState === 'perdido' ||
      actionState.includes('perda') ||
      actionName.includes('perdido') ||
      actionName.includes('perda');

    // Se for ação de "Perda", abrir modal de motivo de perda
    if (isLossAction) {
      setConfirmLossAction(action);
      setIsMarkAsLostModalOpen(true);
      return;
    }

    // Se for "Ganho", executar direto
    await processActionExecution(action);
  };

  const handleMarkAsLost = async (lossReasonId: string | null, comments: string) => {
    if (!confirmLossAction) return;

    setIsMarkingAsLost(true);
    try {
      // Primeiro executar a ação de perda (mover para coluna de perda)
      await processActionExecution(confirmLossAction);

      // Depois atualizar os campos de motivo de perda
      const { error } = await supabase
        .from('pipeline_cards')
        .update({
          loss_reason_id: lossReasonId,
          loss_comments: comments,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCardId);

      if (error) throw error;

      console.log('✅ Motivo de perda salvo com sucesso');

      if (contactId) {
        await logLossReasonObservation(lossReasonId, comments);
        await fetchActivities(contactId);
      }
    } catch (error: any) {
      console.error('❌ Erro ao salvar motivo de perda:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o motivo de perda',
        variant: 'destructive',
      });
    } finally {
      setIsMarkingAsLost(false);
      setConfirmLossAction(null);
    }
  };

  const handleDealStatusMoveConfirm = useCallback(
    async (payload: { pipelineId: string; columnId: string; lossReasonId: string | null; lossComments: string }) => {
      if (!selectedCardId) return;
      setIsDealStatusMoveLoading(true);
      try {
        // Regras:
        // - Ganho: só muda status (card some do pipeline)
        // - Perdido: exige motivo e escolhe destino (pipeline + coluna)
        // - Reabrir: escolhe destino (pipeline + coluna)

        if (dealStatusMoveMode === "reopen") {
          await updateCard(selectedCardId, {
            pipeline_id: payload.pipelineId,
            column_id: payload.columnId,
            status: "aberto",
          });
          setCardStatus("aberto");
          setSelectedPipelineId(payload.pipelineId);
          setSelectedColumnId(payload.columnId);
          toast({ title: "Sucesso", description: "Oportunidade reaberta." });
          setDealStatusMoveOpen(false);
          return;
        }

        // lost
        await updateCard(selectedCardId, {
          pipeline_id: payload.pipelineId,
          column_id: payload.columnId,
          status: "perda",
        });
        setCardStatus("perda");
        setSelectedPipelineId(payload.pipelineId);
        setSelectedColumnId(payload.columnId);

        const { error } = await supabase
          .from("pipeline_cards")
          .update({
            loss_reason_id: payload.lossReasonId,
            loss_comments: payload.lossComments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedCardId);
        if (error) throw error;

        if (contactId) {
          await logLossReasonObservation(payload.lossReasonId, payload.lossComments);
          await fetchActivities(contactId);
        }

        toast({ title: "Sucesso", description: "Negócio marcado como perdido." });
        setDealStatusMoveOpen(false);
      } catch (e: any) {
        console.error("Erro ao alterar status/mover (DealDetailsModal):", e);
        toast({
          title: "Erro",
          description: e?.message || "Não foi possível realizar a ação.",
          variant: "destructive",
        });
      } finally {
        setIsDealStatusMoveLoading(false);
      }
    },
    [contactId, dealStatusMoveMode, fetchActivities, logLossReasonObservation, selectedCardId, toast, updateCard]
  );

  const processActionExecution = async (action: any) => {
    try {
      // Regra: só pode marcar como ganho se estiver qualificado
      const statusMap: Record<string, string> = {
        'Ganho': 'ganho',
        'Perda': 'perda',
        'Aberto': 'aberto',
      };
      const normalizedStatusPreview = statusMap[action?.deal_state] || 'aberto';
      const isWinAction = String(normalizedStatusPreview).toLowerCase() === 'ganho';
      if (isWinAction && cardQualification !== 'qualified') {
        toast({
          title: "Não foi possível marcar como ganho",
          description: "Você precisa qualificar o negócio antes de marcar como ganho.",
          variant: "destructive",
        });
        return;
      }

      setIsExecutingAction(true);
      console.log('🎬 Executando ação:', action);
      console.log('📍 Dados do card antes da ação:', {
        cardId: selectedCardId,
        pipelineOrigem: selectedPipelineId,
        colunaOrigem: selectedColumnId,
        pipelineDestino: action.target_pipeline_id,
        colunaDestino: action.target_column_id
      });

      // Buscar informações do pipeline e coluna de destino
      const { data: targetPipeline } = await supabase
        .from('pipelines')
        .select('name')
        .eq('id', action.target_pipeline_id)
        .single();

      const { data: targetColumn } = await supabase
        .from('pipeline_columns')
        .select('name')
        .eq('id', action.target_column_id)
        .single();

      console.log('✅ Executando transferência...');

      // Atualizar o card para o pipeline/coluna de destino usando contexto (Edge Function)
      const normalizedStatus = statusMap[action.deal_state] || 'aberto';

      await updateCard(selectedCardId, {
        pipeline_id: action.target_pipeline_id,
        column_id: action.target_column_id,
        status: normalizedStatus
      });
      setCardStatus(normalizedStatus as 'aberto' | 'ganho' | 'perda');

      console.log('✅ Card atualizado com sucesso via contexto');
      setSelectedPipelineId(action.target_pipeline_id);
      setSelectedColumnId(action.target_column_id);

      // Mostrar toast de sucesso IMEDIATAMENTE
      toast({
        title: `Negócio marcado como ${action.deal_state}`,
        description: `Movido para ${targetPipeline?.name} - ${targetColumn?.name}`,
      });

      // Card movido com sucesso - o contexto já irá atualizar a visualização

      // Pequeno delay para usuário ver o feedback antes do modal fechar
      setTimeout(() => {
        console.log('✅ Fechando modal após ação bem-sucedida');
        onClose();
      }, 500);

    } catch (error: any) {
      console.error('❌ Error executing action:', error);
      toast({
        title: "Erro ao executar ação",
        description: error.message || "Não foi possível executar a ação.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingAction(false);
    }
  };
  const fetchCardData = async () => {
    // Validar cardId antes de prosseguir
    if (!cardId) {
      console.error('❌ cardId é inválido:', cardId);
      return;
    }

    setIsLoadingData(true);
    try {
      console.log('🔍 [1/4] Iniciando busca de dados do card:', cardId);
      console.log('📋 Props recebidos:', { currentPipelineId, currentColumnId });
      
      // PASSO 1: Buscar dados do card usando a edge function
      const headers = getHeaders();
      const { data: currentCard, error: cardError } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (cardError) {
        console.error('❌ Erro ao buscar card:', cardError);
        throw cardError;
      }
      
      if (!currentCard) {
        console.error('❌ Card não encontrado:', cardId);
        throw new Error('Card não encontrado');
      }
      
      console.log('✅ [2/4] Card encontrado no banco:', {
        cardId: currentCard.id,
        pipeline_id: currentCard.pipeline_id,
        column_id: currentCard.column_id,
        contact_id: currentCard.contact_id
      });

      // PASSO 2: Atualizar estados com dados REAIS do banco (ignorar props)
      setSelectedPipelineId(currentCard.pipeline_id);
      setSelectedColumnId(currentCard.column_id);
      setCardStatus((currentCard.status as 'aberto' | 'ganho' | 'perda') || 'aberto');
      const q = (currentCard as any)?.qualification;
      setCardQualification(q === 'qualified' || q === 'disqualified' || q === 'unqualified' ? q : 'unqualified');
      console.log('🔄 [3/4] Estados atualizados com dados do banco');
      
      let contactIdToUse: string | null = currentCard.contact_id;
      let conversationIdFromCard: string | null = currentCard.conversation_id;
      
      // Se já temos dados do contato, buscar os dados completos
      if (initialContactData) {
        contactIdToUse = initialContactData.id;
        setContactId(initialContactData.id);
        
        // Buscar dados completos do contato incluindo conversation_id
        const { data: fullContact } = await supabase
          .from('contacts')
          .select('id, name, email, phone, profile_image_url, workspace_id')
          .eq('id', initialContactData.id)
          .maybeSingle();
        
        if (fullContact) {
          setWorkspaceId(fullContact.workspace_id);
          setContactData({
            name: fullContact.name,
            email: fullContact.email,
            phone: fullContact.phone,
            profile_image_url: fullContact.profile_image_url
          });
          
          // Carregar tags e atividades em paralelo (histórico carregado automaticamente)
          await Promise.all([
            fetchContactTags(initialContactData.id),
            fetchActivities(initialContactData.id)
          ]);
        }
      } else {
        // Fallback: buscar todos os dados se não tivermos dados iniciais
        await fetchAdditionalCardData();
        contactIdToUse = contactId;
      }
      
      // Armazenar conversation_id se disponível
      if (conversationIdFromCard) {
        setConversationId(conversationIdFromCard);
        // Históricos já são buscados automaticamente pelo useCardHistory
      }
      
      // SEMPRE buscar os pipelines do contato (independente do fluxo acima)
      if (contactIdToUse) {
        console.log('🔍 Buscando pipelines do contato:', contactIdToUse);
        
        const { data: allCards, error: allCardsError } = await supabase
          .from('pipeline_cards')
          .select(`
            id, 
            pipeline_id, 
            column_id,
            pipelines (
              id, 
              name, 
              type
            )
          `)
          .eq('contact_id', contactIdToUse)
          .eq('status', 'aberto');

        console.log('📊 Cards do contato:', { allCards, allCardsError, count: allCards?.length });

        if (allCards && allCards.length > 0) {
          setAvailableCards(allCards);
          
          // Extrair pipelines únicos
          const uniquePipelines = allCards.reduce((acc: any[], cardItem: any) => {
            const pipeline = cardItem.pipelines;
            if (pipeline && !acc.find(p => p.id === pipeline.id)) {
              acc.push(pipeline);
            }
            return acc;
          }, []);
          
          console.log('🔄 Pipelines únicos encontrados:', uniquePipelines);
          
          setContactPipelines(uniquePipelines);
          setPipelineCardsCount(allCards.length);
        }
      }
      
      // Buscar timeline de evolução do card atual
      await fetchCardTimeline(cardId);
      
    } catch (error) {
      console.error('❌ Erro ao buscar dados do card:', error);
      
      // Mostrar detalhes do erro
      if (error && typeof error === 'object') {
        console.error('Detalhes do erro:', {
          message: (error as any).message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code
        });
      }
      
      toast({
        title: "Erro ao carregar negócio",
        description: "Não foi possível carregar os dados do negócio. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchAdditionalCardData = async () => {
    // Buscar dados do card específico com contato relacionado
    const { data: card, error: cardError } = await supabase
      .from('pipeline_cards')
      .select(`
        id,
        description,
        column_id,
        pipeline_id,
        status,
        contact_id,
        contacts (
          id,
          name,
          email,
          phone,
          profile_image_url,
          workspace_id
        ),
        pipelines (
          id,
          name,
          type
        )
      `)
      .eq('id', cardId)
      .maybeSingle();
      
    if (cardError || !card) {
      console.error('❌ Erro ao buscar card:', cardError || 'Card não encontrado');
      toast({
        title: "Erro", 
        description: cardError?.message || "Card não encontrado ou não foi possível carregar os dados.",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ Card encontrado:', card);
    setCardStatus((card.status as 'aberto' | 'ganho' | 'perda') || 'aberto');
    
    // Definir dados do contato
    const contact = card.contacts;
    if (contact) {
      setContactId(contact.id);
      setWorkspaceId(contact.workspace_id);
      setContactData({
        name: contact.name || 'Nome não informado',
        email: contact.email,
        phone: contact.phone,
        profile_image_url: contact.profile_image_url
      });

      // Buscar todos os cards deste contato para contar
      const { data: allCards, error: allCardsError } = await supabase
        .from('pipeline_cards')
        .select(`
          id, 
          pipeline_id, 
          column_id,
          pipelines (
            id, 
            name, 
            type
          )
        `)
        .eq('contact_id', contact.id)
        .eq('status', 'aberto');

      console.log('📊 Cards do contato:', { allCards, allCardsError, count: allCards?.length });

      if (allCards && allCards.length > 0) {
        setAvailableCards(allCards);
        
        // Extrair pipelines únicos
        const uniquePipelines = allCards.reduce((acc: any[], cardItem: any) => {
          const pipeline = cardItem.pipelines;
          if (pipeline && !acc.find(p => p.id === pipeline.id)) {
            acc.push(pipeline);
          }
          return acc;
        }, []);
        
        console.log('🔄 Pipelines únicos encontrados:', uniquePipelines);
        
        setContactPipelines(uniquePipelines);
        setPipelineCardsCount(allCards.length);
      }

      // Carregar tags e atividades em paralelo (histórico carregado automaticamente)
      await Promise.all([
        fetchContactTags(contact.id),
        fetchActivities(contact.id)
      ]);
    }
  };
  const fetchCardTimeline = async (cardId: string) => {
    try {
      // Buscar histórico do card através da tabela updated_at
      // Por enquanto, vamos buscar os dados do card e criar um timeline simples
      const { data: card } = await supabase
        .from('pipeline_cards')
        .select(`
          id,
          created_at,
          updated_at,
          column_id,
          pipeline_columns (
            id,
            name,
            color
          )
        `)
        .eq('id', cardId)
        .maybeSingle();

      if (card) {
        // Timeline simples: criação e posição atual
        const timeline = [
          {
            date: card.created_at,
            action: 'Negócio criado',
            column: null
          },
          {
            date: card.updated_at,
            action: 'Posição atual',
            column: card.pipeline_columns
          }
        ];
        setCardTimeline(timeline);
      }
    } catch (error) {
      console.error('Erro ao buscar timeline:', error);
    }
  };

  const fetchContactTags = async (contactId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('contact_tags').select(`
          id,
          tags (
            id,
            name,
            color
          )
        `).eq('contact_id', contactId);
      if (error) throw error;
      const tags = data?.map(item => item.tags).filter(Boolean) || [];
      setContactTags(tags as Tag[]);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
    }
  };
  const fetchActivities = async (contactId: string) => {
    try {
      console.log('📋 Buscando atividades para contact_id:', contactId, 'card_id:', selectedCardId);
      
      // Buscar TODAS as atividades do contato incluindo description
      const { data: allContactActivities, error } = await supabase
        .from('activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('scheduled_for', { ascending: true });
        
      if (error) {
        console.error('❌ Erro ao buscar atividades:', error);
        throw error;
      }
      
      console.log('📥 Atividades brutas do banco:', allContactActivities);
      
      // Filtrar no frontend para garantir isolamento correto
      const data = allContactActivities?.filter(activity => {
        // Incluir apenas atividades:
        // 1. Vinculadas especificamente a este card
        // 2. Globais (sem vínculo a nenhum card)
        return activity.pipeline_card_id === selectedCardId || 
               activity.pipeline_card_id === null;
      }) || [];
        
      if (error) throw error;
      
      console.log(`✅ ${data?.length || 0} atividades carregadas:`, {
        total: data?.length,
        doCard: data?.filter(a => a.pipeline_card_id === selectedCardId).length,
        globais: data?.filter(a => !a.pipeline_card_id).length,
        outrosCards: data?.filter(a => a.pipeline_card_id && a.pipeline_card_id !== selectedCardId).length
      });
      
      setActivities(data || []);

  // Buscar também os comentários (contact_observations)
      const { data: observations, error: obsError } = await supabase
        .from('contact_observations')
        .select(`
          id,
          content,
          created_at,
          created_by,
          file_url,
          file_name,
          file_type
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (obsError) {
        console.error('❌ Erro ao buscar comentários:', obsError);
      } else {
        console.log('📥 Comentários carregados:', observations?.length || 0);
        setContactObservations(observations || []);
      }
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
    }
  };

  // Função fetchCardHistory removida - agora usamos useCardHistory hook
  
  // Funções de histórico removidas - agora usamos apenas useCardHistory que busca tudo de forma unificada
  useEffect(() => {
    if (!isOpen) return;

    const loadCurrentUser = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const email = authData.user?.email;
        if (!email) {
          setCurrentSystemUser(null);
          return;
        }

        const { data: systemUser } = await supabase
          .from('system_users')
          .select('id, name')
          .eq('email', email)
          .maybeSingle();

        setCurrentSystemUser({
          id: systemUser?.id || null,
          name: systemUser?.name || email,
        });
      } catch (error) {
        console.error('Erro ao carregar usuário atual:', error);
        setCurrentSystemUser(null);
      }
    };

    loadCurrentUser();
  }, [isOpen]);

  const handleTagAdded = (tag: Tag) => {
    setContactTags(prev => {
      const exists = prev.some(existing => existing.id === tag.id);
      if (exists) return prev;
      return [...prev, tag];
    });
    // O trigger log_contact_tag_action já registra no histórico automaticamente
  };

  const handleRemoveTag = async (tagId: string) => {
    const removedTag = contactTags.find(tag => tag.id === tagId);
    try {
      const {
        error
      } = await supabase.from('contact_tags').delete().eq('contact_id', contactId).eq('tag_id', tagId);
      if (error) throw error;
      setContactTags(prev => prev.filter(tag => tag.id !== tagId));
      // O trigger log_contact_tag_action já registra no histórico automaticamente
      toast({
        title: "Etiqueta removida",
        description: "A etiqueta foi removida do contato."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a tag.",
        variant: "destructive"
      });
    }
  };
  const logLossReasonObservation = useCallback(async (lossReasonId: string | null, comments: string) => {
    if (!contactId) return;
    try {
      let reasonName: string | null = null;
      if (lossReasonId) {
        const { data: reasonData } = await supabase
          .from('loss_reasons')
          .select('name')
          .eq('id', lossReasonId)
          .maybeSingle();
        reasonName = reasonData?.name || null;
      }

      const trimmedComments = comments?.trim();
      const observationParts: string[] = ["Negócio marcado como perdido."];

      if (reasonName) {
        observationParts.push(`Motivo: ${reasonName}`);
      } else if (!reasonName && !lossReasonId && trimmedComments) {
        observationParts.push(`Motivo: ${trimmedComments}`);
      }

      if (trimmedComments && (!reasonName || trimmedComments !== reasonName)) {
        observationParts.push(`Observação: ${trimmedComments}`);
      }

      const content = observationParts.join('\n');

      const { error } = await supabase.from('contact_observations').insert({
        contact_id: contactId,
        content,
        created_by: currentSystemUser?.id ?? null,
        workspace_id: workspaceId,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao registrar histórico de motivo de perda:', error);
    }
  }, [contactId, currentSystemUser?.id]);
  const handleActivityCreated = (activity: Activity) => {
    setActivities(prev => [...prev, activity]);
    // Recarregar histórico unificado para mostrar a nova atividade
    if (typeof refetchHistory === 'function') {
      refetchHistory();
    }
  };

  const handleRequestDeleteActivity = (activity: Activity) => {
    setActivityToDelete(activity);
  };

  const handleConfirmDeleteActivity = async () => {
    if (!activityToDelete) return;

    try {
      setIsDeletingActivity(true);

      // Registrar auditoria ANTES de excluir (com dados da atividade)
      await logDelete(
        'activity',
        activityToDelete.id,
        activityToDelete.subject || activityToDelete.type,
        {
          type: activityToDelete.type,
          subject: activityToDelete.subject,
          description: activityToDelete.description,
          scheduled_for: activityToDelete.scheduled_for,
          responsible_id: activityToDelete.responsible_id,
        },
        activityToDelete.workspace_id || workspaceId
      );

      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityToDelete.id);

      if (error) throw error;

      setActivities(prev => prev.filter(item => item.id !== activityToDelete.id));

      toast({
        title: "Atividade excluída",
        description: "A atividade foi removida com sucesso."
      });

      // Recarregar histórico unificado
      if (typeof refetchHistory === 'function') {
        refetchHistory();
      }

      if (contactId) {
        await fetchActivities(contactId);
      }
    } catch (error) {
      console.error('Erro ao excluir atividade:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a atividade.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingActivity(false);
      setActivityToDelete(null);
    }
  };

  // Funções para o formulário de atividade integrado
  const handleDateTimeClick = () => {
    // Este clique não faz nada, o calendário já abre automaticamente pelo Popover
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowTimePicker(true);
      return;
    }

    // Se o usuário clicar novamente no mesmo dia (ex: hoje),
    // manter a data atual e abrir o seletor de hora
    if (!date && selectedDate) {
      setShowTimePicker(true);
    }
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    setShowTimePicker(false);
    // Após selecionar a hora, abrir o seletor de minutos
    setShowMinutePicker(true);
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    setShowMinutePicker(false);
    // Atualizar o selectedTime com a nova hora e minuto
    const timeString = `${selectedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    setSelectedTime(timeString);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const handleCreateActivity = async () => {
    console.log('🔵 handleCreateActivity chamado', {
      type: activityForm.type,
      contactId,
      responsibleId: activityForm.responsibleId,
      description: activityForm.description
    });

    // Validação diferente para comentários
    if (activityForm.type === "Comentários") {
      if (!contactId) {
        toast({
          title: "Erro",
          description: "Contato não identificado. Tente reabrir o card.",
          variant: "destructive",
        });
        return;
      }

      if (!activityForm.responsibleId || !activityForm.description.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o responsável e o comentário.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedDate || !activityForm.responsibleId) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o responsável e a data.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsCreatingActivity(true);
    try {
      console.log('📋 Buscando workspace do contato:', contactId);
      // Get workspace_id from the contact
      const { data: contactDataForActivity, error: contactError } = await supabase
        .from('contacts')
        .select('workspace_id')
        .eq('id', contactId)
        .single();

      if (contactError) {
        console.error('❌ Erro ao buscar contato:', contactError);
        throw contactError;
      }

      if (!contactDataForActivity?.workspace_id) {
        throw new Error('Workspace não encontrado para este contato');
      }

      console.log('✅ Workspace encontrado:', contactDataForActivity.workspace_id);

      // Se for comentário, salvar em contact_observations
      if (activityForm.type === "Comentários") {
        console.log('💾 Salvando comentário...', {
          contact_id: contactId,
          workspace_id: contactDataForActivity.workspace_id,
          content: activityForm.description.trim(),
          created_by: activityForm.responsibleId
        });

        const { data: insertedComment, error } = await supabase
          .from('contact_observations')
          .insert({
            contact_id: contactId,
            workspace_id: contactDataForActivity.workspace_id,
            content: activityForm.description.trim(),
            created_by: activityForm.responsibleId
          })
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao inserir comentário:', error);
          throw error;
        }

        console.log('✅ Comentário salvo com sucesso:', insertedComment);

        toast({
          title: "Comentário adicionado com sucesso!",
          description: "O comentário foi salvo no perfil do contato.",
        });

        // Resetar formulário
        setActivityForm({
          type: "Lembrete",
          responsibleId: "",
          subject: "",
          description: "",
          durationMinutes: 30,
        });
        setSelectedDate(undefined);
        setSelectedTime("13:00");
        setAttachedFile(null);
        
        // Recarregar atividades para mostrar o novo comentário no histórico
        console.log('🔄 Recarregando atividades...');
        if (contactId) {
          await fetchActivities(contactId);
        }
        
        setIsCreatingActivity(false);
        return;
      }

      // Lógica normal para atividades
      // Combinar data e hora
      const [hour, minute] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate!);
      scheduledDateTime.setHours(hour, minute, 0, 0);

      // Upload do arquivo se houver
      let attachmentUrl = null;
      if (attachedFile) {
        const fileExt = attachedFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${contactDataForActivity.workspace_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('activity-attachments')
          .upload(filePath, attachedFile, {
            contentType: attachedFile.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          toast({
            title: "Erro ao anexar arquivo",
            description: "O arquivo não pôde ser enviado.",
            variant: "destructive",
          });
        } else {
          // Obter URL pública
          const { data: { publicUrl } } = supabase.storage
            .from('activity-attachments')
            .getPublicUrl(filePath);
          
          attachmentUrl = publicUrl;
        }
      }

      const activityData = {
        contact_id: contactId,
        workspace_id: contactDataForActivity.workspace_id,
        type: activityForm.type,
        responsible_id: activityForm.responsibleId,
        subject: activityForm.subject.trim() || activityForm.type,
        description: activityForm.description || null,
        scheduled_for: scheduledDateTime.toISOString(),
        duration_minutes: activityForm.durationMinutes,
        attachment_name: attachedFile?.name || null,
        attachment_url: attachmentUrl,
        pipeline_card_id: selectedCardId, // Vincular ao negócio atual
      };

      const { data: activity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id,
          is_completed,
          attachment_url,
          attachment_name
        `)
        .single();

      if (error) throw error;

      // Registrar auditoria da criação
      await logCreate(
        'activity',
        activity.id,
        activity.subject || activityForm.type,
        {
          type: activityForm.type,
          subject: activity.subject,
          description: activityForm.description,
          scheduled_for: activity.scheduled_for,
          responsible_id: activityForm.responsibleId,
        },
        contactDataForActivity.workspace_id || workspaceId
      );

      handleActivityCreated(activity);
      
      // Verificar se evento foi criado no Google Calendar (opcional, não bloqueia)
      if (activityForm.responsibleId) {
        // A integração com Google Calendar é assíncrona via trigger
        toast({
          title: "Atividade criada com sucesso!",
          description: `A atividade "${activityForm.subject}" foi agendada.`,
        });
      } else {
        toast({
          title: "Atividade criada com sucesso!",
          description: `A atividade "${activityForm.subject}" foi agendada.`,
        });
      }

      // Recarregar atividades para mostrar a nova na lista
      await fetchActivities(contactId);

      // Resetar formulário
      setActivityForm({
        type: "Lembrete",
        responsibleId: "",
        subject: "",
        description: "",
        durationMinutes: 30,
      });
      setSelectedDate(new Date());
      setSelectedTime("13:00");
      setAttachedFile(null);
    } catch (error) {
      console.error('Erro ao criar atividade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a atividade.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingActivity(false);
    }
  };

  // Carregar usuários quando necessário usando cache otimizado
  useEffect(() => {
    if (activeTab === "atividades" && users.length === 0 && workspaceId && !isLoadingUsers) {
      loadUsers();
    }
  }, [activeTab, users.length, loadUsers, workspaceId, isLoadingUsers]);

  // Preselecionar responsável para usuários não master
  useEffect(() => {
    if (authUser?.id && userRole !== 'master') {
      setActivityForm(prev => prev.responsibleId ? prev : { ...prev, responsibleId: authUser.id });
    }
  }, [authUser?.id, userRole]);
  const handleCompleteActivity = async (activityId: string) => {
    try {
      const completionTimestamp = new Date().toISOString();
      
      // Buscar atividade atual para auditoria
      const activityToComplete = activities.find(a => a.id === activityId);

      const {
        error
      } = await supabase.from('activities').update({
        is_completed: true,
        completed_at: completionTimestamp
      }).eq('id', activityId);
      if (error) throw error;

      // Registrar auditoria da conclusão
      if (activityToComplete) {
        await logUpdate(
          'activity',
          activityId,
          activityToComplete.subject || activityToComplete.type,
          { is_completed: false },
          { is_completed: true, completed_at: completionTimestamp },
          activityToComplete.workspace_id || workspaceId
        );
      }

      setActivities(prev => prev.map(activity => activity.id === activityId ? {
        ...activity,
        is_completed: true,
        completed_at: completionTimestamp
      } : activity));

      if (contactId) {
        await fetchActivities(contactId);
      }

      const historyKey = cardHistoryQueryKey(cardId);
      queryClient.invalidateQueries({ queryKey: historyKey });
      queryClient.refetchQueries({ queryKey: historyKey });
      await refetchHistory();

      toast({
        title: "Atividade concluída",
        description: "A atividade foi marcada como concluída."
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível concluir a atividade.",
        variant: "destructive"
      });
    }
  };
  const pendingActivities = activities.filter(activity => !activity.is_completed);
  const completedActivities = activities.filter(activity => activity.is_completed);
  const activitiesForSelectedDate = activities.filter(activity => {
    if (!activity.scheduled_for) return false;
    try {
      const activityDate = new Date(activity.scheduled_for);
      return format(activityDate, "yyyy-MM-dd") === format(selectedCalendarDate, "yyyy-MM-dd");
    } catch (error) {
      console.error('Erro ao processar data da atividade:', error, activity);
      return false;
    }
  });
  
  // Combinar atividades concluídas com comentários para o histórico
  const completedActivitiesWithComments = [
    ...completedActivities.map(act => ({
      type: 'activity' as const,
      id: act.id,
      activity_type: act.type,
      subject: act.subject,
      description: act.description,
      date: act.scheduled_for,
      completed_at: act.completed_at,
      responsible_name: act.users?.name,
      attachment_url: act.attachment_url || undefined,
      attachment_name: act.attachment_name || undefined,
      file_url: undefined,
      file_name: undefined,
      file_type: undefined,
    })),
    ...contactObservations.map(obs => ({
      type: 'comment' as const,
      id: obs.id,
      activity_type: 'Observação',
      subject: 'Observação',
      description: obs.content,
      date: obs.created_at,
      responsible_name: undefined,
      attachment_url: undefined,
      attachment_name: undefined,
      file_url: obs.file_url || undefined,
      file_name: obs.file_name || undefined,
      file_type: obs.file_type || undefined,
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Função para mudar o pipeline/negócio selecionado
  const handlePipelineChange = (newPipelineId: string) => {
    // Encontrar o card deste contato no pipeline selecionado
    const cardInPipeline = availableCards.find(c => c.pipeline_id === newPipelineId);
    
    if (cardInPipeline) {
      setSelectedPipelineId(newPipelineId);
      setSelectedCardId(cardInPipeline.id);
      setSelectedColumnId(cardInPipeline.column_id);
    }
  };
  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("max-w-6xl w-full h-[90vh] p-0 gap-0 flex flex-col", isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white")}>
        {/* Header */}
        <DialogHeader className={cn("mx-0 mt-0 px-6 py-4 border-b shrink-0 bg-primary text-primary-foreground", isDarkMode ? "border-gray-600" : "border-gray-200")}>
          <div className="flex items-center gap-4 flex-1 pr-8">
            {/* Avatar e Info Principal */}
            <Avatar className="w-12 h-12 border-2 border-white/20">
              <AvatarImage 
                src={contactData?.profile_image_url} 
                alt={contactData?.name || "Contato"}
              />
              <AvatarFallback className="bg-white/20 text-primary-foreground font-semibold text-lg">
                {contactData?.name ? contactData.name.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="flex flex-col min-w-0">
                <DialogTitle className={cn("text-xl font-bold text-left truncate text-primary-foreground")}>
                  {contactData?.name || dealName || contactData?.phone || contactNumber || "Sem nome"}
                </DialogTitle>
                <div className="flex items-center gap-2 text-primary-foreground/80">
                  <p className="text-sm text-left">
                    {contactData?.phone || contactNumber}
                  </p>
                  {conversationId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-white/20 text-primary-foreground"
                      onClick={() => setIsChatModalOpen(true)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* Tags do contato */}
                {contactTags.map(tag => <Badge key={tag.id} variant="outline" className="border-white/40 bg-white/10 px-2 py-0.5 text-xs group relative text-primary-foreground hover:bg-white/20">
                    {tag.name}
                    <Button size="icon" variant="ghost" className="ml-1 h-3 w-3 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 text-primary-foreground" onClick={() => handleRemoveTag(tag.id)}>
                      <X className="w-2 h-2" />
                    </Button>
                  </Badge>)}
                
                {/* Botão "mais" para adicionar tags */}
                {contactId && (
                  <div className="text-primary-foreground">
                     <AddContactTagButton 
                      contactId={contactId} 
                      isDarkMode={isDarkMode}
                      onTagAdded={(tag) => {
                        if (contactId) {
                          fetchContactTags(contactId);
                        }
                        handleTagAdded(tag);
                      }} 
                    />
                  </div>
                )}
              </div>
            </div>
            
            {/* Botões fixos: Ganho / Perdido / Reabrir */}
            <div className="ml-auto flex gap-2 items-center">
              {cardStatus === "aberto" ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      const run = async () => {
                        // Regra: não pode marcar como ganho se existir atividade em aberto
                        try {
                          const { data: openActs, error: openActsError } = await supabase
                            .from("activities")
                            .select("id, type, is_completed")
                            .eq("pipeline_card_id", selectedCardId)
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
                          console.warn("Falha ao validar atividades em aberto (ganho/modal):", e);
                          // não bloqueia por erro momentâneo
                        }

                        if (cardQualification !== "qualified") {
                          toast({
                            title: "Não foi possível marcar como ganho",
                            description: "Você precisa qualificar o negócio antes de marcar como ganho.",
                            variant: "destructive",
                          });
                          return;
                        }

                        try {
                          setIsExecutingAction(true);
                          await updateCard(selectedCardId, { status: "ganho" });
                          setCardStatus("ganho");
                          toast({ title: "Sucesso", description: "Negócio marcado como ganho." });
                          onClose();
                        } catch (e: any) {
                          console.error("Erro ao marcar como ganho (modal):", e);
                          toast({
                            title: "Erro",
                            description: e?.message || "Não foi possível marcar como ganho.",
                            variant: "destructive",
                          });
                        } finally {
                          setIsExecutingAction(false);
                        }
                      };
                      void run();
                    }}
                    disabled={isExecutingAction || isDealStatusMoveLoading}
                    className="bg-green-600 hover:bg-green-700 text-white border-transparent shadow-sm rounded-none h-8 px-4 text-xs font-medium disabled:opacity-60"
                  >
                    Ganho
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDealStatusMoveMode("lost");
                      setDealStatusMoveOpen(true);
                    }}
                    disabled={isExecutingAction || isDealStatusMoveLoading}
                    className="bg-red-600 hover:bg-red-700 text-white border-transparent shadow-sm rounded-none h-8 px-4 text-xs font-medium disabled:opacity-60"
                  >
                    Perdido
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setDealStatusMoveMode("reopen");
                    setDealStatusMoveOpen(true);
                  }}
                  disabled={isExecutingAction || isDealStatusMoveLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm rounded-none h-8 px-4 text-xs font-medium disabled:opacity-60"
                >
                  Reabrir
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>


        {/* Tabs - Excel Style (Top) */}
        <div
          className={cn(
            "flex items-end border-b shrink-0 px-2 pt-2",
            isDarkMode ? "border-gray-600 bg-[#1a1a1a]" : "border-[#d4d4d4] bg-[#f0f0f0]"
          )}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                const historyKey = cardHistoryQueryKey(cardId);
                queryClient.invalidateQueries({ queryKey: historyKey });
                queryClient.refetchQueries({ queryKey: historyKey });
                
                if ((tab.id === 'historico-atividades' || tab.id === 'atividades') && contactId) {
                  fetchActivities(contactId);
                }

                if (tab.id === 'historico') {
                  setHistoryFilter('todos');
                }

                if (tab.id === 'negocios') {
                  fetchCardData();
                }

                setActiveTab(tab.id);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-t border-x rounded-t-md transition-all relative top-[1px] min-w-[100px]",
                activeTab === tab.id 
                  ? "bg-white border-[#d4d4d4] border-b-white text-primary z-10 dark:bg-[#1f1f1f] dark:border-gray-600 dark:border-b-[#1f1f1f] dark:text-gray-100"
                  : "bg-transparent border-transparent text-gray-500 hover:bg-white/60 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100",
                isDarkMode && activeTab === tab.id && "bg-[#1f1f1f] border-gray-600 border-b-[#1f1f1f] text-white",
                isDarkMode && activeTab !== tab.id && "text-gray-400 hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          className={cn(
            "flex-1 overflow-auto p-6 transition-colors",
            isDarkMode ? "bg-[#050505] text-gray-100" : "bg-white text-gray-900"
          )}
        >
          {isInitialLoading ? (
            /* Skeleton de Loading */
            <div className="space-y-6 animate-pulse">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-5 w-32" />
                <div className="flex justify-between gap-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex flex-col items-center space-y-2 flex-1">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : activeTab === "negocios" && <div className="space-y-6">
              {/* Pipeline do Negócio - Excel Style */}
              <div className="space-y-2">
                <label className={cn("text-sm font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                  Pipeline do Negócio
                </label>
                <div className={cn(
                  "px-4 py-2 border font-medium rounded-none shadow-sm text-xs",
                  isDarkMode ? "bg-[#1b1b1b] border-gray-700 text-gray-200" : "bg-white border-[#d4d4d4] text-gray-800"
                )}>
                  {isLoadingData ? 'Carregando...' : (selectedPipeline?.name || 'Pipeline não identificado')}
                </div>
              </div>

              {/* Pipeline Timeline - Baseado na imagem de referência */}
              <div className="space-y-4 pb-4">
                {isLoadingColumns ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-pulse space-y-4 w-full">
                      <div className="h-4 bg-gray-300 w-1/4"></div>
                      <div className="flex justify-between">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="flex flex-col items-center space-y-2">
                            <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                            <div className="h-3 bg-gray-300 w-16"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : pipelineSteps.length > 0 ? (
                  <div className={cn(
                    "w-full border p-4 shadow-sm rounded-none overflow-x-auto",
                    isDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-white border-[#d4d4d4]"
                  )}>
                    
                    {/* Pipeline Visual com Ícones */}
                    <div className="min-w-full">
                      <PipelineTimeline 
                      columns={pipelineSteps.map(step => ({
                        id: step.id,
                        name: step.name,
                        color: step.color,
                        icon: step.icon,
                        isActive: step.isActive
                      }))}
                      currentColumnId={selectedColumnId}
                      className="pt-12 pb-[82px]"
                      isDarkMode={isDarkMode}
                      onStepClick={async (newColumnId) => {
                        if (newColumnId === selectedColumnId || !selectedCardId) return;
                        
                        try {
                          const { error } = await supabase
                            .from('pipeline_cards')
                            .update({ column_id: newColumnId })
                            .eq('id', selectedCardId);

                          if (error) throw error;

                          setSelectedColumnId(newColumnId);
                          toast({
                            title: "Etapa atualizada",
                            description: "O negócio foi movido para a nova etapa.",
                          });
                          
                          fetchCardData();
                          refreshCurrentPipeline?.();
                        } catch (error) {
                          console.error('Erro ao mover negócio:', error);
                          toast({
                            title: "Erro",
                            description: "Não foi possível mover o negócio.",
                            variant: "destructive"
                          });
                        }
                      }}
                    />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className={cn("text-sm", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                      Nenhuma coluna encontrada no pipeline
                    </p>
                  </div>
                )}
              </div>

            </div>}

          {activeTab === "atividades" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Histórico de Atividades */}
                <div className="space-y-4">
                  <div
                    className={cn(
                      "flex items-center gap-3 border p-3 rounded-none",
                      isDarkMode ? "bg-[#1f1f1f] border-gray-700" : "bg-[#f0f0f0] border-[#d4d4d4]"
                    )}
                  >
                    <h3 className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-gray-800")}>
                      Histórico de Atividades
                    </h3>
                    
                  </div>
                  
                  {pendingActivities.length > 0 ? <div className="space-y-3">
                      {pendingActivities.map(activity => (
                        <ActivityItem
                          key={activity.id}
                          activity={activity}
                          isDarkMode={isDarkMode}
                          contactId={contactId}
                          onComplete={handleCompleteActivity}
                          onUpdate={fetchActivities}
                          onAttachmentClick={setSelectedAttachment}
                          onDelete={handleRequestDeleteActivity}
                        />
                      ))}
                    </div> : <div className={cn("text-center py-8 border rounded-none", isDarkMode ? "bg-[#1b1b1b] border-gray-700 text-gray-400" : "bg-white border-[#d4d4d4] text-gray-500")}>
                      <p className="text-sm">Nenhuma atividade pendente encontrada</p>
                    </div>}
                </div>

                {/* Formulário Criar Atividade - Integrado */}
                <div className="space-y-4">
                  <h3
                    className={cn(
                      "text-sm font-bold mb-4 border p-3 rounded-none",
                      isDarkMode ? "text-white bg-[#1f1f1f] border-gray-700" : "text-gray-800 bg-[#f0f0f0] border-[#d4d4d4]"
                    )}
                  >
                    Criar atividade
                  </h3>
                  
                  <div
                    className={cn(
                      "space-y-4 p-4 border shadow-sm rounded-none",
                      isDarkMode ? "bg-[#121212] border-gray-700" : "bg-white border-[#d4d4d4]"
                    )}
                  >
                  {/* Tipo */}
                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Tipo
                    </label>
                    <Select value={activityForm.type} onValueChange={(value) => setActivityForm({...activityForm, type: value})}>
                      <SelectTrigger className={cn("w-full h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const activityTypes = [
                              { value: "Lembrete", label: "Lembrete", icon: Clock },
                              { value: "Mensagem", label: "Mensagem", icon: MessageSquare },
                              { value: "Ligação", label: "Ligação", icon: Phone },
                              { value: "Ligação Agendada", label: "Ligação Agendada", icon: Phone },
                              { value: "Reunião", label: "Reunião", icon: User },
                              { value: "Agendamento", label: "Agendamento", icon: CalendarIcon },
                              { value: "Comentários", label: "Observações", icon: MessageCircle },
                              { value: "Proposta enviada", label: "Proposta enviada", icon: FileText },
                              { value: "Venda realizada", label: "Venda realizada", icon: DollarSign },
                            ];
                            const selectedType = activityTypes.find(t => t.value === activityForm.type);
                            const Icon = selectedType?.icon || Clock;
                            return (
                              <>
                                <Icon className="w-3.5 h-3.5" />
                                <span>{selectedType?.label || activityForm.type}</span>
                              </>
                            );
                          })()}
                        </div>
                      </SelectTrigger>
                      <SelectContent className={cn("rounded-none border-gray-300", isDarkMode && "border-gray-600 bg-[#1b1b1b] text-gray-100")}>
                        {[
                          { value: "Lembrete", label: "Lembrete", icon: Clock },
                          { value: "Mensagem", label: "Mensagem", icon: MessageSquare },
                          { value: "Ligação", label: "Ligação", icon: Phone },
                          { value: "Ligação Agendada", label: "Ligação Agendada", icon: Phone },
                          { value: "Reunião", label: "Reunião", icon: User },
                          { value: "Agendamento", label: "Agendamento", icon: CalendarIcon },
                          { value: "Comentários", label: "Observações", icon: MessageCircle },
                          { value: "Proposta enviada", label: "Proposta enviada", icon: FileText },
                          { value: "Venda realizada", label: "Venda realizada", icon: DollarSign },
                        ].map((type) => {
                          const Icon = type.icon;
                          return (
                            <SelectItem
                              key={type.value}
                              value={type.value}
                              className="text-xs cursor-pointer focus:bg-gray-100 dark:focus:bg-[#2a2a2a]"
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5" />
                                <span>{type.label}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Responsável */}
                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      Responsável
                    </label>
                    <Select value={activityForm.responsibleId} onValueChange={(value) => setActivityForm({...activityForm, responsibleId: value})}>
                      <SelectTrigger className={cn("w-full h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")}>
                        <SelectValue placeholder={isLoadingUsers ? "Carregando usuários..." : "Selecione um responsável"} />
                      </SelectTrigger>
                      <SelectContent className={cn("rounded-none border-gray-300", isDarkMode && "border-gray-600 bg-[#1b1b1b] text-gray-100")}>
                        {users.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.id}
                            className="text-xs cursor-pointer focus:bg-gray-100 dark:focus:bg-[#2a2a2a]"
                          >
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Assunto - não mostrar para comentários */}
                  {activityForm.type !== "Comentários" && (
                    <div className="space-y-2">
                      <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                        Assunto
                      </label>
                      <Input 
                        placeholder={activityForm.type} 
                        value={activityForm.subject}
                        onChange={(e) => setActivityForm({...activityForm, subject: e.target.value})}
                        className={cn("h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
                      />
                    </div>
                  )}

                  {/* Data e Duração em linha - não mostrar para comentários */}
                  {activityForm.type !== "Comentários" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                          Agendar para
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className={cn("w-full justify-start text-left font-normal h-8 text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white hover:bg-gray-700" : "bg-white")}
                              onClick={handleDateTimeClick}
                            >
                              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                              {selectedDate && selectedTime ? 
                                `${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} ${selectedTime}` : 
                                "Selecionar data e hora"
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className={cn("w-auto p-0 rounded-none border-gray-300", isDarkMode && "border-gray-600 bg-[#1b1b1b]")}
                            align="start"
                          >
                            <Calendar 
                              mode="single" 
                              selected={selectedDate} 
                              onSelect={handleDateSelect} 
                              initialFocus 
                              className="pointer-events-auto rounded-none" 
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {/* Upload de arquivo - não mostrar para comentários */}
                  {activityForm.type !== "Comentários" && (
                    <div className="space-y-2">
                      <div className={cn("border border-dashed rounded-none p-4 text-center cursor-pointer transition-colors", isDarkMode ? "border-gray-600 hover:border-gray-500 bg-[#1f1f1f]" : "border-gray-300 hover:border-gray-400 bg-gray-50")}>
                        {attachedFile ? (
                          <div className="flex items-center justify-between">
                            <span className={cn("text-xs", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                              {attachedFile.name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={removeFile}
                              className={cn("h-6 w-6 p-0 rounded-none hover:bg-gray-100", isDarkMode && "hover:bg-gray-700 text-gray-200")}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              className="hidden"
                              accept="*/*"
                            />
                            <Upload className={cn("w-6 h-6 mx-auto mb-2", isDarkMode ? "text-gray-400" : "text-gray-500")} />
                            <p className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-600")}>
                              Clique aqui ou arraste o documento a ser salvo
                            </p>
                          </label>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Descrição - obrigatória para comentários */}
                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                      {activityForm.type === "Comentários" ? "Observação *" : "Descrição"}
                    </label>
                    <Textarea 
                      placeholder={activityForm.type === "Comentários" ? "Digite a observação..." : "Descrição"} 
                      rows={4} 
                      value={activityForm.description}
                      onChange={(e) => setActivityForm({...activityForm, description: e.target.value})}
                      className={cn("text-xs rounded-none border-gray-300", isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white")} 
                    />
                  </div>

                  {/* Botão Criar Atividade */}
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs rounded-none font-medium shadow-sm" 
                    onClick={handleCreateActivity} 
                    disabled={!contactId || isCreatingActivity}
                  >
                    {isCreatingActivity ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendário diário de atividades */}
            <div className={cn(
              "w-full border p-4 rounded-none flex flex-col",
              isDarkMode ? "bg-[#121212] border-gray-700 text-gray-100" : "bg-white border-[#d4d4d4] text-gray-900"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">
                    {format(selectedCalendarDate, "EEEE, 'de' MMMM", { locale: ptBR })}
                  </h3>
                  <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                    {format(selectedCalendarDate, "dd", { locale: ptBR })}°
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
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
                    className="h-7 w-7"
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

              <div className="relative flex-1 overflow-hidden" style={{ minHeight: '560px' }}>
                <div className="relative h-full">
                  {/* Linhas de hora */}
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i;
                    const hourPosition = (hour / 23) * 100;
                    return (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 flex items-start"
                        style={{ top: `${hourPosition}%` }}
                      >
                        <div className={cn("w-12 text-[11px] mr-2 mt-0.5 font-normal", isDarkMode ? "text-gray-500" : "text-gray-400")}>
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className={cn("flex-1 border-t", isDarkMode ? "border-gray-700" : "border-gray-200")}></div>
                      </div>
                    );
                  })}

                  {/* Linha do tempo atual */}
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
                          <span className="w-12 text-[11px] font-medium text-red-600 dark:text-red-400 mr-2 whitespace-nowrap">
                            {format(now, "HH:mm")}
                          </span>
                          <div className="flex-1 h-0.5 bg-red-600 dark:bg-red-400"></div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Atividades do dia */}
                  <div className="absolute left-14 right-0" style={{ top: 0, bottom: 0 }}>
                    {activitiesForSelectedDate.map(activity => {
                      const activityDate = new Date(activity.scheduled_for);
                      const startHour = activityDate.getHours();
                      const startMinute = activityDate.getMinutes();
                      const durationMinutes = activity.duration_minutes || activity.durationMinutes || 30;
                      const startTimeInMinutes = startHour * 60 + startMinute;
                      const totalMinutesInDay = 24 * 60;
                      const topPercent = (startTimeInMinutes / totalMinutesInDay) * 100;
                      const heightPercent = (durationMinutes / totalMinutesInDay) * 100;

                      const getActivityColor = () => {
                        if (activity.priority === 'alta') return 'bg-red-500 dark:bg-red-600';
                        if (activity.priority === 'baixa') return 'bg-green-500 dark:bg-green-600';
                        return 'bg-blue-500 dark:bg-blue-600';
                      };

                      return (
                        <div
                          key={activity.id}
                          className={cn(
                            "absolute left-0 right-2 rounded px-2 py-1 text-[11px] shadow-sm z-20 cursor-pointer hover:opacity-90 transition-opacity text-white",
                            getActivityColor()
                          )}
                          style={{
                            top: `${topPercent}%`,
                            height: `${Math.max(heightPercent, 1.5)}%`,
                            minHeight: '28px'
                          }}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span className="font-semibold truncate">{activity.subject || activity.type}</span>
                          </div>
                          <div className="text-[10px] opacity-90">
                            {format(activityDate, "HH:mm")} → {format(new Date(activityDate.getTime() + durationMinutes * 60000), "HH:mm")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {activeTab === "historico" && (
            <div className="space-y-6">
              <div
                className={cn(
                  "flex items-center justify-between border p-3 rounded-none",
                  isDarkMode ? "bg-[#1f1f1f] border-gray-700" : "bg-[#f0f0f0] border-[#d4d4d4]"
                )}
              >
                <h3 className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-gray-800")}>
                  Histórico de eventos
                </h3>
                
                {/* Filtro de eventos */}
                <Select value={historyFilter} onValueChange={handleHistoryFilterChange}>
                  <SelectTrigger className={cn("w-[220px] h-8 text-xs rounded-none border-gray-300 bg-white", isDarkMode && "bg-[#1b1b1b] border-gray-600 text-gray-100")}>
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent className={cn("rounded-none border-gray-300", isDarkMode && "border-gray-600 bg-[#1b1b1b] text-gray-100")}>
                    <SelectItem value="todos" className="text-xs cursor-pointer focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">Todos</SelectItem>
                    <SelectItem value="agent_activity" className="text-xs cursor-pointer focus:bg-gray-100">Evento de Agente IA</SelectItem>
                    <SelectItem value="user_assigned" className="text-xs cursor-pointer focus:bg-gray-100">Conversa Vinculada</SelectItem>
                    <SelectItem value="queue_transfer" className="text-xs cursor-pointer focus:bg-gray-100">Transferência de Fila</SelectItem>
                    <SelectItem value="pipeline_transfer" className="text-xs cursor-pointer focus:bg-gray-100">Transferência de Pipeline</SelectItem>
                    <SelectItem value="column_transfer" className="text-xs cursor-pointer focus:bg-gray-100">Transferência de Etapa</SelectItem>
                    <SelectItem value="activity_lembrete_created" className="text-xs cursor-pointer focus:bg-gray-100">Lembretes Criados</SelectItem>
                    <SelectItem value="activity_lembrete_completed" className="text-xs cursor-pointer focus:bg-gray-100">Lembretes Concluídos</SelectItem>
                    <SelectItem value="activity_mensagem_created" className="text-xs cursor-pointer focus:bg-gray-100">Mensagens Criadas</SelectItem>
                    <SelectItem value="activity_mensagem_completed" className="text-xs cursor-pointer focus:bg-gray-100">Mensagens Concluídas</SelectItem>
                    <SelectItem value="activity_ligacao_created" className="text-xs cursor-pointer focus:bg-gray-100">Ligações Criadas</SelectItem>
                    <SelectItem value="activity_ligacao_completed" className="text-xs cursor-pointer focus:bg-gray-100">Ligações Concluídas</SelectItem>
                    <SelectItem value="activity_reuniao_created" className="text-xs cursor-pointer focus:bg-gray-100">Reuniões Criadas</SelectItem>
                    <SelectItem value="activity_reuniao_completed" className="text-xs cursor-pointer focus:bg-gray-100">Reuniões Concluídas</SelectItem>
                    <SelectItem value="activity_agendamento_created" className="text-xs cursor-pointer focus:bg-gray-100">Agendamentos Criados</SelectItem>
                    <SelectItem value="activity_agendamento_completed" className="text-xs cursor-pointer focus:bg-gray-100">Agendamentos Concluídos</SelectItem>
                    <SelectItem value="tag" className="text-xs cursor-pointer focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Timeline de eventos - Estilo Clean */}
              {(isInitialLoading || isLoadingHistory) ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={`history-skeleton-${index}`} className="relative">
                      <div className="flex gap-3 pb-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : fullHistory.length > 0 ? (
                (() => {
                  const filteredHistory = fullHistory.filter(event => {
                    if (historyFilter === "todos") return true;
                    
                    // Para filtros de atividades com ação específica (created/completed)
                    if (historyFilter.includes('_created') || historyFilter.includes('_completed')) {
                      const [activityType, action] = historyFilter.split('_').slice(-2);
                      const typePrefix = historyFilter.replace(`_${action}`, '');
                      return event.type === typePrefix && event.action === action;
                    }
                    
                    // Para outros filtros
                    return event.type === historyFilter;
                  });
                  const orderedHistory = filteredHistory
                    .slice()
                    .sort((a, b) => {
                      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                      if (aTime !== bTime) {
                        return bTime - aTime;
                      }
                      return a.id.localeCompare(b.id);
                    });
                  const visibleHistory = orderedHistory.slice(0, historyDisplayCount);
                  
                  return (
                    <div className="space-y-0">
                      {visibleHistory.map((event, index) => {
                        const eventMetadata = (event.metadata as any) || {};
                        const eventTitle =
                          (typeof eventMetadata.activity_type === 'string' && eventMetadata.activity_type.trim().length > 0
                            ? eventMetadata.activity_type
                            : undefined) ||
                          eventMetadata.event_title ||
                          (event.type === 'agent_activity'
                            ? 'Agente de IA'
                            : event.type === 'user_assigned'
                              ? event.action === 'queue_transfer'
                                ? 'Transferência de Fila'
                                : event.action === 'transfer'
                                  ? 'Conversa Transferida'
                                  : 'Conversa Vinculada'
                              : event.type === 'queue_transfer'
                                ? 'Transferência de Fila'
                                : event.type === 'pipeline_transfer'
                                  ? 'Transferência de Pipeline'
                                  : event.type === 'column_transfer'
                                    ? 'Transferência de Etapa'
                                    : 'Evento');
                        // Ícone baseado no tipo de evento
                        let Icon = MessageSquare;
                        let iconBgColor = "bg-yellow-400";
                        let iconColor = "text-gray-900";
                        
                        if (event.type === 'agent_activity') {
                          Icon = Bot;
                          iconBgColor = "bg-yellow-400";
                        } else if (event.type === 'pipeline_transfer') {
                          Icon = ArrowRightLeft;
                          iconBgColor = "bg-amber-500";
                        } else if (event.type === 'user_assigned') {
                          Icon = UserCheck;
                          iconBgColor = "bg-yellow-400";
                        } else if (event.type === 'queue_transfer') {
                          Icon = Users;
                          iconBgColor = "bg-yellow-400";
                        } else if (event.type === 'column_transfer') {
                          Icon = ArrowRightLeft;
                          iconBgColor = "bg-yellow-400";
                        } else if (event.type === 'activity_lembrete') {
                          Icon = Clock;
                          iconBgColor = "bg-blue-400";
                        } else if (event.type === 'activity_mensagem') {
                          Icon = MessageSquare;
                          iconBgColor = "bg-green-400";
                        } else if (event.type === 'activity_ligacao') {
                          Icon = Phone;
                          iconBgColor = "bg-indigo-400";
                        } else if (event.type === 'activity_reuniao') {
                          Icon = CalendarIconLucide;
                          iconBgColor = "bg-pink-400";
                        } else if (event.type === 'activity_agendamento') {
                          Icon = CalendarClock;
                          iconBgColor = "bg-orange-400";
                        } else if (event.type === 'tag') {
                          Icon = TagIcon;
                          iconBgColor = "bg-purple-400";
                        }

                        return (
                          <div key={event.id} className="relative">
                            {/* Linha vertical conectando os eventos */}
                            {index < visibleHistory.length - 1 && (
                              <div 
                                className={cn(
                                  "absolute left-[19px] top-[40px] w-[2px] h-[calc(100%+0px)]",
                                  isDarkMode ? "bg-gray-700" : "bg-gray-200"
                                )}
                              />
                            )}
                            
                            <div className="flex gap-3 pb-4">
                              {/* Ícone circular */}
                              <div className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10",
                                iconBgColor
                              )}>
                                <Icon className={cn("w-5 h-5", iconColor)} />
                              </div>
                              
                              {/* Conteúdo do evento */}
                              <div className={cn(
                                "flex-1 rounded-none p-4 border border-[#d4d4d4]",
                                isDarkMode ? "bg-[#1f1f1f] border-gray-700" : "bg-white border-gray-200 shadow-sm"
                              )}>
                                {/* Título do evento */}
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className={cn(
                                    "font-bold text-sm",
                                    isDarkMode ? "text-white" : "text-gray-900"
                                  )}>
                                    {eventTitle}
                                  </h4>
                                </div>
                                
                                {/* Descrição */}
                                <div className={cn(
                                  "text-xs mb-2",
                                  isDarkMode ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {event.description.split(/(\*\*.*?\*\*)/).map((part, i) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                      return <strong key={i}>{part.slice(2, -2)}</strong>;
                                    }
                                    return <span key={i}>{part}</span>;
                                  })}
                                </div>
                                
                                {/* Data e hora */}
                                <div className="flex items-center gap-2">
                                  <Clock className={cn(
                                    "w-3 h-3",
                                    isDarkMode ? "text-gray-500" : "text-gray-400"
                                  )} />
                                  <span className={cn(
                                    "text-[10px]",
                                    isDarkMode ? "text-gray-500" : "text-gray-500"
                                  )}>
                                    {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                </div>
                                {String(event.type || "").startsWith("activity_") && eventMetadata?.scheduled_for && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <CalendarIconLucide className={cn(
                                      "w-3 h-3",
                                      isDarkMode ? "text-gray-500" : "text-gray-400"
                                    )} />
                                    <span className={cn(
                                      "text-[10px]",
                                      isDarkMode ? "text-gray-500" : "text-gray-500"
                                    )}>
                                      Agendado para:{" "}
                                      {format(new Date(eventMetadata.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                )}

                                {(event.user_name || eventMetadata.changed_by_name) && (
                                  <div className={cn(
                                    "mt-2 text-[10px]",
                                    isDarkMode ? "text-gray-500" : "text-gray-500"
                                  )}>
                                    Atualizado por: {eventMetadata.changed_by_name || event.user_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {orderedHistory.length > historyDisplayCount && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setHistoryDisplayCount((prev) => prev + 5)}
                            className={cn("rounded-none", isDarkMode ? "border-yellow-600 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400" : "border-yellow-500 text-yellow-600 hover:bg-yellow-50")}
                          >
                            Carregar mais
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className={cn("text-center py-10", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                  <p>Nenhum histórico encontrado</p>
                </div>
              )}
            </div>
          )}

          {isInitialLoading ? null : activeTab === "historico-atividades" && <div className="space-y-6">
              <div
                className={cn(
                  "flex items-center gap-3 border p-3 rounded-none",
                  isDarkMode ? "bg-[#1f1f1f] border-gray-700" : "bg-[#f0f0f0] border-[#d4d4d4]"
                )}
              >
                <h3 className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-gray-800")}>
                  Histórico de Atividades
                </h3>
              </div>
              
              {completedActivitiesWithComments.length > 0 ? (
                <div className="space-y-3">
                  {completedActivitiesWithComments.map(item => (
                    <div key={item.id} className={cn("border rounded-none p-3", isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-[#d4d4d4] bg-white shadow-sm")}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs rounded-none border-gray-300">
                          {item.activity_type}
                        </Badge>
                        {item.type === 'activity' && (
                          <Badge className="bg-green-100 text-green-800 text-xs rounded-none border-green-200">
                            Concluída
                          </Badge>
                        )}
                        <span className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                          {item.responsible_name}
                        </span>
                      </div>
                      <h4 className={cn("font-bold text-sm", isDarkMode ? "text-white" : "text-gray-900")}>
                        {item.subject}
                      </h4>
                      <div className={cn("text-xs mb-2", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                        <p className="mb-0.5">Agendado para:</p>
                        <p className="mb-1">{format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                        {item.type === 'activity' && item.completed_at && (
                          <>
                            <p className="mb-0.5">Concluído em:</p>
                            <p>{format(new Date(item.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                          </>
                        )}
                      </div>
                      
                      {/* Descrição/Comentário */}
                      {item.description && (
                        <p className={cn("text-xs mt-2 whitespace-pre-wrap", isDarkMode ? "text-gray-300" : "text-gray-700")}>
                          {item.description}
                        </p>
                      )}
                      
                      {/* Anexos de atividades */}
                      {item.type === 'activity' && item.attachment_url && (
                        <div className="mt-3">
                          {(() => {
                            const fileName = item.attachment_name || item.attachment_url || "";
                            const isImg = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
                            
                            if (isImg) {
                              return (
                                <img 
                                  src={item.attachment_url} 
                                  alt={item.attachment_name || "Anexo"}
                                  className={cn(
                                    "w-20 h-20 object-cover rounded-none cursor-pointer hover:opacity-80 transition-opacity border",
                                    isDarkMode ? "border-gray-700" : "border-[#d4d4d4]"
                                  )}
                                  onClick={() => setSelectedAttachment({ 
                                    url: item.attachment_url!, 
                                    name: item.attachment_name || "Anexo" 
                                  })}
                                />
                              );
                            }
                            
                            return (
                              <div 
                                className={cn(
                                  "w-full sm:w-64 p-2 rounded-none border flex items-center gap-3 cursor-pointer transition-colors",
                                  isDarkMode ? "border-gray-700 bg-gray-800/50 hover:bg-gray-800" : "border-[#d4d4d4] bg-gray-50 hover:bg-gray-100"
                                )}
                                onClick={() => window.open(item.attachment_url!, '_blank')}
                              >
                                {renderFileBadge(item.attachment_name || item.attachment_url || "file")}
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-xs font-medium truncate", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                                    {item.attachment_name || "Anexo"}
                                  </p>
                                  <p className={cn("text-[10px] truncate", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                                    Clique para visualizar
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Anexos de comentários */}
                      {item.type === 'comment' && item.file_url && (
                        <div className="mt-3">
                          {(() => {
                            const fileName = item.file_name || item.file_url || "";
                            const isImg = item.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
                            
                            if (isImg) {
                              return (
                                <img 
                                  src={item.file_url} 
                                  alt={item.file_name || "Anexo"}
                                  className={cn(
                                    "w-20 h-20 object-cover rounded-none cursor-pointer hover:opacity-80 transition-opacity border",
                                    isDarkMode ? "border-gray-700" : "border-[#d4d4d4]"
                                  )}
                                  onClick={() => setSelectedAttachment({ 
                                    url: item.file_url!, 
                                    name: item.file_name || "Anexo" 
                                  })}
                                />
                              );
                            }
                            
                            return (
                              <div 
                                className={cn(
                                  "w-full sm:w-64 p-2 rounded-none border flex items-center gap-3 cursor-pointer transition-colors",
                                  isDarkMode ? "border-gray-700 bg-gray-800/50 hover:bg-gray-800" : "border-[#d4d4d4] bg-gray-50 hover:bg-gray-100"
                                )}
                                onClick={() => window.open(item.file_url!, '_blank')}
                              >
                                {renderFileBadge(item.file_name || item.file_url || "file")}
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-xs font-medium truncate", isDarkMode ? "text-gray-200" : "text-gray-700")}>
                                    {item.file_name || "Anexo"}
                                  </p>
                                  <p className={cn("text-[10px] truncate", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                                    Clique para visualizar
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "text-center py-8 rounded-none border",
                  isDarkMode ? "bg-[#1f1f1f] border-gray-700 text-gray-400" : "bg-white border-[#d4d4d4] text-gray-500"
                )}>
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma atividade concluída</p>
                </div>
              )}
            </div>}

          {isInitialLoading ? null : activeTab === "contato" && <div className="space-y-6">
              {/* Informações de Contato */}
              <div className={cn("border rounded-none", isDarkMode ? "border-gray-700 bg-[#101010]" : "border-[#d4d4d4] bg-white")}>
                <div className={cn("border-b p-3", isDarkMode ? "bg-[#1b1b1b] border-gray-700" : "bg-[#f0f0f0] border-[#d4d4d4]")}>
                  <h3 className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-gray-800")}>
                    Informações de Contato
                  </h3>
                </div>
                
                {contactData ? (
                  <div className="p-0">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        {/* Nome */}
                        {contactData.name && (
                          <tr>
                            <td className={cn("font-bold p-2 border-b border-r w-32 align-top", isDarkMode ? "bg-[#2d2d2d] text-gray-300 border-gray-700" : "bg-gray-50 text-gray-700 border-[#d4d4d4]")}>
                              Nome
                            </td>
                            <td className={cn("p-2 border-b align-top", isDarkMode ? "text-gray-300 border-gray-700" : "text-gray-800 border-[#d4d4d4]")}>
                              {contactData.name}
                            </td>
                          </tr>
                        )}

                        {/* Email */}
                        {contactData.email && (
                          <tr>
                            <td className={cn("font-bold p-2 border-b border-r w-32 align-top", isDarkMode ? "bg-[#2d2d2d] text-gray-300 border-gray-700" : "bg-gray-50 text-gray-700 border-[#d4d4d4]")}>
                              E-mail
                            </td>
                            <td className={cn("p-2 border-b align-top", isDarkMode ? "text-gray-300 border-gray-700" : "text-gray-800 border-[#d4d4d4]")}>
                              {contactData.email}
                            </td>
                          </tr>
                        )}

                        {/* Telefone */}
                        {contactData.phone && (
                          <tr>
                            <td className={cn("font-bold p-2 border-b border-r w-32 align-top", isDarkMode ? "bg-[#2d2d2d] text-gray-300 border-gray-700" : "bg-gray-50 text-gray-700 border-[#d4d4d4]")}>
                              Telefone
                            </td>
                            <td className={cn("p-2 border-b align-top", isDarkMode ? "text-gray-300 border-gray-700" : "text-gray-800 border-[#d4d4d4]")}>
                              {(() => {
                                const phone = contactData.phone;
                                if (phone.startsWith('55')) {
                                  return phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 $1 $2-$3');
                                }
                                return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
                              })()}
                            </td>
                          </tr>
                        )}
                        
                        {/* Campos extras */}
                        {extraFields.map((field, index) => {
                          if (!field.field_name?.trim() || !field.field_value?.trim()) {
                            return null;
                          }
                          
                          return (
                            <tr key={field.id || index}>
                              <td className={cn("font-bold p-2 border-b border-r w-32 align-top", isDarkMode ? "bg-[#2d2d2d] text-gray-300 border-gray-700" : "bg-gray-50 text-gray-700 border-[#d4d4d4]")}>
                                {field.field_name}
                              </td>
                              <td className={cn("p-2 border-b align-top", isDarkMode ? "text-gray-300 border-gray-700" : "text-gray-800 border-[#d4d4d4]")}>
                                {field.field_value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex justify-center py-8">
                    <div className={cn("text-center text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>
                      Carregando informações do contato...
                    </div>
                  </div>
                )}
              </div>
            </div>}
        </div>

        {/* Modais */}
        <AddTagModal isOpen={showAddTagModal} onClose={() => setShowAddTagModal(false)} contactId={contactId} onTagAdded={handleTagAdded} isDarkMode={isDarkMode} />
        
        <AttachmentPreviewModal
          isOpen={!!selectedAttachment}
          onClose={() => setSelectedAttachment(null)}
          attachment={selectedAttachment}
        />

        <CreateActivityModal 
          isOpen={showCreateActivityModal} 
          onClose={() => setShowCreateActivityModal(false)} 
          contactId={contactId} 
          onActivityCreated={handleActivityCreated} 
          isDarkMode={isDarkMode}
          pipelineCardId={selectedCardId} 
        />
      </DialogContent>

      {/* Modais de seleção de hora e minuto */}
      <TimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        onTimeSelect={handleHourSelect}
        selectedHour={selectedHour}
        isDarkMode={isDarkMode}
      />
      
      <MinutePickerModal
        isOpen={showMinutePicker}
        onClose={() => setShowMinutePicker(false)}
        onMinuteSelect={handleMinuteSelect}
        selectedMinute={selectedMinute}
        isDarkMode={isDarkMode}
      />
      
      {/* Modal de Chat */}
      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => setIsChatModalOpen(false)}
        conversationId={conversationId}
        contactName={contactData?.name || dealName}
        contactPhone={contactData?.phone || contactNumber}
        contactAvatar={contactData?.profile_image_url || ""}
        contactId={contactId}
      />
    </Dialog>
    
    {/* Modal de confirmação para exclusão de atividade */}
    <AlertDialog 
      open={!!activityToDelete} 
      onOpenChange={(open) => {
        if (!open && !isDeletingActivity) {
          setActivityToDelete(null);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
          <AlertDialogDescription>
            {activityToDelete
              ? `A atividade "${activityToDelete.subject || 'Sem assunto'}" será removida permanentemente. Deseja continuar?`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingActivity}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDeleteActivity}
            disabled={isDeletingActivity}
          >
            {isDeletingActivity ? 'Excluindo...' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Modal de marcar como perdido com motivo */}
    <MarkAsLostModal
      open={isMarkAsLostModalOpen}
      onOpenChange={(open) => {
        setIsMarkAsLostModalOpen(open);
        if (!open) {
          setConfirmLossAction(null);
        }
      }}
      onConfirm={handleMarkAsLost}
      workspaceId={workspaceId}
      isLoading={isMarkingAsLost}
    />

    <DealStatusMoveModal
      open={dealStatusMoveOpen}
      onOpenChange={setDealStatusMoveOpen}
      mode={dealStatusMoveMode}
      workspaceId={workspaceId}
      pipelines={(availablePipelines || []).map((p) => ({ id: p.id, name: p.name }))}
      defaultPipelineId={selectedPipelineId || ""}
      defaultColumnId={selectedColumnId || ""}
      isLoading={isDealStatusMoveLoading}
      onConfirm={handleDealStatusMoveConfirm}
    />
    </>
  );
}