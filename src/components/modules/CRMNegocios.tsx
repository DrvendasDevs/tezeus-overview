import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { differenceInHours, differenceInDays, isAfter, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useParams, useNavigate } from 'react-router-dom';
import { ConnectionBadge } from "@/components/chat/ConnectionBadge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter, DragOverEvent, Active, Over, rectIntersection, pointerWithin, CollisionDetection } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Search, Plus, ListFilter, Eye, MoreHorizontal, Phone, MessageCircle, MessageSquare, Calendar, Clock, DollarSign, EyeOff, Folder, AlertTriangle, AlertCircle, Check, MoreVertical, Edit, Download, ArrowRight, X, Tag, Bot, Zap, ChevronLeft, ChevronRight, Menu, GripVertical, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { AddColumnModal } from "@/components/modals/AddColumnModal";
import { PipelineConfigModal } from "@/components/modals/PipelineConfigModal";
import { EditarColunaModal } from "@/components/modals/EditarColunaModal";
import { FilterModal } from "@/components/modals/FilterModal";
import { CriarPipelineModal } from "@/components/modals/CriarPipelineModal";
import { CriarNegocioModal } from "@/components/modals/CriarNegocioModal";
import { DealDetailsModal } from "@/components/modals/DealDetailsModal";
import { DealDetailsPage } from "@/pages/DealDetailsPage";
import { useAuth } from "@/hooks/useAuth";
import { ChatModal } from "@/components/modals/ChatModal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TransferirModal } from "@/components/modals/TransferirModal";
import { SetValueModal } from "@/components/modals/SetValueModal";
import { EditarContatoModal } from "@/components/modals/EditarContatoModal";
import { VincularProdutoModal } from "@/components/modals/VincularProdutoModal";
import { VincularResponsavelModal } from "@/components/modals/VincularResponsavelModal";
import { DeleteDealModal } from "@/components/modals/DeleteDealModal";
import { ExportCSVModal } from "@/components/modals/ExportCSVModal";
import { usePipelinesContext, PipelinesProvider } from "@/contexts/PipelinesContext";
import { usePipelineActiveUsers } from "@/hooks/usePipelineActiveUsers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useContactTags } from "@/hooks/useContactTags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { ChangeAgentModal } from "@/components/modals/ChangeAgentModal";
import { useWorkspaceAgent } from "@/hooks/useWorkspaceAgent";
import { getInitials as getAvatarInitials } from "@/lib/avatarUtils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRealtimeNotifications } from "@/components/RealtimeNotificationProvider";

type ResponsibleFilterValue = 'ALL' | 'UNASSIGNED' | (string & {});

const IS_DEV = import.meta.env.DEV;
const devLog = (...args: any[]) => {
  if (IS_DEV) console.log(...args);
};

// Componente de Badge do Agente
function AgentBadge({ conversationId, isDarkMode }: { conversationId: string; isDarkMode: boolean }) {
  const { agent, isLoading } = useWorkspaceAgent(conversationId);

  devLog('🤖 [AgentBadge] Renderizando:', { conversationId, hasAgent: !!agent, isLoading });
  
  if (isLoading) return null;
  if (!agent) return null;

  const displayName =
    agent.name && agent.name.length > 8
      ? `${agent.name.slice(0, 8)}...`
      : agent.name;
  
  // Ajuste de cor para claro/escuro
  const bg = isDarkMode ? "#5e5b5b" : "rgb(217, 217, 217)";
  const border = isDarkMode ? "#5e5b5b" : "rgb(217, 217, 217)";
  const text = isDarkMode ? "#ffffff" : "#2d2d2d";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-medium"
          style={{
            backgroundColor: bg,
            color: text,
            borderColor: border,
          }}
        >
          <Bot className="h-3 w-3" />
          <span className="text-[10px] font-medium">{displayName}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="z-[9999] bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-md">
        <p className="text-xs">Agente IA ativo: {agent.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Componente Sortable do Card com Drag & Drop e Selection
// Interface compatível com o componente existente
interface Deal {
  id: string;
  name: string;
  value: number;
  stage: string;
  responsible: string;
  responsible_user_id?: string;
  responsible_avatar?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status?: string;
  product?: string;
  product_name?: string;
  product_id?: string;
  product_value?: number | null;
  hasProduct?: boolean;
  lastContact?: string;
  created_at?: string;
  contact?: {
    id: string;
    name: string;
    phone?: string;
    profile_image_url?: string;
    contact_tags?: Array<{
      tag_id: string;
      tags: {
        id: string;
        name: string;
        color: string;
      };
    }>;
  };
  conversation?: {
    id: string;
    connection_id?: string;
    agente_ativo?: boolean;
    unread_count?: number;
    connection?: {
      id: string;
      instance_name: string;
      phone_number?: string;
      status: string;
      metadata?: any;
    };
    queue?: {
      id: string;
      name: string;
      ai_agent?: {
        id: string;
        name: string;
      };
    };
  };
}
interface DroppableColumnProps {
  children: React.ReactNode;
  id: string;
}
function DroppableColumn({
  children,
  id
}: DroppableColumnProps) {
  const {
    isOver,
    setNodeRef
  } = useDroppable({
    id: id
  });
  return <div ref={setNodeRef} className="h-full">
      {children}
    </div>;
}
interface DraggableDealProps {
  deal: Deal;
  isDarkMode?: boolean;
  onClick: () => void;
  columnColor?: string;
  onChatClick?: (deal: Deal) => void;
  onValueClick?: (deal: Deal) => void;
  onEditPendingTask?: (activityId: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onEditContact?: (contactId: string) => void;
  onLinkProduct?: (cardId: string, currentValue: number, currentProductId?: string | null) => void;
  onDeleteCard?: (cardId: string) => void;
  onOpenTransferModal?: (cardId: string) => void;
  onVincularResponsavel?: (cardId: string, conversationId?: string, currentResponsibleId?: string, contactId?: string) => void;
  onConfigureAgent?: (conversationId: string) => void;
  workspaceId?: string | null;
  onProductValueLoaded?: (cardId: string, value: number) => void;
}
const DraggableDeal = React.memo(function DraggableDeal({
  deal,
  isDarkMode = false,
  onClick,
  columnColor = '#6b7280',
  onChatClick,
  onValueClick,
  onEditPendingTask,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  onEditContact,
  onLinkProduct,
  onDeleteCard,
  onOpenTransferModal,
  onVincularResponsavel,
  onConfigureAgent,
  workspaceId,
  onProductValueLoaded
}: DraggableDealProps) {
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    toast
  } = useToast();
  const resolvedWorkspaceId = workspaceId ?? selectedWorkspace?.workspace_id ?? null;
  const [isTagPopoverOpen, setIsTagPopoverOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [productPrice, setProductPrice] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [fetchedProductName, setFetchedProductName] = useState<string | null>(null);
  
  // Buscar preço TOTAL dos produtos vinculados via Edge Function (bypass RLS)
  useEffect(() => {
    const fetchProductsTotal = async () => {
      if (!deal.id) return;
      
      try {
        // Usar Edge Function para bypass de RLS
        const { data, error } = await supabase.functions.invoke('get-card-products', {
          body: { cardId: deal.id }
        });
        
        if (error) {
          console.error('❌ [DraggableDeal] Erro na Edge Function:', error);
          setProductPrice(null);
          setProductCount(0);
          setFetchedProductName(null);
          return;
        }
        
        if (data?.success && data.count > 0) {
          const totalValue = data.totalValue ?? 0;
          setProductCount(data.count);
          setProductPrice(totalValue);
          
          // Reportar valor para o componente pai (para cálculo de totais)
          onProductValueLoaded?.(deal.id, totalValue);
          
          // Nome do primeiro produto se houver apenas 1
          if (data.count === 1 && data.products[0]?.name) {
            setFetchedProductName(data.products[0].name);
          } else if (data.count > 1) {
            setFetchedProductName(null); // Vai mostrar "X produtos vinculados"
          } else {
            setFetchedProductName(null);
          }
        } else {
          setProductPrice(null);
          setProductCount(0);
          setFetchedProductName(null);
          // Reportar valor 0 para o componente pai
          onProductValueLoaded?.(deal.id, deal.value || 0);
        }
      } catch (error) {
        console.error('❌ [DraggableDeal] Exception ao buscar produtos:', error);
        setProductPrice(null);
        setProductCount(0);
        setFetchedProductName(null);
      }
    };
    
    // Sempre buscar produtos vinculados para este card
    fetchProductsTotal();
  }, [deal.id, deal.product_id, deal.product_name, deal.value, onProductValueLoaded]);
  
  const {
    contactTags,
    availableTags,
    addTagToContact,
    removeTagFromContact,
    getFilteredTags,
    refreshTags
  } = useContactTags(deal.contact?.id || null, resolvedWorkspaceId);
  
  // ✅ Contagem de não lidas: mesma fonte do sino (notifications agrupadas por conversa)
  const { notifications } = useRealtimeNotifications();
  const conversationIdForUnread = deal.conversation?.id || (deal as any).conversation_id || null;
  const unreadCount = useMemo(() => {
    const fromNotifications = conversationIdForUnread
      ? Math.max(
          Number(
            (notifications || []).find((n: any) => n.conversationId === conversationIdForUnread)
              ?.unreadCount ?? 0
          ),
          0
        )
      : 0;

    // Fallback: se ainda não tiver notificações carregadas, usar unread_count da conversa (se existir)
    const convUnreadRaw = (deal.conversation as any)?.unread_count;
    const fallback =
      typeof convUnreadRaw === 'number'
        ? convUnreadRaw
        : typeof convUnreadRaw === 'string'
          ? parseInt(convUnreadRaw) || 0
          : 0;

    return fromNotifications > 0 ? fromNotifications : Math.max(fallback, 0);
  }, [conversationIdForUnread, notifications, deal.conversation]);

  // Estado para tarefa pendente (alerta)
  const [pendingTask, setPendingTask] = useState<any>(null);
  const [isPendingTaskPopoverOpen, setIsPendingTaskPopoverOpen] = useState(false);

  // Buscar tarefa pendente mais urgente para este negócio
  useEffect(() => {
    if (!deal.id || !resolvedWorkspaceId) return;

    const fetchPendingTask = async () => {
      try {
        const { data, error } = await supabase
          .from('activities')
          .select('*')
          .eq('pipeline_card_id', deal.id)
          .eq('is_completed', false)
          .order('scheduled_for', { ascending: true })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          setPendingTask(data[0]);
        } else {
          setPendingTask(null);
        }
      } catch (error) {
        console.error('Erro ao buscar tarefa pendente:', error);
      }
    };

    fetchPendingTask();
    
    // Escutar mudanças em tempo real para atividades deste card
    const channel = supabase
      .channel(`activities-deal-${deal.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'activities', 
        filter: `pipeline_card_id=eq.${deal.id}` 
      }, () => {
        fetchPendingTask();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deal.id, resolvedWorkspaceId]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting
  } = useSortable({
    id: `card-${deal.id}`
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar tempo relativo de criação (ex: 4h, 1d)
  const formatTimeAgo = (createdAt?: string) => {
    if (!createdAt) return 'Data indisponível';
    const createdDate = new Date(createdAt);
    const hoursAgo = differenceInHours(new Date(), createdDate);

    if (hoursAgo < 24) {
      return `${Math.max(0, hoursAgo)}h`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      return `${daysAgo}d`;
    }
  };

  const responsibleName = deal.responsible?.trim() || "";
  const responsibleInitials = responsibleName ? getAvatarInitials(responsibleName) : "?";
  // Sempre usar cinza para a borda esquerda, mesma cor do topo da coluna
  // #d4d4d4 (light) ou gray-700 #374151 (dark) - EXATAMENTE a mesma cor
  const borderLeftColor = isDarkMode ? '#374151' : '#d4d4d4'; // Mesma cor do topo da coluna e scrollbar

  const cardStyle: React.CSSProperties = {
    ...style,
    borderLeftWidth: '4px',
    borderLeftColor: borderLeftColor, // Apenas a borda esquerda com cor cinza - mesma cor do topo da coluna (#d4d4d4 ou #374151)
    borderLeftStyle: 'solid'
  };

  const rootDragListeners = !isSelectionMode ? listeners : undefined;
  const dragHandleProps = rootDragListeners;

  // Nome/telefone exibido no card (limpa espaços e trata traço)
  const contactName = (deal.contact?.name || "").trim();
  const contactPhone = (deal.contact?.phone || "").trim();
  const displayContact =
    contactName && contactName !== "-" ? contactName : (contactPhone || "Sem contato");

  return (
      <div
        ref={setNodeRef}
        style={cardStyle}
        {...attributes}
        {...(rootDragListeners ?? {})}
        className={cn(
          "bg-white dark:bg-[#1b1b1b] border-l-4 shadow-sm rounded-none hover:shadow-md transition-all mb-1.5 md:mb-2 relative min-h-[85px] md:min-h-[95px] touch-none",
          !isSelectionMode && "cursor-pointer",
          isSelectionMode && "cursor-pointer hover:bg-accent/50 dark:hover:bg-[#2a2a2a]",
          isSelected && isSelectionMode && "ring-2 ring-primary bg-accent/30 dark:bg-primary/20"
        )}
        onClick={
          isSelectionMode
            ? e => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSelection?.();
              }
            : onClick
        }
      >
      <div className="p-1.5 md:p-2">
      {isSelectionMode && <div className="absolute top-2 right-2 z-10">
          <input type="checkbox" checked={isSelected} onChange={e => {
          e.stopPropagation();
          onToggleSelection?.();
        }} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} className="w-5 h-5 cursor-pointer accent-primary" />
        </div>}
      {/* Header apenas com nome */}
      <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
            {/* Nome do cliente */}
            <div
              className={cn(
                "flex items-center gap-1.5 flex-1 min-w-0"
              )}
            >
              <h3 className={cn("text-xs font-semibold whitespace-normal break-words", "text-foreground dark:text-gray-100")}>
                {displayContact || deal.name || 'Sem nome'}
              </h3>
            </div>
          </div>
        </div>

        {/* Footer com valor e ícones */}
        <div className={`flex flex-col items-start gap-1 pt-[1rem] border-t border-border/50 dark:border-gray-700/50`}>
          {(deal.product_name || fetchedProductName || productCount > 0) && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full" title={productCount > 1 ? `${productCount} produtos vinculados` : (fetchedProductName || deal.product_name || '')}>
              {productCount > 1 ? `${productCount} produtos vinculados` : (fetchedProductName || deal.product_name)}
            </span>
          )}
          <span className="text-[11px] font-semibold text-black dark:text-white flex-shrink-0">
            {`R$ ${((productPrice !== null ? productPrice : (typeof deal.value === 'number' ? deal.value : 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>

          <div className="flex items-center gap-2 w-full">
            {/* Grupo de ícones à esquerda */}
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
            <Button
              size="icon"
              variant="ghost"
              className={`h-5 w-5 p-0 hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-600 dark:hover:text-green-400 relative`}
              onPointerDown={e => e.stopPropagation()}
              onClick={async e => {
            e.stopPropagation();

            // Buscar conversa do contato antes de abrir o modal
            if (deal.contact?.id) {
              try {
                let query = supabase
                  .from('conversations')
                  .select('id')
                  .eq('contact_id', deal.contact.id)
                  .eq('status', 'open');

                if (resolvedWorkspaceId) {
                  query = query.eq('workspace_id', resolvedWorkspaceId);
                }

                const {
                  data: conversations,
                  error
                } = await query.limit(1);
                if (error) throw error;
                if (conversations && conversations.length > 0) {
                  // Anexar conversation_id ao deal antes de passar para o modal
                  const dealWithConversation = {
                    ...deal,
                    conversation_id: conversations[0].id,
                    conversation: {
                      id: conversations[0].id
                    }
                  };
                  onChatClick?.(dealWithConversation);
                } else {
                  console.warn('⚠️ Nenhuma conversa encontrada para o contato');
                  toast({
                    title: "Conversa não encontrada",
                    description: "Não há conversa ativa para este contato",
                    variant: "destructive"
                  });
                }
              } catch (error) {
                console.error('❌ Erro ao buscar conversa:', error);
                toast({
                  title: "Erro",
                  description: "Erro ao buscar conversa do contato",
                  variant: "destructive"
                });
              }
            } else {
              console.error('❌ Deal não tem contact_id');
            }
          }}>
              <MessageCircle className="w-3 h-3" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#1b1b1b]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            <Tooltip delayDuration={1000}>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={`h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400`} 
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                >
                  <Avatar className="w-6 h-6">
                    {deal.responsible_avatar ? <AvatarImage src={deal.responsible_avatar} alt={responsibleName || "Responsável"} /> : null}
                    <AvatarFallback className={`bg-muted dark:bg-gray-700 text-muted-foreground dark:text-gray-300 text-[10px] font-medium`}>
                      {responsibleInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-[99999] bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 px-2 py-1 text-[10px] font-medium border border-gray-200 dark:border-gray-700 shadow-lg" side="top">
                <p>{responsibleName ? responsibleName.split(' ')[0] : 'Sem responsável'}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip delayDuration={1000}>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={cn(
                    "h-5 w-5 p-0",
                    // ✅ Verde SOMENTE quando o agente está ativo nesta conversa
                    // (a fila pode ter ai_agent configurado mesmo com agente desativado)
                    !!deal.conversation?.agente_ativo
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-400"
                  )} 
                  onPointerDown={e => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (deal.conversation?.id && onConfigureAgent) {
                      onConfigureAgent(deal.conversation.id);
                    }
                  }}
                  type="button"
                >
                  <Bot className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-[99999] bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 px-2 py-1 text-[10px] font-medium border border-gray-200 dark:border-gray-700 shadow-lg" side="top">
                <p>
                  {deal.conversation?.agente_ativo
                    ? (deal.conversation?.queue?.ai_agent?.name || "Agente IA")
                    : "Sem agente ativo"}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Ícone de Alerta de Tarefa Pendente (sempre visível) */}
            {(() => {
              if (!pendingTask) {
                return (
                  <Tooltip delayDuration={500}>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("h-5 w-5 p-0 text-gray-400 dark:text-gray-500")}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        title="Não há tarefa criada"
                        type="button"
                        disabled
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent
                      className="z-[99999] bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 px-2 py-1 text-[10px] font-medium border border-gray-200 dark:border-gray-700 shadow-lg rounded-none"
                      side="top"
                    >
                      <p>Não há tarefa criada</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              const scheduledAt = new Date(pendingTask.scheduled_for);
              const now = new Date();

              // Diferença em dias (apenas para texto "Hoje/Amanhã/Em Xd")
              const taskDate = startOfDay(scheduledAt);
              const today = startOfDay(now);
              const daysDiff = differenceInDays(taskDate, today);

              // ✅ Regra solicitada (por tempo real):
              // - Verde: até 2 dias antes de vencer (ex.: Amanhã / Em 2d / etc. — desde que NÃO seja o dia do vencimento)
              // - Amarelo: no dia do vencimento (00:00–23:59), enquanto não passou do horário + 1 minuto
              // - Vermelho: passou de 1 minuto do horário agendado
              const ONE_MINUTE_MS = 60_000;
              const ONE_DAY_MS = 24 * 60 * 60 * 1000;

              const isOverdue = now.getTime() > scheduledAt.getTime() + ONE_MINUTE_MS;
              const isDueToday = !isOverdue && daysDiff === 0;

              let iconColor = "text-green-500";
              if (isOverdue) iconColor = "text-red-500";
              else if (isDueToday) iconColor = "text-yellow-500";

              const badgeText = (() => {
                if (isOverdue) {
                  const overdueMs = now.getTime() - scheduledAt.getTime();
                  const overdueMinutes = Math.floor(overdueMs / ONE_MINUTE_MS);
                  if (overdueMinutes < 60) return `${Math.max(1, overdueMinutes)}m atrasado`;
                  const overdueHours = Math.floor(overdueMs / (60 * ONE_MINUTE_MS));
                  if (overdueHours < 24) return `${overdueHours}h atrasado`;
                  const overdueDays = Math.floor(overdueMs / ONE_DAY_MS);
                  return `${overdueDays}d atrasado`;
                }

                if (daysDiff === 0) return "Hoje";
                if (daysDiff === 1) return "Amanhã";
                return `Em ${daysDiff}d`;
              })();

              return (
                <Popover open={isPendingTaskPopoverOpen} onOpenChange={setIsPendingTaskPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn("h-5 w-5 p-0", iconColor)}
                      onPointerDown={e => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      title={badgeText}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-72 p-0 bg-white dark:bg-[#1b1b1b] border-gray-200 dark:border-gray-700 shadow-xl z-[10000] overflow-hidden rounded-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!pendingTask?.id) return;
                      setIsPendingTaskPopoverOpen(false);
                      onEditPendingTask?.(pendingTask.id);
                    }}
                    align="start"
                  >
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Tarefa Pendente</h3>
                        <Badge variant={isOverdue ? "destructive" : "secondary"} className="text-[10px] px-1.5 h-4 rounded-none">
                          {badgeText}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      <div className="space-y-1">
                        {pendingTask.type && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider rounded-none border-gray-300 dark:border-gray-600 font-normal">
                            {pendingTask.type}
                          </Badge>
                        )}
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight">
                          {pendingTask.subject || "Sem assunto"}
                        </h4>
                      </div>

                      {pendingTask.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 italic">
                          "{pendingTask.description}"
                        </p>
                      )}

                      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(pendingTask.scheduled_for), "HH:mm")}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(pendingTask.scheduled_for), "dd 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}
            {/* Etiquetas removidas do card */}
            </div>

            {/* Contador de tempo separado à direita */}
            <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground pr-1 flex-shrink-0">
              <span>{formatTimeAgo(deal.created_at)}</span>
              {deal.priority === 'high' && (
                <div className="flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Componente para tornar a coluna draggable
interface SortableColumnWrapperProps {
  id: string;
  children: React.ReactNode;
  canReorder?: boolean;
}

function SortableColumnWrapper({ id, children, canReorder = true }: SortableColumnWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // ✅ Transição suave e natural
    transition: isDragging 
      ? 'none' // Sem transição durante drag para resposta imediata
      : transition || 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)', // Transição suave ao soltar
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    cursor: isDragging ? 'grabbing' : undefined,
    // ✅ Sombra mais sutil e profissional
    boxShadow: isDragging 
      ? '0 8px 24px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.08)' 
      : undefined,
    // ✅ Escala sutil durante drag
    scale: isDragging ? '1.03' : '1',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      {children}
      {canReorder && (
        <div 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing absolute top-3 right-12 z-10 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/80 backdrop-blur-sm rounded hover:bg-background shadow-sm border border-border/50 dark:bg-[#1f1f1f]/80 dark:hover:bg-[#2a2a2a] dark:border-gray-700/50"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
        </div>
      )}
    </div>
  );
}

interface CRMNegociosProps {
  isDarkMode?: boolean;
  onCollapseSidebar?: () => void;
}

// Componente interno que usa o context
function CRMNegociosContent({
  isDarkMode = false,
  onCollapseSidebar
}: CRMNegociosProps) {
  const {
    selectedWorkspace
  } = useWorkspace();
  const { user, userRole } = useAuth();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  const {
    canManagePipelines,
    canManageColumns,
    userWorkspaceRole,
    isMaster
  } = useWorkspaceRole();
  
  // Para Masters, priorizar workspaceId da URL
  const effectiveWorkspaceId = isMaster && urlWorkspaceId ? urlWorkspaceId : selectedWorkspace?.workspace_id;
  
  const {
    getHeaders
  } = useWorkspaceHeaders();
  const {
    toast
  } = useToast();
  const {
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    isLoadingCards,
    isInitializingBoard,
    isLoadingInitialCardsByColumn,
    isAllColumnsLoaded,
    hasMoreCardsByColumn,
    isLoadingMoreCardsByColumn,
    totalCardsByColumn,
    createPipeline,
    selectPipeline,
    createColumn,
    createCard,
    moveCard,
    moveCardOptimistic,
    fetchMoreCards,
    getCardsByColumn,
    updateCard,
    refreshCurrentPipeline,
    reorderColumns
  } = usePipelinesContext();
  const {
    activeUsers,
    isLoading: isLoadingActiveUsers,
    refreshActiveUsers
  } = usePipelineActiveUsers(selectedPipeline?.id, effectiveWorkspaceId);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Panorama é um módulo próprio na sidebar (não fica dentro do Pipeline).
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [selectedChatCard, setSelectedChatCard] = useState<any>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isEditarColunaModalOpen, setIsEditarColunaModalOpen] = useState(false);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCriarPipelineModalOpen, setIsCriarPipelineModalOpen] = useState(false);
  const [isCriarNegocioModalOpen, setIsCriarNegocioModalOpen] = useState(false);
  const [isDealDetailsModalOpen, setIsDealDetailsModalOpen] = useState(false);
  const [autoOpenActivityEditId, setAutoOpenActivityEditId] = useState<string | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [selectedDealDetailsForSheet, setSelectedDealDetailsForSheet] = useState<any | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  // Mapa de valores de produtos por cardId (para cálculo de totais)
  const [cardProductValues, setCardProductValues] = useState<Record<string, number>>({});
  const [appliedFilters, setAppliedFilters] = useState<{
    tags: string[];
    queues: string[];
    status?: string[];
    selectedDate?: Date;
    dateRange?: {
      from: Date;
      to: Date;
    };
    unreadMessages?: boolean;
  } | null>(null);
  const [responsibleFilter, setResponsibleFilter] = useState<ResponsibleFilterValue>('ALL');
  const [isTransferirModalOpen, setIsTransferirModalOpen] = useState(false);
  const [selectedColumnForAction, setSelectedColumnForAction] = useState<string | null>(null);
  const [isSetValueModalOpen, setIsSetValueModalOpen] = useState(false);
  const [selectedCardForValue, setSelectedCardForValue] = useState<any>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCardsForTransfer, setSelectedCardsForTransfer] = useState<Set<string>>(new Set());
  const [isLoadingAllCardIds, setIsLoadingAllCardIds] = useState(false);
  const [isEditarContatoModalOpen, setIsEditarContatoModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isVincularProdutoModalOpen, setIsVincularProdutoModalOpen] = useState(false);
const [selectedCardForProduct, setSelectedCardForProduct] = useState<{
  id: string;
  value: number;
  productId?: string | null;
} | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [columnWidth, setColumnWidth] = useState<number | null>(null);
  const unassignedCount = useMemo(() => cards.filter(card => !card.responsible_user_id).length, [cards]);
  const responsibleOptions = useMemo(() => {
    const optionsMap = new Map<string, {
      id: string;
      name: string;
      dealCount: number;
    }>();

    activeUsers.forEach(user => {
      optionsMap.set(user.id, {
        id: user.id,
        name: user.name || 'Responsável sem nome',
        dealCount: 0
      });
    });

    cards.forEach(card => {
      if (!card.responsible_user_id) return;

      const existingOption = optionsMap.get(card.responsible_user_id);
      const fallbackName = card.responsible_user?.name || card.contact?.name || 'Responsável sem nome';

      if (existingOption) {
        existingOption.dealCount += 1;
      } else {
        optionsMap.set(card.responsible_user_id, {
          id: card.responsible_user_id,
          name: fallbackName,
          dealCount: 1
        });
      }
    });

    return Array.from(optionsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', {
      sensitivity: 'base'
    }));
  }, [activeUsers, cards]);
  const [isVincularResponsavelModalOpen, setIsVincularResponsavelModalOpen] = useState(false);
  const [selectedCardForResponsavel, setSelectedCardForResponsavel] = useState<{
    cardId: string;
    conversationId?: string;
    contactId?: string;
    currentResponsibleId?: string;
  } | null>(null);
  const [isDeleteDealModalOpen, setIsDeleteDealModalOpen] = useState(false);
  const [selectedCardForDeletion, setSelectedCardForDeletion] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [selectedConversationForAgent, setSelectedConversationForAgent] = useState<string | null>(null);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [columnAutomationCounts, setColumnAutomationCounts] = useState<Record<string, number>>({});
  const [isExportCSVModalOpen, setIsExportCSVModalOpen] = useState(false);
  const [selectedColumnForExport, setSelectedColumnForExport] = useState<{ id: string; name: string } | null>(null);
  const isMobile = useIsMobile();
  const [isTablet, setIsTablet] = useState(false);
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Detectar tablet
  useEffect(() => {
    const checkTablet = () => {
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkTablet();
    window.addEventListener('resize', checkTablet);
    return () => window.removeEventListener('resize', checkTablet);
  }, []);

  // Reset column index quando mudar de pipeline
  useEffect(() => {
    setCurrentColumnIndex(0);
  }, [selectedPipeline?.id]);

  useEffect(() => {
    setResponsibleFilter('ALL');
  }, [selectedPipeline?.id]);

  // Ajustar largura das colunas para caber no container sem scroll horizontal
  useEffect(() => {
    if (isMobile) return;
    const node = boardContainerRef.current;
    if (!node) return;

    const calculateWidth = (containerWidth: number) => {
      const count = Math.max(columns.length, 1);
      const gap = 16; // gap-4 entre colunas
      const totalGap = gap * Math.max(count - 1, 0);
      const available = Math.max(containerWidth - totalGap, 0);
      const baseWidth = count > 0 ? available / count : 0;
      const fallbackWidth = count > 0 ? containerWidth / count : containerWidth;
      const maxWidth = 360; // evita colunas largas demais
      const computedWidth = baseWidth > 0
        ? Math.min(baseWidth, maxWidth)
        : Math.min(Math.max(fallbackWidth, 0), maxWidth);
      setColumnWidth(computedWidth);
    };

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || node.clientWidth;
      calculateWidth(width);
    });

    calculateWidth(node.clientWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, [isMobile, columns.length]);

  // Buscar agent_active_id quando selectedConversationForAgent mudar
  useEffect(() => {
    const fetchAgentId = async () => {
      if (!selectedConversationForAgent) {
        setCurrentAgentId(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('agent_active_id')
          .eq('id', selectedConversationForAgent)
          .single();

        if (error) throw error;
        setCurrentAgentId(data?.agent_active_id || null);
      } catch (error) {
        console.error('Erro ao buscar agent_active_id:', error);
        setCurrentAgentId(null);
      }
    };

    fetchAgentId();
  }, [selectedConversationForAgent]);

  // ✅ Sensor otimizado para drag fluido (inicia ao mover alguns px; evita "press and hold" travado)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // ✅ Começa o drag assim que o usuário mover (mantém clique intacto)
        distance: 2,
      }
    })
  );

  const columnsKey = useMemo(() => columns.map((c) => c.id).join('-'), [columns]);

  // ✅ CRÍTICO: Limpar estado do drag quando colunas mudarem
  // Isso previne o bug de travamento na segunda movimentação
  useEffect(() => {
    setDraggedColumn(null);
    setActiveId(null);
    setDragOverColumn(null);
  }, [columnsKey]);

  // 🔥 Buscar contagens de automações por coluna
  useEffect(() => {
    let cancelled = false;

    const fetchAutomationCounts = async () => {
      if (!columns || columns.length === 0) {
        setColumnAutomationCounts((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      try {
        const columnIds = columns.map((c) => c.id);

        // ✅ 1 request: buscar todas as automações dessas colunas e agregar no client
        // (evita N+1 de count por coluna; normalmente a tabela é pequena)
        const { data, error } = await supabase
          .from('crm_column_automations')
          .select('column_id')
          .in('column_id', columnIds);

        if (error) throw error;

        const counts: Record<string, number> = {};
        for (const id of columnIds) counts[id] = 0;
        for (const row of (data || []) as Array<{ column_id: string }>) {
          if (row?.column_id) counts[row.column_id] = (counts[row.column_id] || 0) + 1;
        }

        if (cancelled) return;

        // Evita loop de render em dev/StrictMode e evita rerender quando nada mudou
        setColumnAutomationCounts((prev) => {
          const prevKeys = Object.keys(prev);
          const nextKeys = Object.keys(counts);
          if (prevKeys.length !== nextKeys.length) return counts;

          for (const k of nextKeys) {
            if (prev[k] !== counts[k]) return counts;
          }

          return prev;
        });
      } catch (error) {
        console.error('Erro ao buscar contagens de automações:', error);
      }
    };

    const run = () => fetchAutomationCounts();

    // ✅ Não competir com o 1º paint do pipeline
    const w = window as any;
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 0);
    }
    return () => {
      cancelled = true;
    };
  }, [columnsKey]);

  // O loading é gerenciado automaticamente pelo PipelinesContext
  // quando o workspace muda, ele limpa os dados e mostra skeleton
  // Atualizado: 2025-10-03 - removido isRefreshing

  const parseFunctionErrorBody = (error: any) => {
    const body = error?.context?.body;

    if (!body) return null;

    if (typeof body === 'string') {
      try {
        return JSON.parse(body);
      } catch (parseError) {
        console.warn('⚠️ [CRMNegocios] Falha ao analisar corpo de erro da função:', parseError, body);
        return null;
      }
    }

    if (typeof body === 'object') {
      // Em alguns casos o supabase-js coloca um ReadableStream aqui
      try {
        if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
          return null;
        }
      } catch {
        // ignore
      }
      return body;
    }

    return null;
  };

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const parseNumericValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalized = String(value).replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Callback para quando o valor do produto é carregado no DraggableDeal
  const handleProductValueLoaded = useCallback((cardId: string, value: number) => {
    setCardProductValues(prev => {
      if (prev[cardId] === value) return prev; // Evitar re-render desnecessário
      return { ...prev, [cardId]: value };
    });
  }, []);

  // Função auxiliar para calcular o valor efetivo de um card (considerando produtos)
  const getCardEffectiveValue = useCallback((card: any): number => {
    // Primeiro, verificar se temos o valor do produto carregado via Edge Function
    const productValueFromMap = cardProductValues[card.id];
    if (productValueFromMap !== undefined && productValueFromMap > 0) {
      return productValueFromMap;
    }

    // Fallback para valores do card
    const cardValue = parseNumericValue(card.value);
    const productRelations = Array.isArray(card.products) ? card.products : [];
    const primaryProduct = productRelations.length > 0 ? productRelations[0] : null;
    const productValue = parseNumericValue(
      primaryProduct?.total_value ??
        primaryProduct?.unit_value ??
        primaryProduct?.product?.value ??
        card.product_value ??
        card.total_value ??
        null
    );

    return cardValue ?? productValue ?? 0;
  }, [cardProductValues]);

  // Função para buscar todos os IDs dos cards de uma coluna (sem paginação)
  const fetchAllCardIdsForColumn = useCallback(async (columnId: string): Promise<string[]> => {
    if (!selectedPipeline?.id) return [];
    
    try {
      // Buscar apenas os IDs dos cards da coluna (status aberto ou perda)
      let query = supabase
        .from('pipeline_cards')
        .select('id')
        .eq('pipeline_id', selectedPipeline.id)
        .eq('column_id', columnId)
        .or('status.eq.aberto,status.eq.perda,status.eq.perdido,status.is.null');
      
      // Filtrar cards do laboratório - apenas master pode ver
      // Usar .not() para excluir is_lab_test = true, permitindo null e false
      if (userRole !== 'master') {
        query = query.not('is_lab_test', 'eq', true);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar IDs dos cards:', error);
        return [];
      }
      
      return (data || []).map(card => card.id);
    } catch (error) {
      console.error('Erro ao buscar IDs dos cards:', error);
      return [];
    }
  }, [selectedPipeline?.id, userRole]);

  // Função para buscar cards no backend (busca global)
  const searchCardsInBackend = useCallback(async (term: string) => {
    if (!selectedPipeline?.id || !term || term.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearchingBackend(true);
    try {
      const { data, error } = await supabase.rpc('search_pipeline_cards', {
        p_pipeline_id: selectedPipeline.id,
        p_search_term: term.trim(),
        p_limit: 50,
      });

      if (error) {
        console.error('Erro na busca de cards:', error);
        setSearchResults([]);
      } else {
        setSearchResults(Array.isArray(data) ? data : []);
        setShowSearchResults(true);
      }
    } catch (err) {
      console.error('Exceção na busca de cards:', err);
      setSearchResults([]);
    } finally {
      setIsSearchingBackend(false);
    }
  }, [selectedPipeline?.id]);

  // Effect para busca com debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchCardsInBackend(searchTerm);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, searchCardsInBackend]);

  // Função para abrir um card dos resultados da busca
  const handleSearchResultClick = useCallback((card: any) => {
    setSearchTerm('');
    setShowSearchResults(false);
    setSearchResults([]);
    
    // Abrir o modal de detalhes do card
    setSelectedDealDetailsForSheet({
      dealName: card.contact_name || card.description || 'Sem título',
      contactNumber: card.contact_phone || '',
      cardId: card.id,
      currentColumnId: card.column_id,
      currentPipelineId: card.pipeline_id,
      contactData: {
        id: card.contact_id,
        name: card.contact_name,
        phone: card.contact_phone,
        profile_image_url: card.contact_image,
      },
    });
    setIsDealDetailsModalOpen(true);
  }, []);

  // Função para filtrar cards por coluna
  const getFilteredCards = (columnId: string) => {
    let columnCards = getCardsByColumn(columnId);

    // Filtrar por termo de busca
    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.toLowerCase();

      columnCards = columnCards.filter(card => {
        const titleMatch = (card.title?.toLowerCase() ?? '').includes(normalizedSearchTerm);
        const descriptionMatch = (card.description?.toLowerCase() ?? '').includes(normalizedSearchTerm);
        const phoneMatch = String(card.contact?.phone ?? '').toLowerCase().includes(normalizedSearchTerm);
        const nameMatch = (card.contact?.name?.toLowerCase() ?? '').includes(normalizedSearchTerm);

        return titleMatch || descriptionMatch || phoneMatch || nameMatch;
      });
    }

    // 🎯 FILTRAR POR RESPONSÁVEL SELECIONADO
    if (responsibleFilter !== 'ALL') {
      columnCards = columnCards.filter(card => {
        if (responsibleFilter === 'UNASSIGNED') {
          return !card.responsible_user_id;
        }
        return card.responsible_user_id === responsibleFilter;
      });
    }

    // Filtrar por tags selecionadas
    if (appliedFilters?.tags && appliedFilters.tags.length > 0) {
      columnCards = columnCards.filter(card => {
        // Verificar tags diretas do card
        const cardTags = Array.isArray(card.tags) ? card.tags : [];
        const hasCardTag = appliedFilters.tags.some(filterTag => cardTags.some(cardTag => cardTag === filterTag));

        // Verificar tags do contato associado
        const contactTags = card.contact?.contact_tags || [];
        const hasContactTag = appliedFilters.tags.some(filterTag => contactTags.some(contactTag => contactTag.tags?.id === filterTag || contactTag.tags?.name === filterTag));
        return hasCardTag || hasContactTag;
      });
    }

    // Filtrar por filas selecionadas
    if (appliedFilters?.queues && appliedFilters.queues.length > 0) {
      columnCards = columnCards.filter(card => {
        // Verificar se o card tem uma conversa associada com queue_id
        const conversationQueueId = card.conversation?.queue_id;
        return conversationQueueId && appliedFilters.queues.includes(conversationQueueId);
      });
    }

    // Filtrar por data
    if (appliedFilters?.status && appliedFilters.status.length > 0) {
      columnCards = columnCards.filter(card => {
        let status = (card.status || '').toLowerCase();
        if (!status) {
          status = 'aberto';
        }

        if (status === 'ganho' || status === 'perdido') {
          // normalize to português labels used in filter
          status = status === 'ganho' ? 'ganho' : 'perda';
        }

        // fallback: treat anything not ganho/perda as aberto
        if (status !== 'ganho' && status !== 'perda') {
          status = 'aberto';
        }

        return appliedFilters.status?.some(filterStatus => filterStatus.toLowerCase() === status);
      });
    }

    if (appliedFilters?.selectedDate || appliedFilters?.dateRange) {
      columnCards = columnCards.filter(card => {
        if (!card.created_at) return false;
        const cardDate = new Date(card.created_at);
        cardDate.setHours(0, 0, 0, 0); // Normalizar para início do dia

        if (appliedFilters.selectedDate) {
          // Filtro por data única
          const filterDate = new Date(appliedFilters.selectedDate);
          filterDate.setHours(0, 0, 0, 0);
          return cardDate.getTime() === filterDate.getTime();
        }
        if (appliedFilters.dateRange?.from && appliedFilters.dateRange?.to) {
          // Filtro por período
          const fromDate = new Date(appliedFilters.dateRange.from);
          fromDate.setHours(0, 0, 0, 0);
          const toDate = new Date(appliedFilters.dateRange.to);
          toDate.setHours(23, 59, 59, 999); // Até o fim do dia

          return cardDate >= fromDate && cardDate <= toDate;
        }
        return true;
      });
    }

    // Filtrar por mensagens não visualizadas
    if (appliedFilters?.unreadMessages) {
      columnCards = columnCards.filter(card => {
        // Verificar se o card tem uma conversa associada com unread_count > 0
        const conversation = card.conversation;
        // O unread_count pode vir como número ou string, então vamos garantir que seja número
        const conversationUnreadCount = typeof conversation?.unread_count === 'number' 
          ? conversation.unread_count 
          : (typeof conversation?.unread_count === 'string' ? parseInt(conversation.unread_count) || 0 : 0);
        
        return conversationUnreadCount > 0;
      });
    }

    return columnCards;
  };
  // ✅ Detecção de colisão customizada para colunas
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // Se estamos arrastando uma coluna, filtrar apenas colunas como alvos
    if (draggedColumn) {
      const columnDroppables = args.droppableContainers.filter(container => 
        container.id.toString().startsWith('column-')
      );
      const filteredArgs = {
        ...args,
        droppableContainers: columnDroppables
      };
      return rectIntersection(filteredArgs);
    }
    
    // Para cards: primeiro detectar se o ponteiro está sobre uma coluna vazia
    const columnDroppables = args.droppableContainers.filter(container => 
      container.id.toString().startsWith('column-')
    );
    
    // Usar pointerWithin para verificar se o ponteiro está dentro de alguma coluna
    const columnCollisions = pointerWithin({
      ...args,
      droppableContainers: columnDroppables
    });
    
    if (columnCollisions.length > 0) {
      const topColumnId = columnCollisions[0].id.toString().replace('column-', '');
      const columnCardsList = getFilteredCards(topColumnId);
      
      // Se a coluna está vazia, retornar a coluna como alvo diretamente
      if (columnCardsList.length === 0) {
        return columnCollisions;
      }
    }
    
    // Para colunas com cards, usar closestCenter (detecta os cards individuais)
    return closestCenter(args);
  }, [draggedColumn, getFilteredCards]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = event.active.id as string;
    
    // ✅ Limpar TODOS os estados de drag antes de iniciar novo
    setDraggedColumn(null);
    setActiveId(null);
    setDragOverColumn(null);
    
    // Verificar se é uma coluna sendo arrastada
    if (activeId.startsWith('column-')) {
      const columnId = activeId.replace('column-', '');
      setDraggedColumn(columnId);
      return;
    }
    
    // Se não é coluna, é card
    setActiveId(activeId);
  }, []);
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    
    if (!over || !active) {
      setDragOverColumn(null);
      return;
    }

    const overId = over.id.toString();
    let targetColumnId: string | null = null;

    // Se está sobre uma coluna diretamente
    if (overId.startsWith('column-')) {
      targetColumnId = overId.replace('column-', '');
    } 
    // Se está sobre um card, descobrir a qual coluna ele pertence
    else if (overId.startsWith('card-')) {
      const cardId = overId.replace('card-', '');
      // Encontrar a coluna que contém este card
      for (const column of columns) {
        const columnCards = getFilteredCards(column.id);
        if (columnCards.some(c => c.id === cardId)) {
          targetColumnId = column.id;
          break;
        }
      }
    }

    // ✅ Evita setState redundante (reduz re-render durante drag)
    setDragOverColumn((prev) => (prev === targetColumnId ? prev : targetColumnId));
  }, [columns, getFilteredCards]);
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const {
      active,
      over
    } = event;
    
    // ✅ SEMPRE limpar estados do drag IMEDIATAMENTE (não esperar async)
    const wasDraggingColumn = draggedColumn;
    setDraggedColumn(null);
    setActiveId(null);
    setDragOverColumn(null);
    
    // Verificar se é reordenamento de colunas
    if (wasDraggingColumn && over && active.id !== over.id) {
      const oldIndex = columns.findIndex(col => `column-${col.id}` === active.id);
      const newIndex = columns.findIndex(col => `column-${col.id}` === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newColumns = arrayMove(columns, oldIndex, newIndex);
        
        try {
          // ✅ Fire and forget - não bloquear a UI
          reorderColumns(newColumns);
        } catch (error) {
          console.error('❌ Erro na atualização otimista:', error);
        }
      }
      
      return; // ✅ Return early para colunas
    }
    
    // Resto do código para drag de cards
    if (!over) {
      return;
    }
    
    const activeId = active.id as string;
    const overId = over.id as string;

    // Encontrar o card que está sendo movido
    const activeCard = cards.find(card => `card-${card.id}` === activeId);
    if (!activeCard) {
      return;
    }

    // Determinar a nova coluna baseado no over
    let newColumnId = overId;

    // Se over é outro card, usar a coluna desse card
    if (overId.startsWith('card-')) {
      const overCard = cards.find(card => `card-${card.id}` === overId);
      if (overCard) {
        newColumnId = overCard.column_id;
      }
    }
    // Se over é uma coluna, usar o id da coluna
    else if (overId.startsWith('column-')) {
      newColumnId = overId.replace('column-', '');
    }

    // 🚀 USAR OPTIMISTIC UPDATE para movimento instantâneo
    if (activeCard.column_id !== newColumnId) {
      // Não precisa await - deixar executar em background
      moveCardOptimistic(activeCard.id, newColumnId);
    }
  }, [cards, columns, draggedColumn, moveCardOptimistic, reorderColumns]);
  const navigate = useNavigate();
  
  const openCardDetails = (card: any, opts?: { openActivityEditId?: string | null }) => {
    // Recolher sidebar para melhor visualização
    onCollapseSidebar?.();
    // Abrir modal deslizante de detalhes (sheet)
    setSelectedCard(card);
    setSelectedDealDetailsForSheet({
      id: card.id,
      pipelineId: card.pipeline_id,
      columnId: card.column_id,
      contactId: card.contact?.id,
      contactName: card.contact?.name || card.description || card.name,
      contactPhone: card.contact?.phone,
    });
    setAutoOpenActivityEditId(opts?.openActivityEditId ?? null);
    setIsDealDetailsModalOpen(true);
  };

  // Panorama foi movido para um módulo próprio na sidebar.
  const handlePipelineCreate = async (nome: string) => {
    try {
      await createPipeline(nome, 'padrao'); // tipo padrão fixo
      toast({
        title: "Pipeline criado",
        description: `Pipeline "${nome}" criado com sucesso`,
      });
      setIsCriarPipelineModalOpen(false);
    } catch (error) {
      console.error('Erro ao criar pipeline:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o pipeline",
        variant: "destructive",
      });
    }
  };
  const handleColumnCreate = async (nome: string, cor: string, icon: string) => {
    await createColumn(nome, cor, icon);
  };
  const handleSetCardValue = async (value: number) => {
    if (!selectedCardForValue) return;
    try {
      // Usar a função updateCard do contexto para salvar o valor
      await updateCard(selectedCardForValue.id, {
        value
      });
      toast({
        title: "Sucesso",
        description: "Preço do negócio atualizado com sucesso"
      });
      setSelectedCardForValue(null);
    } catch (error) {
      console.error('Erro ao atualizar valor do card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar preço do negócio",
        variant: "destructive"
      });
    }
  };
  const handleOpenTransferModal = useCallback((cardId: string) => {
    setSelectedCardsForTransfer(new Set([cardId]));
    setIsTransferirModalOpen(true);
  }, []);
  const handleTransferComplete = useCallback(() => {
    setSelectedCardsForTransfer(new Set());
    refreshCurrentPipeline();
  }, [refreshCurrentPipeline]);
  const handleVincularResponsavel = useCallback((cardId: string, conversationId?: string, currentResponsibleId?: string, contactId?: string) => {
    setSelectedCardForResponsavel({
      cardId,
      conversationId,
      contactId,
      currentResponsibleId
    });
    setIsVincularResponsavelModalOpen(true);
  }, []);
  const handleCreateBusiness = async (business: any) => {
    if (!selectedPipeline || !effectiveWorkspaceId) {
      toast({
        title: "Erro",
        description: "Pipeline ou workspace não selecionado",
        variant: "destructive"
      });
      return;
    }
    try {
      // 1. Buscar dados completos do contato
      const {
        data: contact,
        error: contactError
      } = await supabase.from('contacts').select('id, name, phone, profile_image_url').eq('id', business.lead).single();
      if (contactError || !contact?.phone) {
        throw new Error('Contato não encontrado ou sem telefone');
      }

      // 2. Verificar se já existe conversa ativa (para reusar se existir)
      const {
        data: existingConversations,
        error: convError
      } = await supabase.from('conversations').select('id, status').eq('contact_id', business.lead).eq('workspace_id', effectiveWorkspaceId).eq('status', 'open');
      if (convError) {
        console.error('Erro ao verificar conversas existentes:', convError);
      }

      // Se existe conversa, reusar. Se não existe, criar nova
      let conversationId = existingConversations?.[0]?.id;

      // 3. Criar conversa apenas se não existe
      if (!conversationId) {
      const {
        data: conversationData,
        error: conversationError
      } = await supabase.functions.invoke('create-quick-conversation', {
        body: {
          phoneNumber: contact.phone,
          orgId: effectiveWorkspaceId
        },
        headers: getHeaders(effectiveWorkspaceId)
      });

      if (conversationError) {
        console.error('Erro create-quick-conversation:', conversationError);
        if (conversationError.message?.includes('instância WhatsApp')) {
          toast({
            title: "Número inválido",
            description: "Este número pertence a uma instância WhatsApp e não pode ser usado como contato.",
            variant: "destructive"
          });
          return;
        }
        throw conversationError;
      }

      conversationId = conversationData?.conversationId;
      }

      // 4. Validar se a coluna selecionada existe
      const targetColumn = columns.find(col => col.id === business.column);
      if (!targetColumn) {
        throw new Error('Coluna selecionada não encontrada');
      }

      // 5. Criar o card no pipeline com dados do contato
      await createCard({
        column_id: business.column,
        contact_id: business.lead,
        conversation_id: conversationId,
        responsible_user_id: business.responsible,
        value: business.value,
        title: contact.name || 'Novo negócio',
        description: 'Card criado através do formulário de negócios',
        // Passar dados do contato para renderização otimista
        contact: {
          id: contact.id,
          name: contact.name,
          profile_image_url: contact.profile_image_url
        }
      } as any);
      toast({
        title: "Sucesso",
        description: "Negócio criado com sucesso!"
      });
      setIsCriarNegocioModalOpen(false);
    } catch (error: any) {
      // Se o createCard já tratou o erro (toast + parse), não duplicar toast aqui
      if ((error as any)?.__pipeline_create_handled) {
        console.error('Erro ao criar negócio (já tratado no createCard):', {
          error,
          parsed: (error as any)?.__pipeline_create_parsed || null
        });
        return;
      }

      const parsedErrorBody = parseFunctionErrorBody(error);
      console.error('Erro ao criar negócio:', { error, parsedErrorBody });
      
      const errorMessage = error?.message || parsedErrorBody?.message || '';
      const errorCode = parsedErrorBody?.error || '';
      const errorDescription = parsedErrorBody?.description || parsedErrorBody?.detail || parsedErrorBody?.details || '';
      const stringifiedBody = JSON.stringify(parsedErrorBody || {});

      const isDuplicateError = 
        errorMessage.includes('Já existe um card aberto') || 
        errorMessage.includes('duplicate_open_card') ||
        errorDescription.includes('Já existe um card aberto') ||
        errorCode === 'duplicate_open_card' ||
        errorCode === 'P0001' ||
        stringifiedBody.includes('Já existe um card aberto') ||
        stringifiedBody.includes('duplicate_open_card');
      
      if (isDuplicateError) {
        toast({
          title: "Negócio já existe",
          description:
            parsedErrorBody?.message ||
            "Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: parsedErrorBody?.message || parsedErrorBody?.error || (error instanceof Error ? error.message : "Erro ao criar negócio"),
          variant: "destructive"
        });
      }
    }
  };
  if (!effectiveWorkspaceId) {
    return <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Selecione um workspace para continuar</p>
        </div>
      </div>;
  }

  // 🚀 Early return: só mostra tela de "sem pipelines" se NÃO estiver inicializando
  // Durante inicialização, o main render cuida do spinner unificado
  if (!isInitializingBoard && (isLoading || pipelines.length === 0)) {
    return (
      <div className={`p-6 bg-white dark:bg-[#0f0f0f] ${isDarkMode ? 'dark' : ''}`}>
        <div className="flex items-center justify-end mb-6">
          {!isLoading && canManagePipelines(effectiveWorkspaceId) && (
            <Button onClick={() => setIsCriarPipelineModalOpen(true)} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Criar Pipeline
            </Button>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className={`text-lg font-medium text-muted-foreground dark:text-gray-400 mb-2`}>
              Nenhum pipeline encontrado
            </h3>
            <p className={`text-muted-foreground dark:text-gray-400 mb-4`}>
              {canManagePipelines(selectedWorkspace?.workspace_id) ? "Crie seu primeiro pipeline para começar a gerenciar seus negócios" : "Nenhum pipeline disponível no momento"}
            </p>
            {canManagePipelines(selectedWorkspace?.workspace_id) && (
              <Button onClick={() => setIsCriarPipelineModalOpen(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Criar Pipeline
              </Button>
            )}
          </div>
        )}
        
        <CriarPipelineModal isOpen={isCriarPipelineModalOpen} onClose={() => setIsCriarPipelineModalOpen(false)} onSave={handlePipelineCreate} isDarkMode={isDarkMode} />
      </div>
    );
  }
  
  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={customCollisionDetection} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd} 
      onDragOver={handleDragOver}
    >
      {/* Excel-like Layout */}
      <div className={`flex flex-col h-full bg-white dark:bg-[#0f0f0f] border border-gray-300 dark:border-gray-700 m-2 shadow-sm font-sans text-xs ${isDarkMode ? 'dark' : ''}`}>
        {/* Sticky Header - Fixo no topo, sem scroll horizontal */}
        <div className={`flex-shrink-0 bg-background dark:bg-[#1a1a1a] border-b border-border dark:border-gray-700 w-full`}>
          {/* Title Bar */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
            <div className="flex items-center gap-2">
              <span
                className="font-semibold text-gray-900 dark:text-gray-100"
                style={{ fontSize: "1.5rem" }}
              >
                Pipeline
              </span>
            </div>
          </div>

          <div className="px-2 md:px-4 py-2">
            <div className={`w-full border border-[#d4d4d4] dark:border-gray-700 rounded-none p-2 md:p-3 shadow-sm bg-background dark:bg-[#1a1a1a]`}>
                  
                  {/* Mobile Layout */}
                  {isMobile ? (
                    <div className="space-y-2">
                      {/* Linha 1: Pipeline Selector e Menu */}
                      <div className="flex items-center gap-2">
                        {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && (
                          <Button
                            variant="ghost"
                            size="icon"
                          onClick={() => setIsConfigModalOpen(true)}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-9 w-9"
                          disabled={!selectedPipeline}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          {isLoading ? (
                            <div className="h-9 w-full flex items-center justify-center border border-gray-300 dark:border-gray-700 bg-background dark:bg-[#1b1b1b]">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-gray-400" />
                            </div>
                          ) : pipelines && pipelines.length > 0 ? (
                            <Select
                              value={selectedPipeline?.id || ""}
                              onValueChange={(value) => {
                                const pipeline = pipelines.find(p => p.id === value);
                                if (pipeline) {
                                  selectPipeline(pipeline);
                                }
                              }}
                            >
                              <SelectTrigger className={`h-9 font-bold bg-background dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700`}>
                                <SelectValue placeholder="Pipeline" />
                              </SelectTrigger>
                              <SelectContent className={`z-50 bg-background dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700`}>
                                {pipelines.map((pipeline) => (
                                  <SelectItem key={pipeline.id} value={pipeline.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                                    {pipeline.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                          className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-9 w-9"
                        >
                          <Menu className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Linha 2: Filtros (colapsável) */}
                      {isMobileFiltersOpen && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex gap-2">
                            {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCriarPipelineModalOpen(true)}
                                className="text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 h-9 w-9"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}

                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setIsFilterModalOpen(true)}
                              className="font-medium flex-1"
                              disabled={!selectedPipeline}
                            >
                              <ListFilter className="w-4 h-4 mr-2" />
                              Filtrar
                              {(appliedFilters?.tags && appliedFilters.tags.length > 0 ||
                                appliedFilters?.queues && appliedFilters.queues.length > 0 ||
                                appliedFilters?.status && appliedFilters.status.length > 0 ||
                                appliedFilters?.selectedDate ||
                                appliedFilters?.dateRange) && (
                                  <Badge className="ml-2 bg-background text-primary text-xs px-1 py-0 h-auto">
                                    {(appliedFilters?.tags?.length || 0) +
                                      (appliedFilters?.queues?.length || 0) +
                                      (appliedFilters?.status?.length || 0) +
                                      (appliedFilters?.selectedDate || appliedFilters?.dateRange ? 1 : 0)}
                                  </Badge>
                                )}
                            </Button>
                          </div>

                          <div className="relative">
                            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400`} />
                            <Input
                              type="text"
                              placeholder="Buscar negócios..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className={`pl-10 h-9 border-gray-300 dark:border-gray-700 bg-transparent dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
                            />
                          </div>

                          <Select
                            value={responsibleFilter}
                            onValueChange={(value) => setResponsibleFilter(value as ResponsibleFilterValue)}
                          >
                            <SelectTrigger className={`h-9 bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100`}>
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent align="end" className={`bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700`}>
                              <SelectItem value="ALL" className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>Todos</SelectItem>
                              <SelectItem value="UNASSIGNED" className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                                Sem responsável ({unassignedCount})
                              </SelectItem>
                              {!isLoadingActiveUsers && responsibleOptions.map(option => (
                                <SelectItem key={option.id} value={option.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                                  {option.name} {option.dealCount ? `(${option.dealCount})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Desktop/Tablet Layout - Excel Style */
                    <div className="flex w-full items-center gap-2 overflow-x-auto">
                      {/* Settings Button */}
                      {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsConfigModalOpen(true)}
                          className="h-7 w-7 rounded-none hover:bg-gray-200 text-gray-700 border border-transparent hover:border-gray-300"
                          disabled={!selectedPipeline}
                          title="Configurações"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Pipeline Selector */}
                      <div className="flex-shrink-0">
                        {isLoading ? (
                          <div className="h-7 w-[180px] flex items-center justify-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-gray-400" />
                          </div>
                        ) : pipelines && pipelines.length > 0 ? (
                          <Select
                            value={selectedPipeline?.id || ""}
                            onValueChange={(value) => {
                              const pipeline = pipelines.find(p => p.id === value);
                              if (pipeline) {
                                selectPipeline(pipeline);
                              }
                            }}
                          >
                            <SelectTrigger className={`w-[180px] h-7 text-xs bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none text-gray-900 dark:text-gray-100`}>
                              <SelectValue placeholder="Selecione um pipeline" />
                            </SelectTrigger>
                            <SelectContent className={`z-50 bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none`}>
                              {pipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id} className={`text-xs focus:bg-gray-100 dark:focus:bg-[#2a2a2a] cursor-pointer text-gray-900 dark:text-gray-100`}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-xs px-2">Nenhum pipeline</span>
                        )}
                      </div>

                      <div className={`h-4 w-px bg-gray-300 dark:bg-gray-700 mx-1`} />

                      {/* Criar Pipeline */}
                      {canManagePipelines(selectedWorkspace?.workspace_id || undefined) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsCriarPipelineModalOpen(true)}
                          className="h-7 px-2 rounded-none hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-300 dark:hover:border-gray-700 gap-1"
                          title="Criar Pipeline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Criar Pipeline</span>
                        </Button>
                      )}

                      {/* Filter Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`h-7 px-2 text-xs bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 gap-1`}
                        disabled={!selectedPipeline}
                      >
                        <ListFilter className="h-3 w-3" />
                        Filtrar
                        {(appliedFilters?.tags && appliedFilters.tags.length > 0 ||
                          appliedFilters?.queues && appliedFilters.queues.length > 0 ||
                          appliedFilters?.status && appliedFilters.status.length > 0 ||
                          appliedFilters?.selectedDate ||
                          appliedFilters?.dateRange) && (
                            <Badge className="ml-1 bg-primary text-primary-foreground text-[9px] px-1 py-0 h-3.5 rounded-sm">
                              {(appliedFilters?.tags?.length || 0) +
                                (appliedFilters?.queues?.length || 0) +
                                (appliedFilters?.status?.length || 0) +
                                (appliedFilters?.selectedDate || appliedFilters?.dateRange ? 1 : 0)}
                            </Badge>
                          )}
                      </Button>

                      {/* Search Input com dropdown de resultados globais */}
                      <div className="relative flex-1 min-w-[150px] max-w-xs">
                        <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-gray-500 z-10`} />
                        {isSearchingBackend && (
                          <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 animate-spin z-10" />
                        )}
                        <Input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Buscar em todo o pipeline..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                          onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                          className={`pl-7 pr-7 h-7 text-xs bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none focus-visible:ring-1 focus-visible:ring-primary text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
                        />
                        
                        {/* Dropdown de resultados da busca global */}
                        {showSearchResults && searchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1b1b1b] border border-gray-300 dark:border-gray-700 shadow-lg z-50 max-h-80 overflow-y-auto">
                            <div className="px-2 py-1 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f0f0f]">
                              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} encontrado{searchResults.length !== 1 ? 's' : ''}
                            </div>
                            {searchResults.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                className="w-full text-left px-2 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSearchResultClick(card);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                      {card.contact_name || card.description || 'Sem nome'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                      {card.contact_phone && <span>{card.contact_phone}</span>}
                                      {card.contact_phone && card.column_name && <span className="mx-1">•</span>}
                                      {card.column_name && <span>{card.column_name}</span>}
                                    </div>
                                  </div>
                                  {card.value && (
                                    <div className="text-[10px] font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value)}
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Mensagem quando não há resultados */}
                        {showSearchResults && searchTerm.trim().length >= 2 && searchResults.length === 0 && !isSearchingBackend && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1b1b1b] border border-gray-300 dark:border-gray-700 shadow-lg z-50 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                            Nenhuma oportunidade encontrada
                          </div>
                        )}
                      </div>

                      {/* Filtro por responsável */}
                      <div className="w-[180px] flex-shrink-0">
                        <Select
                          value={responsibleFilter}
                          onValueChange={(value) => setResponsibleFilter(value as ResponsibleFilterValue)}
                        >
                          <SelectTrigger className={`h-7 text-xs bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none text-gray-900 dark:text-gray-100`}>
                            <SelectValue placeholder="Responsável" />
                          </SelectTrigger>
                          <SelectContent align="end" className={`min-w-[180px] bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700 rounded-none`}>
                            <SelectItem value="ALL" className={`text-xs focus:bg-gray-100 dark:focus:bg-[#2a2a2a] cursor-pointer text-gray-900 dark:text-gray-100`}>Todos</SelectItem>
                            <SelectItem value="UNASSIGNED" className={`text-xs focus:bg-gray-100 dark:focus:bg-[#2a2a2a] cursor-pointer text-gray-900 dark:text-gray-100`}>
                              Sem responsável ({unassignedCount})
                            </SelectItem>
                            {!isLoadingActiveUsers && responsibleOptions.map(option => (
                              <SelectItem key={option.id} value={option.id} className={`text-xs focus:bg-gray-100 dark:focus:bg-[#2a2a2a] cursor-pointer text-gray-900 dark:text-gray-100`}>
                                {option.name} {option.dealCount ? `(${option.dealCount})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex-1" />

                      {/* + Coluna Button */}
                      {selectedPipeline && canManageColumns(selectedWorkspace?.workspace_id || undefined) && (
                        <Button
                          onClick={() => setIsAddColumnModalOpen(true)}
                          size="sm"
                          variant="ghost"
                          className={`h-7 px-2 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-none flex items-center gap-1 text-black dark:text-white`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Criar Etapa</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
        
        {/* Pipeline Scroll Area - Com scroll horizontal independente */}
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
              {/* Mobile: Navigation Controls */}
              {isMobile && columns.length > 0 && (
                <div className={`flex-shrink-0 flex items-center justify-between px-4 py-2 border-b bg-background dark:bg-[#1a1a1a] border-gray-300 dark:border-gray-700`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentColumnIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentColumnIndex === 0}
                    className={`h-8 w-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  
                  <div className={`text-sm font-medium text-gray-900 dark:text-gray-100`}>
                    {columns[currentColumnIndex]?.name} ({currentColumnIndex + 1}/{columns.length})
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentColumnIndex(prev => Math.min(columns.length - 1, prev + 1))}
                    disabled={currentColumnIndex === columns.length - 1}
                    className={`h-8 w-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              )}

              <div
                ref={!isMobile ? boardContainerRef : undefined}
                className="flex-1 min-h-0 px-2 md:px-4 overflow-hidden"
              >
                  {isInitializingBoard ? (
                    /* 🚀 Skeleton Kanban: simula a estrutura do board enquanto carrega */
                    <div className={cn("h-full w-full", isMobile ? "flex justify-center" : "flex gap-4 items-stretch")}>
                      {isMobile ? (
                        /* Mobile: 1 coluna skeleton */
                        <div className="w-full max-w-sm h-full flex flex-col">
                          <div className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700 border-t-[3px] border-t-[#d4d4d4] dark:border-t-gray-700 shadow-sm h-full flex flex-col overflow-hidden">
                            <div className="bg-[#f3f3f3] dark:bg-[#1f1f1f] p-2 flex-shrink-0 border-b border-[#d4d4d4] dark:border-gray-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <Skeleton className="h-4 w-24 rounded-sm dark:bg-gray-700" />
                                <Skeleton className="h-5 w-8 rounded-full dark:bg-gray-700" />
                              </div>
                              <Skeleton className="h-3 w-20 rounded-sm dark:bg-gray-700" />
                            </div>
                            <div className="flex-1 p-2 bg-[#f9f9f9] dark:bg-[#0a0a0a] space-y-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white dark:bg-[#1b1b1b] border border-[#e5e5e5] dark:border-gray-700 p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-8 rounded-full dark:bg-gray-700" />
                                    <div className="flex-1 space-y-1">
                                      <Skeleton className="h-3.5 w-3/4 rounded-sm dark:bg-gray-700" />
                                      <Skeleton className="h-2.5 w-1/2 rounded-sm dark:bg-gray-700" />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Skeleton className="h-3 w-16 rounded-sm dark:bg-gray-700" />
                                    <Skeleton className="h-3 w-12 rounded-sm dark:bg-gray-700" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Desktop: 5 colunas skeleton (preenchendo a largura) */
                        <>
                          {[1, 2, 3, 4, 5].map(colIdx => (
                            <div
                              key={colIdx}
                              className="flex-shrink-0 h-full min-h-0 flex flex-col pb-2"
                              style={{
                                width: `${columnWidth ?? 240}px`,
                                minWidth: `${columnWidth ?? 240}px`,
                                flexBasis: `${columnWidth ?? 240}px`,
                              }}
                            >
                              <div className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700 border-t-[3px] border-t-[#d4d4d4] dark:border-t-gray-700 shadow-sm h-full flex flex-col overflow-hidden">
                                {/* Header skeleton */}
                                <div className="bg-[#f3f3f3] dark:bg-[#1f1f1f] p-2 flex-shrink-0 border-b border-[#d4d4d4] dark:border-gray-700 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-20 rounded-sm dark:bg-gray-700" />
                                    <Skeleton className="h-5 w-8 rounded-full dark:bg-gray-700" />
                                  </div>
                                  <Skeleton className="h-3 w-16 rounded-sm dark:bg-gray-700" />
                                </div>
                                {/* Cards skeleton */}
                                <div className="flex-1 p-2 bg-[#f9f9f9] dark:bg-[#0a0a0a] space-y-2">
                                  {/* Quantidade de cards skeleton variável por coluna para parecer natural */}
                                  {Array.from({ length: colIdx <= 2 ? 3 : colIdx <= 4 ? 2 : 1 }).map((_, cardIdx) => (
                                    <div key={cardIdx} className="bg-white dark:bg-[#1b1b1b] border border-[#e5e5e5] dark:border-gray-700 p-3 space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 dark:bg-gray-700" />
                                        <div className="flex-1 space-y-1">
                                          <Skeleton className="h-3.5 w-3/4 rounded-sm dark:bg-gray-700" />
                                          <Skeleton className="h-2.5 w-1/2 rounded-sm dark:bg-gray-700" />
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between pt-1">
                                        <Skeleton className="h-3 w-16 rounded-sm dark:bg-gray-700" />
                                        <Skeleton className="h-3 w-12 rounded-sm dark:bg-gray-700" />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : !selectedPipeline ? (
                    <div className={`flex items-center justify-center h-64 border-2 border-dashed border-border dark:border-gray-700 rounded-lg`}>
                      <div className="text-center">
                        <p className={`text-muted-foreground dark:text-gray-400 mb-4`}>Nenhum pipeline selecionado</p>
                        <Button onClick={() => setIsCriarPipelineModalOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          <span className="text-xs font-medium">Criar Pipeline</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "h-full w-full",
                        isMobile ? "flex justify-center" : "flex gap-4 items-stretch"
                      )}
                    >
                      {/* Mobile: Single Column */}
                      {isMobile ? (
                        columns[currentColumnIndex] ? (() => {
                          const column = columns[currentColumnIndex];
                          const columnCards = getFilteredCards(column.id);
                          const calculateColumnTotal = () => {
                            const total = columnCards.reduce((sum, card) => {
                              const effectiveValue = getCardEffectiveValue(card);
                              return sum + effectiveValue;
                            }, 0);
                            return total;
                          };
                          const formatCurrency = (value: number) => {
                            return new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(value);
                          };
                          
                          return (
                            <DroppableColumn key={column.id} id={`column-${column.id}`}>
                              <div className="w-full max-w-md h-full min-h-0 flex flex-col pb-2">
                                <div className={`bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700 border-t-[3px] border-t-[#d4d4d4] dark:border-t-gray-700 shadow-sm h-full flex flex-col overflow-hidden`}>
                                  {/* Column Header */}
                                  <div className={`bg-[#f3f3f3] dark:bg-[#1f1f1f] p-2 flex-shrink-0 border-b border-[#d4d4d4] dark:border-gray-700`}>
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <h3 className={`font-semibold text-foreground dark:text-gray-100 text-sm mb-1`}>
                                          {column.name}
                                        </h3>
                                        <div className={`text-xs text-muted-foreground dark:text-gray-400 space-y-0.5`}>
                                          <div className="font-medium">
                                            Total: {formatCurrency(calculateColumnTotal())}
                                          </div>
                                          <div>
                                            {totalCardsByColumn[column.id] || 0} {(totalCardsByColumn[column.id] || 0) === 1 ? 'oportunidade' : 'oportunidades'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Cards Area */}
                                  <div
                                    className={`flex-1 p-2 overflow-y-auto min-h-0 bg-[#f9f9f9] dark:bg-[#0a0a0a] transition-all duration-200 scrollbar-thin scrollbar-thumb-gray-column scrollbar-track-transparent relative`}
                                    onScroll={(e) => {
                                      const el = e.currentTarget;
                                      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
                                      if (nearBottom) {
                                        fetchMoreCards(column.id);
                                      }
                                    }}
                                  >
                                    {!isAllColumnsLoaded && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#f9f9f9]/80 dark:bg-[#0a0a0a]/80">
                                        <div className="flex flex-col items-center gap-2">
                                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground dark:text-gray-400" />
                                        </div>
                                      </div>
                                    )}
                                     <SortableContext items={columnCards.map(card => `card-${card.id}`)} strategy={verticalListSortingStrategy}>
                                       {/* Placeholder animado quando card está sendo arrastado sobre esta coluna */}
                                       <div 
                                         className={`border-2 border-dashed rounded-sm overflow-hidden transition-all duration-150 ease-out ${
                                           activeId && !draggedColumn && dragOverColumn === column.id 
                                             ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 opacity-100' 
                                             : 'border-transparent bg-transparent opacity-0 pointer-events-none'
                                         }`}
                                         style={{ 
                                           height: activeId && !draggedColumn && dragOverColumn === column.id ? '85px' : '0px',
                                           marginBottom: activeId && !draggedColumn && dragOverColumn === column.id ? '8px' : '0px',
                                         }}
                                       >
                                         <div className="h-full flex items-center justify-center text-xs text-primary/60 dark:text-primary/50">
                                           Solte aqui
                                         </div>
                                       </div>
                                       {!isAllColumnsLoaded ? (
                                         <div className="h-24" />
                                      ) : columnCards.length > 0 ? columnCards.map((card, idx) => {
                                        const productRelations = Array.isArray((card as any).products) ? (card as any).products : [];
                                        const primaryProduct = productRelations.length > 0 ? productRelations[0] : null;
                                        const productName = primaryProduct?.product?.name || (card as any).product_name;
                                        const productId = primaryProduct?.product_id || primaryProduct?.product?.id || (card as any).product_id;
                                        
                                        const productValue = primaryProduct?.total_value ?? primaryProduct?.unit_value ?? primaryProduct?.product?.value ?? (card as any).product_value ?? (card as any).total_value ?? null;
                                         const effectiveValue = card.value || productValue || 0;

                                         const deal: Deal = {
                                           id: card.id,
                                           name: card.title,
                                           value: effectiveValue,
                                           stage: column.name,
                                           status: card.status,
                                           responsible: card.responsible_user?.name || 'Não atribuído',
                                           responsible_user_id: card.responsible_user_id,
                                           tags: Array.isArray(card.tags) ? card.tags : [],
                                           priority: 'medium',
                                           created_at: card.created_at,
                                           contact: card.contact,
                                           product_id: productId,
                                           product_name: productName,
                                           conversation: card.conversation ? {
                                             ...card.conversation,
                                             unread_count: card.conversation.unread_count ?? 0
                                           } : (card.conversation_id ? { id: card.conversation_id, unread_count: 0 } : undefined),
                                         };

                                        return (
                                            <DraggableDeal
                                              key={card.id}
                                              deal={deal}
                                              isDarkMode={isDarkMode}
                                              onClick={() => !isSelectionMode && openCardDetails(card)}
                                              columnColor={column.color}
                                              workspaceId={effectiveWorkspaceId}
                                              onChatClick={(dealData) => {
                                                setSelectedChatCard(dealData);
                                                setIsChatModalOpen(true);
                                              }}
                                              onValueClick={(dealData) => {
                                                setSelectedCardForProduct({
                                                  id: dealData.id,
                                                  value: dealData.value,
                                                  productId: dealData.product_id || null,
                                                });
                                                setIsVincularProdutoModalOpen(true);
                                              }}
                                              isSelectionMode={isSelectionMode && selectedColumnForAction === column.id}
                                              isSelected={selectedCardsForTransfer.has(card.id)}
                                              onToggleSelection={() => {
                                                const newSet = new Set(selectedCardsForTransfer);
                                                if (newSet.has(card.id)) {
                                                  newSet.delete(card.id);
                                                } else {
                                                  newSet.add(card.id);
                                                }
                                                setSelectedCardsForTransfer(newSet);
                                              }}
                                              onEditContact={(contactId) => {
                                                setSelectedContactId(contactId);
                                                setIsEditarContatoModalOpen(true);
                                              }}
                                              onLinkProduct={(cardId, currentValue, currentProductId) => {
                                                setSelectedCardForProduct({
                                                  id: cardId,
                                                  value: currentValue,
                                                  productId: currentProductId || null,
                                                });
                                                setIsVincularProdutoModalOpen(true);
                                              }}
                                              onDeleteCard={(cardId) => {
                                                const cardToDelete = cards.find((c) => c.id === cardId);
                                                setSelectedCardForDeletion({
                                                  id: cardId,
                                                  name: cardToDelete?.title || 'este negócio',
                                                });
                                                setIsDeleteDealModalOpen(true);
                                              }}
                                              onOpenTransferModal={(cardId) => {
                                                setSelectedCardsForTransfer(new Set([cardId]));
                                                setIsTransferirModalOpen(true);
                                              }}
                                              onVincularResponsavel={(cardId, conversationId, currentResponsibleId, contactId) => {
                                                setSelectedCardForResponsavel({ cardId, conversationId, currentResponsibleId, contactId });
                                                setIsVincularResponsavelModalOpen(true);
                                              }}
                                              onProductValueLoaded={handleProductValueLoaded}
                                              onConfigureAgent={(conversationId) => {
                                                setSelectedConversationForAgent(conversationId);
                                                setAgentModalOpen(true);
                                              }}
                                            />
                                        );
                                      }) : (
                                         <div className={`text-center text-muted-foreground dark:text-gray-400 text-sm py-8`}>
                                           Nenhuma oportunidade nesta etapa
                                         </div>
                                       )}
                                      {!isLoadingCards && hasMoreCardsByColumn?.[column.id] && (
                                        <div className="py-2 text-center text-xs text-muted-foreground dark:text-gray-400">
                                          {isLoadingMoreCardsByColumn?.[column.id] ? 'Carregando mais...' : 'Role para carregar mais'}
                                        </div>
                                      )}
                                     </SortableContext>
                                  </div>
                                </div>
                              </div>
                            </DroppableColumn>
                          );
                        })() : null
                      ) : (
                        /* Tablet/Desktop: Multiple Columns */
                        <SortableContext 
                          key={columns.map(col => col.id).join('-')}
                          items={columns.map(col => `column-${col.id}`)}
                          strategy={horizontalListSortingStrategy}
                        >
                          {columns.map(column => {
            const columnCards = getFilteredCards(column.id);

            // Calculate total value of cards in this column
            const calculateColumnTotal = () => {
              // ⚡️ Sem logs (evita travamentos durante drag/re-render)
              return columnCards.reduce((sum, card) => sum + getCardEffectiveValue(card), 0);
            };
            const formatCurrency = (value: number) => {
              return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(value);
            };
            const isColumnBeingDragged = draggedColumn === column.id;
            const isColumnDropTarget = !!draggedColumn && dragOverColumn === column.id;
            return (
              <SortableColumnWrapper key={column.id} id={`column-${column.id}`} canReorder={userRole !== 'user'}>
                <DroppableColumn id={`column-${column.id}`}>
                    {/* Coluna individual - responsiva */}
                    <div
                      className={cn(
                        "flex-shrink-0 h-full min-h-0 flex flex-col pb-2 transition-all duration-200",
                        isColumnBeingDragged && "scale-[1.02] ring-2 ring-primary/50 shadow-2xl"
                      )}
                      style={
                        !isMobile
                          ? {
                              width: `${columnWidth ?? 240}px`,
                              minWidth: `${columnWidth ?? 240}px`,
                              flexBasis: `${columnWidth ?? 240}px`
                            }
                          : undefined
                      }
                    >
                       <div className={`bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700 border-t-[3px] border-t-[#d4d4d4] dark:border-t-gray-700 shadow-sm h-full flex flex-col overflow-hidden transition-colors duration-200`}>
                        {/* Cabeçalho da coluna - fundo branco/claro */}
                        <div className={`bg-[#f3f3f3] dark:bg-[#1f1f1f] p-2 flex-shrink-0 border-b border-[#d4d4d4] dark:border-gray-700`}>
                          {isSelectionMode && selectedColumnForAction === column.id ? <div className="mb-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={selectedCardsForTransfer.size > 0 && selectedCardsForTransfer.size >= (totalCardsByColumn[column.id] || 0)} 
                                      disabled={isLoadingAllCardIds}
                                      onChange={async (e) => {
                                        if (e.target.checked) {
                                          // Buscar TODOS os IDs dos cards da coluna
                                          setIsLoadingAllCardIds(true);
                                          try {
                                            const allCardIds = await fetchAllCardIdsForColumn(column.id);
                                            const newSet = new Set(allCardIds);
                                            setSelectedCardsForTransfer(newSet);
                                          } finally {
                                            setIsLoadingAllCardIds(false);
                                          }
                                        } else {
                                          // Desmarcar todos
                                          setSelectedCardsForTransfer(new Set());
                                        }
                                      }} 
                                      className="w-4 h-4 cursor-pointer" 
                                    />
                                    <span className="font-medium">
                                      {isLoadingAllCardIds ? 'Carregando...' : `Selecionar todos (${totalCardsByColumn[column.id] || 0})`}
                                    </span>
                                  </label>
                                  <Button size="sm" variant="ghost" onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedCardsForTransfer(new Set());
                          setSelectedColumnForAction(null);
                        }}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {selectedCardsForTransfer.size > 0 && <Button onClick={() => setIsTransferirModalOpen(true)} className="w-full" size="sm">
                                    Transferir ({selectedCardsForTransfer.size})
                                  </Button>}
                              </div> : null}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className={`font-semibold text-foreground dark:text-gray-100 text-sm mb-1`}>
                                {column.name}
                              </h3>
                              <div className={`text-xs text-muted-foreground dark:text-gray-400 space-y-0.5`}>
                                <div className="font-medium">
                                  Total: {formatCurrency(calculateColumnTotal())}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>
                                    {totalCardsByColumn[column.id] || 0} {(totalCardsByColumn[column.id] || 0) === 1 ? 'oportunidade' : 'oportunidades'}
                                  </span>
                                  {columnAutomationCounts[column.id] > 0 && (
                                     <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 30 30" fill="currentColor">
                                              <path d="M 19.664062 0 C 19.423063 0 19.217828 0.17120313 19.173828 0.40820312 L 18.953125 1.5839844 C 18.896125 1.8889844 18.654609 2.1166875 18.349609 2.1796875 C 18.065609 2.2386875 17.785672 2.3123906 17.513672 2.4003906 C 17.218672 2.4963906 16.897313 2.4205469 16.695312 2.1855469 L 15.919922 1.2792969 C 15.762922 1.0962969 15.498062 1.0528281 15.289062 1.1738281 L 14.710938 1.5078125 C 14.502937 1.6278125 14.408281 1.8804219 14.488281 2.1074219 L 14.884766 3.234375 C 14.987766 3.526375 14.893109 3.8437813 14.662109 4.0507812 C 14.447109 4.2437812 14.243781 4.4471094 14.050781 4.6621094 C 13.843781 4.8931094 13.526375 4.9897187 13.234375 4.8867188 L 12.105469 4.4882812 C 11.878469 4.4082812 11.627813 4.5019375 11.507812 4.7109375 L 11.171875 5.2910156 C 11.051875 5.4990156 11.097297 5.764875 11.279297 5.921875 L 11.376953 6.0058594 C 12.559953 6.0258594 13.572016 6.8720625 13.791016 8.0390625 L 13.851562 8.3574219 L 14.060547 8.1113281 C 14.519547 7.5773281 15.162172 7.2869531 15.826172 7.2519531 C 16.722172 5.8969531 18.255 5 20 5 C 22.761 5 25 7.239 25 10 C 25 11.745 24.103047 13.277875 22.748047 14.171875 C 22.713047 14.835875 22.422672 15.4795 21.888672 15.9375 L 21.642578 16.146484 L 21.960938 16.207031 C 23.127938 16.426031 23.974141 17.438094 23.994141 18.621094 L 24.078125 18.71875 C 24.235125 18.90175 24.499984 18.947172 24.708984 18.826172 L 25.289062 18.490234 C 25.497062 18.370234 25.591719 18.119578 25.511719 17.892578 L 25.113281 16.763672 C 25.010281 16.471672 25.106891 16.154266 25.337891 15.947266 C 25.552891 15.754266 25.756219 15.550938 25.949219 15.335938 C 26.156219 15.104938 26.473625 15.010281 26.765625 15.113281 L 27.892578 15.509766 C 28.119578 15.589766 28.372187 15.496109 28.492188 15.287109 L 28.826172 14.707031 C 28.946172 14.499031 28.902703 14.235125 28.720703 14.078125 L 27.814453 13.300781 C 27.579453 13.098781 27.503609 12.777422 27.599609 12.482422 C 27.687609 12.210422 27.761312 11.932438 27.820312 11.648438 C 27.883312 11.344437 28.111016 11.102922 28.416016 11.044922 L 29.591797 10.822266 C 29.828797 10.781266 30 10.576938 30 10.335938 L 30 9.6640625 C 30 9.4230625 29.828797 9.2178281 29.591797 9.1738281 L 28.416016 8.953125 C 28.111016 8.896125 27.883312 8.6546094 27.820312 8.3496094 C 27.761312 8.0656094 27.687609 7.7856719 27.599609 7.5136719 C 27.503609 7.2186719 27.579453 6.8973125 27.814453 6.6953125 L 28.720703 5.9199219 C 28.903703 5.7629219 28.947172 5.4980625 28.826172 5.2890625 L 28.492188 4.7109375 C 28.372187 4.5029375 28.119578 4.4082812 27.892578 4.4882812 L 26.765625 4.8847656 C 26.473625 4.9877656 26.156219 4.8931094 25.949219 4.6621094 C 25.756219 4.4471094 25.552891 4.2437813 25.337891 4.0507812 C 25.106891 3.8437813 25.010281 3.526375 25.113281 3.234375 L 25.511719 2.1054688 C 25.591719 1.8784687 25.498063 1.6278125 25.289062 1.5078125 L 24.708984 1.171875 C 24.500984 1.051875 24.235125 1.0972969 24.078125 1.2792969 L 23.302734 2.1855469 C 23.100734 2.4205469 22.779375 2.4963906 22.484375 2.4003906 C 22.212375 2.3123906 21.932438 2.2386875 21.648438 2.1796875 C 21.344438 2.1166875 21.102922 1.8870312 21.044922 1.5820312 L 20.824219 0.40625 C 20.782219 0.17025 20.576937 0 20.335938 0 L 19.664062 0 z M 10.664062 8 C 10.423063 8 10.217828 8.17025 10.173828 8.40625 L 9.9882812 9.3945312 C 9.9112813 9.8055313 9.5838281 10.108406 9.1738281 10.191406 C 8.8328281 10.260406 8.497875 10.348078 8.171875 10.455078 C 7.775875 10.585078 7.3413125 10.487875 7.0703125 10.171875 L 6.4199219 9.4121094 C 6.2629219 9.2301094 5.9970625 9.1866406 5.7890625 9.3066406 L 5.2109375 9.640625 C 5.0019375 9.760625 4.9082812 10.013234 4.9882812 10.240234 L 5.3242188 11.191406 C 5.4622188 11.585406 5.3305312 12.009109 5.0195312 12.287109 C 4.7625312 12.517109 4.5180625 12.760578 4.2890625 13.017578 C 4.0110625 13.328578 3.5873594 13.460266 3.1933594 13.322266 L 2.2402344 12.988281 C 2.0132344 12.908281 1.7625781 13.002937 1.6425781 13.210938 L 1.3066406 13.789062 C 1.1856406 13.998062 1.2310625 14.262922 1.4140625 14.419922 L 2.1738281 15.070312 C 2.4898281 15.341313 2.5870312 15.775875 2.4570312 16.171875 C 2.3500312 16.497875 2.2623594 16.832828 2.1933594 17.173828 C 2.1103594 17.583828 1.8074844 17.911281 1.3964844 17.988281 L 0.40820312 18.173828 C 0.17120313 18.217828 0 18.423063 0 18.664062 L 0 19.335938 C 0 19.576937 0.17025 19.782172 0.40625 19.826172 L 1.3945312 20.011719 C 1.8055312 20.088719 2.1084062 20.416172 2.1914062 20.826172 C 2.2604063 21.168172 2.3480781 21.502125 2.4550781 21.828125 C 2.5850781 22.224125 2.487875 22.658687 2.171875 22.929688 L 1.4121094 23.580078 C 1.2301094 23.737078 1.1866406 24.002938 1.3066406 24.210938 L 1.640625 24.789062 C 1.760625 24.998062 2.0132344 25.091719 2.2402344 25.011719 L 3.1914062 24.675781 C 3.5854063 24.537781 4.0091094 24.669469 4.2871094 24.980469 C 4.5171094 25.237469 4.7605781 25.481938 5.0175781 25.710938 C 5.3285781 25.988937 5.4602656 26.412641 5.3222656 26.806641 L 4.9882812 27.759766 C 4.9082812 27.986766 5.0029375 28.237422 5.2109375 28.357422 L 5.7890625 28.693359 C 5.9980625 28.814359 6.2629219 28.768937 6.4199219 28.585938 L 7.0703125 27.826172 C 7.3413125 27.510172 7.775875 27.412969 8.171875 27.542969 C 8.497875 27.649969 8.8328281 27.737641 9.1738281 27.806641 C 9.5838281 27.889641 9.9112813 28.192516 9.9882812 28.603516 L 10.173828 29.591797 C 10.217828 29.828797 10.423063 30 10.664062 30 L 11.335938 30 C 11.576938 30 11.782219 29.82875 11.824219 29.59375 L 12.009766 28.605469 C 12.086766 28.194469 12.414219 27.891594 12.824219 27.808594 C 13.166219 27.739594 13.500172 27.651922 13.826172 27.544922 C 14.222172 27.414922 14.656734 27.512125 14.927734 27.828125 L 15.578125 28.587891 C 15.735125 28.769891 15.999031 28.815313 16.207031 28.695312 L 16.787109 28.359375 C 16.996109 28.239375 17.089766 27.988719 17.009766 27.761719 L 16.675781 26.808594 C 16.537781 26.414594 16.669469 25.990891 16.980469 25.712891 C 17.237469 25.482891 17.481938 25.239422 17.710938 24.982422 C 17.988937 24.671422 18.413641 24.539734 18.806641 24.677734 L 19.759766 25.011719 C 19.986766 25.091719 20.237422 24.997062 20.357422 24.789062 L 20.693359 24.210938 C 20.814359 24.001937 20.768937 23.737078 20.585938 23.580078 L 19.826172 22.929688 C 19.510172 22.658688 19.412969 22.224125 19.542969 21.828125 C 19.649969 21.502125 19.737641 21.167172 19.806641 20.826172 C 19.889641 20.416172 20.192516 20.088719 20.603516 20.011719 L 21.591797 19.826172 C 21.828797 19.782172 22 19.576937 22 19.335938 L 22 18.664062 C 22 18.423063 21.82875 18.218781 21.59375 18.175781 L 20.605469 17.990234 C 20.194469 17.913234 19.891594 17.583828 19.808594 17.173828 C 19.739594 16.832828 19.651922 16.497875 19.544922 16.171875 C 19.414922 15.775875 19.512125 15.343266 19.828125 15.072266 L 20.587891 14.421875 C 20.769891 14.264875 20.815313 13.999016 20.695312 13.791016 L 20.359375 13.210938 C 20.239375 13.001937 19.988719 12.908281 19.761719 12.988281 L 18.808594 13.324219 C 18.414594 13.462219 17.990891 13.330531 17.712891 13.019531 C 17.482891 12.762531 17.239422 12.518062 16.982422 12.289062 C 16.671422 12.011063 16.539734 11.587359 16.677734 11.193359 L 17.011719 10.240234 C 17.091719 10.013234 16.997062 9.7625781 16.789062 9.6425781 L 16.210938 9.3066406 C 16.001938 9.1856406 15.737078 9.2310625 15.580078 9.4140625 L 14.929688 10.173828 C 14.658687 10.489828 14.224125 10.587031 13.828125 10.457031 C 13.502125 10.350031 13.167172 10.262359 12.826172 10.193359 C 12.416172 10.110359 12.088719 9.8074844 12.011719 9.3964844 L 11.826172 8.4082031 C 11.782172 8.1712031 11.576937 8 11.335938 8 L 10.664062 8 z M 20 9 A 1 1 0 0 0 19 10 A 1 1 0 0 0 20 11 A 1 1 0 0 0 21 10 A 1 1 0 0 0 20 9 z M 11 13 C 14.314 13 17 15.686 17 19 C 17 22.314 14.314 25 11 25 C 7.686 25 5 22.314 5 19 C 5 15.686 7.686 13 11 13 z M 11 17 C 9.895 17 9 17.895 9 19 C 9 20.105 9.895 21 11 21 C 12.105 21 13 20.105 13 19 C 13 17.895 12.105 17 11 17 z" />
                                            </svg>
                                            <span className="text-xs font-medium">
                                              {columnAutomationCounts[column.id]}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-md">
                                          <p className="text-xs">
                                            {columnAutomationCounts[column.id]} {columnAutomationCounts[column.id] === 1 ? 'automação ativa' : 'automações ativas'}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground flex-shrink-0">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={`w-56 bg-white dark:bg-[#1b1b1b] border-gray-300 dark:border-gray-700`}>
                                <DropdownMenuItem onClick={() => setIsCriarNegocioModalOpen(true)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Adicionar oportunidade
                                </DropdownMenuItem>
                                {canManageColumns(selectedWorkspace?.workspace_id || undefined) && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedColumnForAction(column.id);
                                    setIsEditarColunaModalOpen(true);
                                  }}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar etapa
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedColumnForAction(column.id);
                                  setIsSelectionMode(true);
                                  setSelectedCardsForTransfer(new Set());
                                }}>
                                  <ArrowRight className="mr-2 h-4 w-4" />
                                  Transferir Oportunidades
                                </DropdownMenuItem>
                                {canManageColumns(selectedWorkspace?.workspace_id || undefined) && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedColumnForExport({ id: column.id, name: column.name });
                                    setIsExportCSVModalOpen(true);
                                  }}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar CSV
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {/* Corpo da coluna - fundo colorido */}
                        <div
                          className="flex-1 p-2 overflow-y-auto min-h-0 bg-[#f9f9f9] dark:bg-[#0a0a0a] transition-all duration-200 scrollbar-thin scrollbar-thumb-gray-column scrollbar-track-transparent relative"
                          onScroll={(e) => {
                            const el = e.currentTarget;
                            const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
                            if (nearBottom) {
                              fetchMoreCards(column.id);
                            }
                          }}
                        >
                        {!isAllColumnsLoaded && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-[#f9f9f9]/80 dark:bg-[#0a0a0a]/80">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground dark:text-gray-400" />
                            </div>
                          </div>
                        )}

                        {!isAllColumnsLoaded ? (
                          <div className="h-24" />
                        ) : columnCards.length === 0 ? (
                          <div className="flex flex-col h-32">
                            {/* Placeholder animado para colunas vazias */}
                            <div 
                              className={`border-2 border-dashed rounded-sm overflow-hidden transition-all duration-150 ease-out ${
                                activeId && !draggedColumn && dragOverColumn === column.id 
                                  ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 opacity-100' 
                                  : 'border-transparent bg-transparent opacity-0 pointer-events-none'
                              }`}
                              style={{ 
                                height: activeId && !draggedColumn && dragOverColumn === column.id ? '85px' : '0px',
                                marginBottom: activeId && !draggedColumn && dragOverColumn === column.id ? '8px' : '0px',
                              }}
                            >
                              <div className="h-full flex items-center justify-center text-xs text-primary/60 dark:text-primary/50">
                                Solte aqui
                              </div>
                            </div>
                            {!(activeId && !draggedColumn && dragOverColumn === column.id) && (
                              <div className="flex items-center justify-center flex-1 text-center">
                                <p className={`text-muted-foreground dark:text-gray-400 text-sm`}>
                                  Nenhuma oportunidade encontrada nesta etapa
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 md:space-y-2">
                            <SortableContext
                              items={columnCards.map(card => `card-${card.id}`)}
                              strategy={verticalListSortingStrategy}
                            >
                                {/* Placeholder animado quando card está sendo arrastado sobre esta coluna */}
                                <div 
                                  className={`border-2 border-dashed rounded-sm overflow-hidden transition-all duration-150 ease-out ${
                                    activeId && !draggedColumn && dragOverColumn === column.id 
                                      ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 opacity-100' 
                                      : 'border-transparent bg-transparent opacity-0 pointer-events-none'
                                  }`}
                                  style={{ 
                                    height: activeId && !draggedColumn && dragOverColumn === column.id ? '85px' : '0px',
                                    marginBottom: activeId && !draggedColumn && dragOverColumn === column.id ? '8px' : '0px',
                                  }}
                                >
                                  <div className="h-full flex items-center justify-center text-xs text-primary/60 dark:text-primary/50">
                                    Solte aqui
                                  </div>
                                </div>
                                {columnCards.map((card, idx) => {
                          const productRelations = Array.isArray((card as any).products) ? (card as any).products : [];
                          const primaryProduct = productRelations.length > 0 ? productRelations[0] : null;
                          const productName = primaryProduct?.product?.name || null;
                          const productId = primaryProduct?.product_id || primaryProduct?.product?.id || null;
                          const productValue = primaryProduct?.total_value ?? primaryProduct?.unit_value ?? primaryProduct?.product?.value ?? (card as any).product_value ?? (card as any).total_value ?? null;
                          const effectiveValue = card.value || productValue || 0;

                          const deal: Deal = {
                            id: card.id,
                            name: card.title || (card as any).description || '',
                            value: effectiveValue,
                            stage: column.name,
                            status: card.status,
                            responsible: card.responsible_user?.name || (card.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
                            responsible_user_id: card.responsible_user_id,
                            responsible_avatar: (card.responsible_user as any)?.avatar,
                            tags: Array.isArray(card.tags) ? card.tags : [],
                            priority: 'medium',
                            created_at: card.created_at,
                            contact: card.contact,
                            conversation: card.conversation ? {
                              ...card.conversation,
                              unread_count: card.conversation.unread_count ?? 0
                            } : (card.conversation_id ? { id: card.conversation_id, unread_count: 0 } : undefined),
                            product_name: productName || undefined,
                            product_id: productId || undefined,
                            product_value: productValue ?? null,
                            hasProduct: !!productId
                          };
                          return (
                              <DraggableDeal key={card.id} deal={deal} isDarkMode={isDarkMode} onClick={() => !isSelectionMode && openCardDetails(card)} onEditPendingTask={(activityId) => openCardDetails(card, { openActivityEditId: activityId })} columnColor={column.color} workspaceId={effectiveWorkspaceId} onOpenTransferModal={handleOpenTransferModal} onVincularResponsavel={handleVincularResponsavel} onChatClick={dealData => {
                            setSelectedChatCard(dealData);
                            setIsChatModalOpen(true);
                          }} onValueClick={dealData => {
                              setSelectedCardForProduct({
                                id: dealData.id,
                                value: dealData.value,
                                productId: dealData.product_id || null
                              });
                              setIsVincularProdutoModalOpen(true);
                          }} onConfigureAgent={(conversationId) => {
                            setSelectedConversationForAgent(conversationId);
                            setAgentModalOpen(true);
                          }} isSelectionMode={isSelectionMode && selectedColumnForAction === column.id} isSelected={selectedCardsForTransfer.has(card.id)} onToggleSelection={() => {
                            const newSet = new Set(selectedCardsForTransfer);
                            if (newSet.has(card.id)) {
                              newSet.delete(card.id);
                            } else {
                              newSet.add(card.id);
                            }
                            setSelectedCardsForTransfer(newSet);
                          }} onEditContact={contactId => {
                            setSelectedContactId(contactId);
                            setIsEditarContatoModalOpen(true);
                          }} onLinkProduct={(cardId, currentValue, currentProductId) => {
                            setSelectedCardForProduct({
                              id: cardId,
                              value: currentValue,
                              productId: currentProductId || null
                            });
                            setIsVincularProdutoModalOpen(true);
                          }} onDeleteCard={cardId => {
                            const card = cards.find(c => c.id === cardId);
                            setSelectedCardForDeletion({
                              id: cardId,
                              name: card?.title || 'este negócio'
                            });
                            setIsDeleteDealModalOpen(true);
                          }} onProductValueLoaded={handleProductValueLoaded} />
                          );
                        })}
                                
                              {!isLoadingCards && hasMoreCardsByColumn?.[column.id] && (
                                <div className="py-2 text-center text-xs text-muted-foreground dark:text-gray-400">
                                  {isLoadingMoreCardsByColumn?.[column.id] ? 'Carregando mais...' : 'Role para carregar mais'}
                                </div>
                              )}

                              {/* Invisible drop zone for empty columns and bottom of lists */}
                              <div className="min-h-[40px] w-full" />
                            </SortableContext>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                            </DroppableColumn>
                          </SortableColumnWrapper>
                        );
            })
          }
          </SortableContext>
        )}
        </div>
      )}
    </div>
  </div>
</div>

<DragOverlay>
          {draggedColumn ? (() => {
            const column = columns.find(col => col.id === draggedColumn);
            if (!column) return null;
            const overlayCardsCount = getFilteredCards(column.id).length;
            return (
              <div
                className="rounded-none border border-[#d4d4d4] dark:border-gray-700 shadow-2xl overflow-hidden"
                style={{
                  width: `${columnWidth ?? 240}px`,
                  minWidth: `${columnWidth ?? 240}px`,
                }}
              >
                {/* ✅ Apenas o TOPO da coluna (sem corpo branco) */}
                <div className="bg-[#f3f3f3] dark:bg-[#1f1f1f] p-2 border-b border-[#d4d4d4] dark:border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground dark:text-gray-100 text-sm truncate">
                        {column.name}
                      </h3>
                      <div className="text-[10px] text-muted-foreground dark:text-gray-400">
                        {overlayCardsCount} {overlayCardsCount === 1 ? 'negócio' : 'negócios'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                      <GripVertical className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground dark:text-gray-400">
                    Arraste para reordenar etapas
                  </div>
                </div>
              </div>
            );
          })() : activeId ? (() => {
            const activeCard = cards.find(card => `card-${card.id}` === activeId);
            if (activeCard) {
              const activeColumn = columns.find(col => col.id === activeCard.column_id);
              const productRelations = Array.isArray((activeCard as any).products) ? (activeCard as any).products : [];
              const primaryProduct = productRelations.length > 0 ? productRelations[0] : null;
              const productId = primaryProduct?.product_id || primaryProduct?.product?.id || null;
              const productName = primaryProduct?.product?.name || null;
              const productValue = primaryProduct?.total_value ?? primaryProduct?.unit_value ?? primaryProduct?.product?.value ?? (activeCard as any).product_value ?? (activeCard as any).total_value ?? null;
              const effectiveValue = activeCard.value || productValue || 0;
              const deal: Deal = {
                id: activeCard.id,
                name: activeCard.title,
                value: effectiveValue,
                stage: activeColumn?.name || "",
                status: activeCard.status,
                responsible: activeCard.responsible_user?.name || (activeCard.conversation?.assigned_user_id ? "Atribuído" : "Não atribuído"),
                responsible_avatar: (activeCard.responsible_user as any)?.avatar,
                tags: Array.isArray(activeCard.tags) ? activeCard.tags : [],
                priority: 'medium',
                created_at: activeCard.created_at,
                contact: activeCard.contact,
                conversation: activeCard.conversation ? {
                  ...activeCard.conversation,
                  unread_count: activeCard.conversation.unread_count ?? 0
                } : (activeCard.conversation_id ? { id: activeCard.conversation_id, unread_count: 0 } : undefined),
                product_id: productId || undefined,
                product_name: productName || undefined,
                product_value: productValue ?? null,
                hasProduct: !!productId
              };
              return <div style={{ width: `${columnWidth ?? 240}px`, maxWidth: `${columnWidth ?? 240}px` }}>
                <DraggableDeal deal={deal} isDarkMode={isDarkMode} onClick={() => {}} onEditPendingTask={(activityId) => openCardDetails(activeCard, { openActivityEditId: activityId })} columnColor={activeColumn?.color} workspaceId={effectiveWorkspaceId} onChatClick={dealData => {
                setSelectedChatCard(dealData);
                setIsChatModalOpen(true);
              }} onValueClick={dealData => {
                if (dealData.hasProduct) {
                  toast({
                    title: "Produto vinculado",
                    description: "Desvincule o produto para definir um valor manual.",
                  });
                  setSelectedCardForProduct({
                    id: dealData.id,
                    value: dealData.value,
                    productId: dealData.product_id || null
                  });
                  setIsVincularProdutoModalOpen(true);
                  return;
                }
                setSelectedCardForValue(dealData);
                setIsSetValueModalOpen(true);
              }} onConfigureAgent={(conversationId) => {
                setSelectedConversationForAgent(conversationId);
                setAgentModalOpen(true);
              }} />
              </div>;
            }
            return null;
          })() : null}
      </DragOverlay>

      {/* Modais */}
      <AddColumnModal open={isAddColumnModalOpen} onOpenChange={setIsAddColumnModalOpen} onAddColumn={handleColumnCreate} isDarkMode={isDarkMode} />

      <PipelineConfigModal open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen} onColumnsReorder={newOrder => {
      // Implementar reordenação se necessário
    }} isDarkMode={isDarkMode} />

                  <FilterModal open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen} onApplyFilters={filters => {
      setAppliedFilters({
        tags: filters.tags,
        queues: filters.queues,
        status: filters.status,
        selectedDate: filters.selectedDate,
        dateRange: filters.dateRange,
        unreadMessages: filters.unreadMessages
      });
    }} isDarkMode={isDarkMode} />

      <CriarPipelineModal isOpen={isCriarPipelineModalOpen} onClose={() => setIsCriarPipelineModalOpen(false)} onSave={handlePipelineCreate} isDarkMode={isDarkMode} />

      <CriarNegocioModal isOpen={isCriarNegocioModalOpen} onClose={() => setIsCriarNegocioModalOpen(false)} onCreateBusiness={handleCreateBusiness} isDarkMode={isDarkMode} onResponsibleUpdated={() => {
      refreshActiveUsers();
    }} />

      <Sheet
        open={isDealDetailsModalOpen && Boolean(selectedDealDetailsForSheet)}
        onOpenChange={(open) => {
          if (!open) {
            setIsDealDetailsModalOpen(false);
            setSelectedCard(null);
            setSelectedDealDetailsForSheet(null);
            setAutoOpenActivityEditId(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="p-0 sm:max-w-[95vw] w-[95vw] max-w-[1400px] h-full border-l border-gray-200 dark:border-gray-800 shadow-2xl transition-all duration-500 ease-in-out [&>button]:hidden"
        >
          {selectedDealDetailsForSheet && (
            <DealDetailsPage
              cardId={selectedDealDetailsForSheet.id}
              workspaceId={effectiveWorkspaceId}
              openActivityEditId={autoOpenActivityEditId || undefined}
              mode={autoOpenActivityEditId ? "activity_edit" : "full"}
              onClose={() => {
                setIsDealDetailsModalOpen(false);
                setSelectedCard(null);
                setSelectedDealDetailsForSheet(null);
                setAutoOpenActivityEditId(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ChatModal isOpen={isChatModalOpen} onClose={() => {
      setIsChatModalOpen(false);
    }} conversationId={selectedChatCard?.conversation?.id || selectedChatCard?.conversation_id || ""} contactName={selectedChatCard?.contact?.name || selectedChatCard?.name || ""} contactPhone={selectedChatCard?.contact?.phone || ""} contactAvatar={selectedChatCard?.contact?.profile_image_url || ""} contactId={selectedChatCard?.contact?.id || ""} />

      <TransferirModal isOpen={isTransferirModalOpen} onClose={() => {
      setIsTransferirModalOpen(false);
      setSelectedColumnForAction(null);
      setIsSelectionMode(false);
      setSelectedCardsForTransfer(new Set());
    }} selectedCards={Array.from(selectedCardsForTransfer)} currentPipelineId={selectedPipeline?.id || ""} currentPipelineName={selectedPipeline?.name || ""} onTransferComplete={() => {
      refreshCurrentPipeline();
      setIsSelectionMode(false);
      setSelectedCardsForTransfer(new Set());
      setSelectedColumnForAction(null);
    }} isDarkMode={isDarkMode} />

      <SetValueModal isOpen={isSetValueModalOpen} onClose={() => {
      setIsSetValueModalOpen(false);
      setSelectedCardForValue(null);
    }} onSave={handleSetCardValue} currentValue={selectedCardForValue?.value || 0} isDarkMode={isDarkMode} canEdit={!selectedCardForValue?.hasProduct} />

      <EditarColunaModal 
        open={isEditarColunaModalOpen} 
        onOpenChange={setIsEditarColunaModalOpen} 
        columnId={selectedColumnForAction} 
        columnName={columns.find(c => c.id === selectedColumnForAction)?.name || ''} 
        columnColor={columns.find(c => c.id === selectedColumnForAction)?.color || '#000000'} 
        columnIcon={columns.find(c => c.id === selectedColumnForAction)?.icon}
        onUpdate={() => {
          refreshCurrentPipeline();
        }} 
        isDarkMode={isDarkMode}
      />

      <EditarContatoModal isOpen={isEditarContatoModalOpen} onClose={() => {
      setIsEditarContatoModalOpen(false);
      setSelectedContactId(null);
    }} contactId={selectedContactId} onContactUpdated={() => refreshCurrentPipeline()} />

      <VincularProdutoModal isOpen={isVincularProdutoModalOpen} onClose={() => {
      setIsVincularProdutoModalOpen(false);
      setSelectedCardForProduct(null);
    }} cardId={selectedCardForProduct?.id || null} currentValue={selectedCardForProduct?.value || 0} currentProductId={selectedCardForProduct?.productId || null} onProductLinked={() => refreshCurrentPipeline()} />

      <VincularResponsavelModal isOpen={isVincularResponsavelModalOpen} onClose={() => {
      setIsVincularResponsavelModalOpen(false);
      setSelectedCardForResponsavel(null);
    }} cardId={selectedCardForResponsavel?.cardId || ""} conversationId={selectedCardForResponsavel?.conversationId} contactId={selectedCardForResponsavel?.contactId} currentResponsibleId={selectedCardForResponsavel?.currentResponsibleId} onSuccess={() => refreshCurrentPipeline()} onResponsibleUpdated={() => {
      refreshActiveUsers();
    }} />

      <ChangeAgentModal 
        open={agentModalOpen && !!selectedConversationForAgent} 
        onOpenChange={(open) => {
          setAgentModalOpen(open);
          if (!open) {
            setSelectedConversationForAgent(null);
          }
        }} 
        conversationId={selectedConversationForAgent || ''}
        currentAgentId={currentAgentId}
        onAgentChanged={() => {
          queryClient.invalidateQueries({ queryKey: ['pipeline-cards'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-agent'] });
        }}
      />

      <DeleteDealModal isOpen={isDeleteDealModalOpen} onClose={() => {
      setIsDeleteDealModalOpen(false);
      setSelectedCardForDeletion(null);
    }} onConfirm={async () => {
      if (!selectedCardForDeletion) return;
      try {
        const headers = getHeaders();
        const {
          data,
          error
        } = await supabase.functions.invoke(`pipeline-management/cards?id=${selectedCardForDeletion.id}`, {
          method: 'DELETE',
          headers
        });
        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Negócio excluído permanentemente"
        });
        refreshCurrentPipeline();
      } catch (error) {
        console.error('Erro ao excluir negócio:', error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao excluir negócio",
          variant: "destructive"
        });
      } finally {
      setIsDeleteDealModalOpen(false);
      setSelectedCardForDeletion(null);
    }
  }} dealName={selectedCardForDeletion?.name} />

      <ExportCSVModal 
        isOpen={isExportCSVModalOpen} 
        onClose={() => {
          setIsExportCSVModalOpen(false);
          setSelectedColumnForExport(null);
        }} 
        columnName={selectedColumnForExport?.name || ''} 
        cards={selectedColumnForExport ? getCardsByColumn(selectedColumnForExport.id).map(card => ({
          ...card,
          pipeline: { name: selectedPipeline?.name || '' }
        })) : []} 
      />
    </DndContext>
  );
}

// Componente exportado com Provider
export function CRMNegocios(props: CRMNegociosProps) {
  const { isDarkMode = false, onCollapseSidebar } = props;
  return (
    <PipelinesProvider>
      <CRMNegociosContent isDarkMode={isDarkMode} onCollapseSidebar={onCollapseSidebar} />
    </PipelinesProvider>
  );
}