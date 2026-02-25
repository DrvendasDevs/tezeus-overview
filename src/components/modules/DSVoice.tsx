import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// Removido Table shadcn em favor de table nativa HTML estilo Excel
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MessageSquare, Mic, Image, FileText, Filter, Play, Settings, Search, Edit, Trash2, Upload, Plus, GripVertical, Download, Sparkles } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from "@/lib/utils";
import { useQuickMessages } from "@/hooks/useQuickMessages";
import { useQuickAudios } from "@/hooks/useQuickAudios";
import { useQuickMedia } from "@/hooks/useQuickMedia";
import { useQuickDocuments } from "@/hooks/useQuickDocuments";
import { useQuickFunnels, FunnelStep, Funnel } from "@/hooks/useQuickFunnels";
import { ImageModal } from '@/components/chat/ImageModal';
import { VideoModal } from '@/components/chat/VideoModal';
import { DocumentPreviewModal } from '@/components/chat/DocumentPreviewModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const categories = [{
  id: "mensagens",
  label: "Mensagens",
  icon: MessageSquare
}, {
  id: "audios",
  label: "Áudios",
  icon: Mic
}, {
  id: "midias",
  label: "Mídias",
  icon: Image
}, {
  id: "documentos",
  label: "Documentos",
  icon: FileText
}, {
  id: "funis",
  label: "Funis",
  icon: Filter
}
// Ocultado temporariamente - { id: "gatilhos", label: "Gatilhos", icon: Play },
// Ocultado temporariamente - { id: "configuracoes", label: "Configurações", icon: Settings },
];

interface SortableFunnelStepProps {
  step: any;
  index: number;
  itemDetails: any;
  onDelete: (id: string) => void;
}

function SortableFunnelStep({ step, index, itemDetails, onDelete }: SortableFunnelStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = step.type === "mensagens" ? MessageSquare : step.type === "audios" ? Mic : step.type === "midias" ? Image : FileText;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="p-3 mb-2 dark:bg-[#1a1a1a] dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab hover:text-primary text-muted-foreground touch-none dark:text-gray-400">
             <GripVertical className="h-4 w-4" />
          </div>
          <div className="flex-shrink-0 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium">
            {index + 1}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 dark:text-gray-300" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{itemDetails?.title || 'Item não encontrado'}</p>
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              {step.type} • Delay: {step.delayMinutes}min {step.delaySeconds}s
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onDelete(step.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function DSVoice() {
  const DEFAULT_PAGE_SIZE = 100;
  const MIN_PAGE_SIZE = 10;
  const [activeCategory, setActiveCategory] = useState("mensagens");
  const [searchTerm, setSearchTerm] = useState("");
  const { userRole } = useAuth();

  // Estados para modais de mensagens
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [isAiAgentMessage, setIsAiAgentMessage] = useState(false);
  const [isMessageVisibleToAll, setIsMessageVisibleToAll] = useState(false);
  const [allowEditBeforeSend, setAllowEditBeforeSend] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Estados para modais de áudios
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAiAgentAudio, setIsAiAgentAudio] = useState(false);
  const [isAudioVisibleToAll, setIsAudioVisibleToAll] = useState(false);
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);

  // Estados para modais de mídias
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [isAiAgentMedia, setIsAiAgentMedia] = useState(false);
  const [isMediaVisibleToAll, setIsMediaVisibleToAll] = useState(false);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingMediaFileName, setEditingMediaFileName] = useState<string>("");

  // Estados para modais de documentos
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentCaption, setDocumentCaption] = useState("");
  const [isAiAgentDocument, setIsAiAgentDocument] = useState(false);
  const [isDocumentVisibleToAll, setIsDocumentVisibleToAll] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingDocumentFileName, setEditingDocumentFileName] = useState<string>("");

  // Estados para funis
  const [isFunnelModalOpen, setIsFunnelModalOpen] = useState(false);
  const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
  const [funnelName, setFunnelName] = useState("");
  const [funnelSteps, setFunnelSteps] = useState<any[]>([]);
  const [isAiAgentFunnel, setIsAiAgentFunnel] = useState(false);
  const [isFunnelVisibleToAll, setIsFunnelVisibleToAll] = useState(false);
  const [selectedStepType, setSelectedStepType] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [stepMinutes, setStepMinutes] = useState(0);
  const [stepSeconds, setStepSeconds] = useState(0);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  
  // Selection states for checkboxes (Excel style)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Estados para visualização de mídia
  const [viewingMedia, setViewingMedia] = useState<{ type: 'image' | 'video'; url: string; title: string } | null>(null);
  const [viewingDocument, setViewingDocument] = useState<{ url: string; title: string; type: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Paginação unificada por categoria ativa
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setFunnelSteps((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Hooks para dados reais
  const {
    messages,
    loading: messagesLoading,
    createMessage,
    updateMessage,
    deleteMessage
  } = useQuickMessages();
  const {
    audios,
    loading: audiosLoading,
    createAudio,
    updateAudio,
    deleteAudio
  } = useQuickAudios();
  const {
    media,
    loading: mediaLoading,
    createMedia,
    updateMedia,
    deleteMedia
  } = useQuickMedia();
  const {
    documents,
    loading: documentsLoading,
    createDocument,
    updateDocument,
    deleteDocument
  } = useQuickDocuments();
  const {
    funnels,
    loading: funnelsLoading,
    createFunnel,
    updateFunnel,
    deleteFunnel
  } = useQuickFunnels();

  // Funções de conversão entre formato do componente e formato do banco
  const componentTypeToDbType = (type: string): 'message' | 'audio' | 'media' | 'document' => {
    switch (type) {
      case 'mensagens':
        return 'message';
      case 'audios':
        return 'audio';
      case 'midias':
        return 'media';
      case 'documentos':
        return 'document';
      default:
        return 'message';
    }
  };
  const dbTypeToComponentType = (type: string): string => {
    switch (type) {
      case 'message':
        return 'mensagens';
      case 'audio':
        return 'audios';
      case 'media':
        return 'midias';
      case 'document':
        return 'documentos';
      default:
        return type;
    }
  };
  const convertStepToDbFormat = (step: any, index: number): FunnelStep => {
    return {
      id: step.id || Date.now().toString() + index,
      type: componentTypeToDbType(step.type),
      item_id: step.itemId,
      delay_seconds: (step.delayMinutes || 0) * 60 + (step.delaySeconds || 0),
      order: index
    };
  };
  const convertStepFromDbFormat = (step: FunnelStep): any => {
    return {
      id: step.id,
      type: dbTypeToComponentType(step.type),
      itemId: step.item_id,
      delayMinutes: Math.floor(step.delay_seconds / 60),
      delaySeconds: step.delay_seconds % 60
    };
  };

  // Handlers para mensagens
  const handleCreateMessage = async () => {
    if (messageTitle.trim() && messageContent.trim()) {
      if (editingMessageId) {
        await updateMessage(editingMessageId, messageTitle, messageContent, isAiAgentMessage, {
          visibleToAll: isMessageVisibleToAll,
          allowEditBeforeSend
        });
      } else {
        await createMessage(messageTitle, messageContent, isAiAgentMessage, {
          visibleToAll: isMessageVisibleToAll,
          allowEditBeforeSend
        });
      }
      handleCloseMessageModal();
    }
  };
  const handleEditMessage = (message: any) => {
    setMessageTitle(message.title);
    setMessageContent(message.content);
    setIsAiAgentMessage(message.is_ai_agent || false);
    setIsMessageVisibleToAll(Boolean(message.visible_to_all));
    setAllowEditBeforeSend(Boolean(message.allow_edit_before_send));
    setEditingMessageId(message.id);
    setIsMessageModalOpen(true);
  };
  const handleDeleteMessage = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mensagem?')) {
      await deleteMessage(id);
    }
  };
  const handleCloseMessageModal = () => {
    setIsMessageModalOpen(false);
    setMessageTitle("");
    setMessageContent("");
    setIsAiAgentMessage(false);
    setIsMessageVisibleToAll(false);
    setAllowEditBeforeSend(false);
    setEditingMessageId(null);
  };
  const handleOpenNewMessageModal = () => {
    setMessageTitle("");
    setMessageContent("");
    setIsAiAgentMessage(false);
    setIsMessageVisibleToAll(false);
    setAllowEditBeforeSend(false);
    setEditingMessageId(null);
    setIsMessageModalOpen(true);
  };

  // Handlers para áudios
  const handleCreateAudio = async () => {
    if (audioTitle.trim() && audioFile) {
      if (editingAudioId) {
        await updateAudio(editingAudioId, audioTitle, audioFile, isAiAgentAudio, {
          visibleToAll: isAudioVisibleToAll
        });
      } else {
        await createAudio(audioTitle, audioFile, isAiAgentAudio, {
          visibleToAll: isAudioVisibleToAll
        });
      }
      handleCloseAudioModal();
    }
  };
  const handleEditAudio = (audio: any) => {
    setAudioTitle(audio.title);
    setIsAiAgentAudio(audio.is_ai_agent || false);
    setIsAudioVisibleToAll(Boolean(audio.visible_to_all));
    setEditingAudioId(audio.id);
    setIsAudioModalOpen(true);
  };
  const handleDeleteAudio = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este áudio?')) {
      await deleteAudio(id);
    }
  };
  const handleCloseAudioModal = () => {
    setIsAudioModalOpen(false);
    setAudioTitle("");
    setAudioFile(null);
    setIsAiAgentAudio(false);
    setIsAudioVisibleToAll(false);
    setEditingAudioId(null);
  };
  const handleOpenNewAudioModal = () => {
    setAudioTitle("");
    setAudioFile(null);
    setIsAiAgentAudio(false);
    setIsAudioVisibleToAll(false);
    setEditingAudioId(null);
    setIsAudioModalOpen(true);
  };

  // Handlers para mídias
  const handleCreateMedia = async () => {
    if (!mediaTitle.trim()) return;
    if (editingMediaId) {
      // Ao editar, arquivo é opcional
      await updateMedia(editingMediaId, mediaTitle, mediaFile || undefined, mediaCaption, isAiAgentMedia, {
        visibleToAll: isMediaVisibleToAll
      });
    } else {
      // Ao criar, arquivo é obrigatório
      if (!mediaFile) return;
      await createMedia(mediaTitle, mediaFile, mediaCaption, isAiAgentMedia, {
        visibleToAll: isMediaVisibleToAll
      });
    }
    handleCloseMediaModal();
  };
  const handleEditMedia = (mediaItem: any) => {
    setEditingMediaId(mediaItem.id);
    setMediaTitle(mediaItem.title);
    setMediaCaption(mediaItem.caption || "");
    setIsAiAgentMedia(mediaItem.is_ai_agent || false);
    setIsMediaVisibleToAll(Boolean(mediaItem.visible_to_all));
    setEditingMediaFileName(mediaItem.file_name || "");
    setIsMediaModalOpen(true);
  };
  const handleDeleteMedia = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta mídia?')) {
      await deleteMedia(id);
    }
  };
  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setMediaTitle("");
    setMediaFile(null);
    setMediaCaption("");
    setIsAiAgentMedia(false);
    setIsMediaVisibleToAll(false);
    setEditingMediaId(null);
    setEditingMediaFileName("");
  };
  const handleOpenNewMediaModal = () => {
    setMediaTitle("");
    setMediaFile(null);
    setMediaCaption("");
    setIsAiAgentMedia(false);
    setIsMediaVisibleToAll(false);
    setEditingMediaId(null);
    setEditingMediaFileName("");
    setIsMediaModalOpen(true);
  };

  // Handlers para documentos
  const handleCreateDocument = async () => {
    if (!documentTitle.trim()) return;
    if (editingDocumentId) {
      // Ao editar, arquivo é opcional
      await updateDocument(editingDocumentId, documentTitle, documentFile || undefined, documentCaption, isAiAgentDocument, {
        visibleToAll: isDocumentVisibleToAll
      });
    } else {
      // Ao criar, arquivo é obrigatório
      if (!documentFile) return;
      await createDocument(documentTitle, documentFile, documentCaption, isAiAgentDocument, {
        visibleToAll: isDocumentVisibleToAll
      });
    }
    handleCloseDocumentModal();
  };
  const handleEditDocument = (document: any) => {
    setDocumentTitle(document.title);
    setDocumentCaption(document.caption || "");
    setIsAiAgentDocument(document.is_ai_agent || false);
    setIsDocumentVisibleToAll(Boolean(document.visible_to_all));
    setEditingDocumentId(document.id);
    setEditingDocumentFileName(document.file_name || "");
    setIsDocumentModalOpen(true);
  };
  const handleDeleteDocument = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
      await deleteDocument(id);
    }
  };
  const handleCloseDocumentModal = () => {
    setIsDocumentModalOpen(false);
    setDocumentTitle("");
    setDocumentFile(null);
    setDocumentCaption("");
    setIsAiAgentDocument(false);
    setIsDocumentVisibleToAll(false);
    setEditingDocumentId(null);
    setEditingDocumentFileName("");
  };
  const handleOpenNewDocumentModal = () => {
    setDocumentTitle("");
    setDocumentFile(null);
    setDocumentCaption("");
    setIsAiAgentDocument(false);
    setIsDocumentVisibleToAll(false);
    setEditingDocumentId(null);
    setEditingDocumentFileName("");
    setIsDocumentModalOpen(true);
  };

  // Handlers para funis
  const handleOpenFunnelModal = () => {
    setFunnelName("");
    setFunnelSteps([]);
    setIsAiAgentFunnel(false);
    setIsFunnelVisibleToAll(false);
    setEditingFunnelId(null);
    setIsFunnelModalOpen(true);
  };
  const handleCloseFunnelModal = () => {
    setIsFunnelModalOpen(false);
    setFunnelName("");
    setFunnelSteps([]);
    setIsAiAgentFunnel(false);
    setIsFunnelVisibleToAll(false);
    setEditingFunnelId(null);
  };
  const handleEditFunnel = (funnel: Funnel) => {
    setFunnelName(funnel.title);
    setFunnelSteps(funnel.steps.map(convertStepFromDbFormat));
    setIsAiAgentFunnel(funnel.is_ai_agent || false);
    setIsFunnelVisibleToAll(Boolean((funnel as any).visible_to_all));
    setEditingFunnelId(funnel.id);
    setIsFunnelModalOpen(true);
  };
  const handleDeleteFunnel = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este funil?')) {
      await deleteFunnel(id);
    }
  };
  const handleOpenAddStepModal = () => {
    setSelectedStepType(null);
    setSelectedItemId("");
    setStepMinutes(0);
    setStepSeconds(0);
    setIsAddStepModalOpen(true);
  };
  const handleCloseAddStepModal = () => {
    setIsAddStepModalOpen(false);
    setSelectedStepType(null);
    setSelectedItemId("");
    setStepMinutes(0);
    setStepSeconds(0);
  };
  const handleAddStep = () => {
    if (selectedStepType && selectedItemId) {
      const newStep = {
        id: Date.now().toString(),
        type: selectedStepType,
        itemId: selectedItemId,
        delayMinutes: stepMinutes,
        delaySeconds: stepSeconds
      };
      setFunnelSteps([...funnelSteps, newStep]);
      handleCloseAddStepModal();
    }
  };
  const handleSaveFunnel = async () => {
    if (funnelName.trim() && funnelSteps.length > 0) {
      // Converter steps para formato do banco
      const dbSteps: FunnelStep[] = funnelSteps.map((step, index) => convertStepToDbFormat(step, index));
      if (editingFunnelId) {
        // Atualizar funil existente
        await updateFunnel(editingFunnelId, funnelName, dbSteps, isAiAgentFunnel, {
          visibleToAll: isFunnelVisibleToAll
        });
      } else {
        // Criar novo funil
        await createFunnel(funnelName, dbSteps, isAiAgentFunnel, {
          visibleToAll: isFunnelVisibleToAll
        });
      }
      handleCloseFunnelModal();
    }
  };
  const getItemDetails = (type: string, itemId: string) => {
    // Converter tipo do banco para tipo do componente se necessário
    const componentType = dbTypeToComponentType(type);
    switch (componentType) {
      case "mensagens":
        return messages.find(m => m.id === itemId);
      case "audios":
        return audios.find(a => a.id === itemId);
      case "midias":
        return media.find(m => m.id === itemId);
      case "documentos":
        return documents.find(d => d.id === itemId);
      default:
        return null;
    }
  };

  // Filtrar dados baseado no termo de busca
  const filteredMessages = messages.filter(msg => msg.title.toLowerCase().includes(searchTerm.toLowerCase()) || msg.content.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredAudios = audios.filter(audio => audio.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredMedia = media.filter(mediaItem => mediaItem.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDocuments = documents.filter(doc => doc.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredFunnels = funnels.filter(funnel => funnel.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Derivar dados ativos e paginação
  const getActiveData = () => {
    switch (activeCategory) {
      case "mensagens":
        return filteredMessages;
      case "audios":
        return filteredAudios;
      case "midias":
        return filteredMedia;
      case "documentos":
        return filteredDocuments;
      case "funis":
        return filteredFunnels;
      default:
        return [];
    }
  };

  const totalCount = getActiveData().length;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };

  // Renderizador de tabelas Excel
  const renderTable = (headers: string[], data: any[], renderRow: (item: any) => React.ReactNode) => {
    return (
      <div className="inline-block min-w-full align-middle bg-white dark:bg-[#0f0f0f]">
        <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
          <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
                >
                  <div className="flex items-center justify-between">
                    <span>{header}</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                  </div>
                </th>
              ))}
              <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px] dark:border-gray-700 dark:text-gray-200">
                <div className="flex items-center justify-between">
                   <span>Ações</span>
                   <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground dark:border-gray-700 dark:bg-[#141414] dark:text-gray-400">
                  Nenhum item encontrado.
                </td>
              </tr>
            ) : (
              data.map((item) => renderRow(item))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    const loading = messagesLoading || audiosLoading || mediaLoading || documentsLoading || funnelsLoading;
    if (loading) {
      return <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground dark:text-gray-400">Carregando...</div>
        </div>;
    }

    const data = getActiveData();
    const paginatedData = data.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    switch (activeCategory) {
      case "mensagens":
        return renderTable(
          ["Título", "Conteúdo"],
          paginatedData,
          (message) => (
            <tr key={message.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
              <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap font-medium dark:border-gray-700 dark:text-gray-100">{message.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 max-w-xl truncate dark:border-gray-700 dark:text-gray-200" title={message.content}>{message.content}</td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]" onClick={() => handleEditMessage(message)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#3b1f1f]" onClick={() => handleDeleteMessage(message.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "audios":
        return renderTable(
          ["Título", "Arquivo", "Preview"],
          paginatedData,
          (audio) => (
            <tr key={audio.id} className="hover:bg-blue-50 group h-[40px] dark:hover:bg-[#1f2937]">
              <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap font-medium dark:border-gray-700 dark:text-gray-100">{audio.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 dark:border-gray-700 dark:text-gray-200">{audio.file_name}</td>
              <td className="border border-[#e0e0e0] px-2 py-1 w-[250px] dark:border-gray-700">
                {audio.file_url ? (
                  <audio controls className="h-8 w-full" src={audio.file_url} />
                ) : (
                  <span className="text-xs text-muted-foreground dark:text-gray-400">Sem áudio</span>
                )}
              </td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]" onClick={() => handleEditAudio(audio)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#3b1f1f]" onClick={() => handleDeleteAudio(audio.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "midias":
        return renderTable(
          ["Preview", "Título", "Arquivo", "Tipo"],
          paginatedData,
          (mediaItem) => (
            <tr key={mediaItem.id} className="hover:bg-blue-50 group h-[40px] dark:hover:bg-[#1f2937]">
              <td className="border border-[#e0e0e0] px-2 py-0 w-[50px] dark:border-gray-700">
                <div 
                  className="w-8 h-8 bg-muted rounded overflow-hidden flex items-center justify-center mx-auto my-0.5 cursor-pointer hover:opacity-80 transition-opacity dark:bg-[#1f1f1f]"
                  onClick={() => {
                    if (mediaItem.file_url) {
                      setViewingMedia({
                        type: mediaItem.file_type.startsWith('video/') ? 'video' : 'image',
                        url: mediaItem.file_url,
                        title: mediaItem.title
                      });
                    }
                  }}
                >
                  {mediaItem.file_type.startsWith('image/') && mediaItem.file_url ? (
                    <img
                      src={mediaItem.file_url}
                      alt={mediaItem.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : mediaItem.file_type.startsWith('video/') ? (
                    <Play className="h-3 w-3 text-muted-foreground dark:text-gray-400" />
                  ) : (
                    <Image className="h-3 w-3 text-muted-foreground dark:text-gray-400" />
                  )}
                </div>
              </td>
              <td className="border border-[#e0e0e0] px-2 py-0 font-medium dark:border-gray-700 dark:text-gray-100">{mediaItem.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 truncate max-w-[200px] dark:border-gray-700 dark:text-gray-200">{mediaItem.file_name}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 dark:border-gray-700 dark:text-gray-200">{mediaItem.file_type}</td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                 <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]" onClick={() => handleEditMedia(mediaItem)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#3b1f1f]" onClick={() => handleDeleteMedia(mediaItem.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "documentos":
        return renderTable(
          ["Preview", "Título", "Arquivo", "Tamanho"],
          paginatedData,
          (document) => {
             const getDocIcon = () => {
              const ext = (document.file_name?.split('.').pop() || document.file_type || 'file').slice(0,4).toUpperCase();
              return (
                <div className="w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-200 flex items-center justify-center text-[10px] font-semibold uppercase">
                  {ext}
                </div>
              );
            };
            return (
              <tr key={document.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                <td className="border border-[#e0e0e0] px-2 py-0 w-[50px] dark:border-gray-700">
                  <div 
                    className="w-8 h-8 bg-muted rounded overflow-hidden flex items-center justify-center mx-auto my-0.5 cursor-pointer hover:opacity-80 transition-opacity dark:bg-[#1f1f1f]"
                    onClick={() => {
                      if (document.file_url) {
                        setViewingDocument({
                          url: document.file_url,
                          title: document.title,
                          type: document.file_type
                        });
                      }
                    }}
                    title="Visualizar documento"
                  >
                    {getDocIcon()}
                  </div>
                </td>
                <td className="border border-[#e0e0e0] px-2 py-0 font-medium dark:border-gray-700 dark:text-gray-100">{document.title}</td>
                <td className="border border-[#e0e0e0] px-2 py-0 truncate max-w-[200px] dark:border-gray-700 dark:text-gray-200">{document.file_name}</td>
                <td className="border border-[#e0e0e0] px-2 py-0 dark:border-gray-700 dark:text-gray-200">
                   {document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
                </td>
                <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                  <div className="flex items-center justify-center gap-1 h-full">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]" onClick={() => handleEditDocument(document)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#3b1f1f]" onClick={() => handleDeleteDocument(document.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          }
        );
      case "funis":
        return renderTable(
          ["Nome do Funil", "Qtd. Etapas"],
          paginatedData,
          (funnel) => (
            <tr key={funnel.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
              <td className="border border-[#e0e0e0] px-2 py-0 font-medium dark:border-gray-700 dark:text-gray-100">{funnel.title}</td>
              <td className="border border-[#e0e0e0] px-2 py-0 dark:border-gray-700">
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium dark:bg-[#1f1f1f] dark:text-gray-200">
                  {funnel.steps.length} etapas
                </span>
              </td>
              <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                <div className="flex items-center justify-center gap-1 h-full">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]" onClick={() => handleEditFunnel(funnel)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#3b1f1f]" onClick={() => handleDeleteFunnel(funnel.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          )
        );
      case "gatilhos":
        return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground dark:text-gray-400">
             <Play className="h-10 w-10 mb-2 opacity-20" />
             <p>Funcionalidade em desenvolvimento.</p>
          </div>;
      case "configuracoes":
        return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground dark:text-gray-400">
            <Settings className="h-10 w-10 mb-2 opacity-20" />
            <p>Funcionalidade em desenvolvimento.</p>
          </div>;
      default:
        return null;
    }
  };

  // Resetar página ao trocar categoria, busca ou pageSize
  useEffect(() => {
    setPage(1);
  }, [activeCategory, searchTerm, pageSize]);

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0f0f0f] dark:border-gray-700">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:bg-[#141414] dark:border-gray-700">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Mensagens Rápidas
            </span>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
           {/* Search Group */}
           <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 dark:border-gray-700">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3 dark:text-gray-400" />
              <Input
                placeholder="Pesquisar item..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#181818] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={() => {
                if (activeCategory === "mensagens") handleOpenNewMessageModal();
                else if (activeCategory === "audios") handleOpenNewAudioModal();
                else if (activeCategory === "midias") handleOpenNewMediaModal();
                else if (activeCategory === "documentos") handleOpenNewDocumentModal();
                else if (activeCategory === "funis") setIsFunnelModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[9px]">Novo Item</span>
            </Button>

          </div>
        </div>

        {/* Categories Tabs */}
        <div className="flex items-end px-2 gap-1 border-t border-gray-200 bg-[#f8f9fa] pt-2 dark:border-gray-700 dark:bg-[#141414]">
            {categories.map(category => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-t-md border-t border-x transition-all relative top-[1px]",
                    isActive 
                      ? "bg-white border-[#d4d4d4] border-b-white text-black z-10 shadow-sm dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-white" 
                      : "bg-transparent border-transparent text-gray-500 hover:bg-gray-200/50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-[#1f1f1f] dark:hover:text-gray-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{category.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Content Area (Table) */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505]">
        {renderContent()}
      </div>
      <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Linhas {startIndex}-{endIndex} de {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <span>Linhas/página:</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
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
              disabled={page === 1}
            >
              Anterior
            </button>
            <span>
              Página {page} / {totalPages}
            </span>
            <button
              className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modals - Mantidos iguais */}
      
      {/* Modal para Mensagens */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{editingMessageId ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              {editingMessageId ? 'Edite os dados da mensagem rápida.' : 'Crie uma nova mensagem rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Título</label>
              <Input value={messageTitle} onChange={e => setMessageTitle(e.target.value)} placeholder="Digite o título da mensagem" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Conteúdo</label>
              <Textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} placeholder="Digite o conteúdo da mensagem" rows={4} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            {userRole === 'master' && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ai-agent-message" 
                  checked={isAiAgentMessage} 
                  onCheckedChange={(checked) => setIsAiAgentMessage(!!checked)} 
                />
                <Label htmlFor="ai-agent-message" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200">
                  Exclusivo Agente IA
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Visível para todos
              </Label>
              <Switch checked={isMessageVisibleToAll} onCheckedChange={setIsMessageVisibleToAll} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Editar ao enviar
              </Label>
              <Switch checked={allowEditBeforeSend} onCheckedChange={setAllowEditBeforeSend} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMessageModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleCreateMessage} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground">
                {editingMessageId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Áudios */}
      <Dialog open={isAudioModalOpen} onOpenChange={setIsAudioModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{editingAudioId ? 'Editar Áudio' : 'Novo Áudio'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              {editingAudioId ? 'Edite os dados do áudio rápido.' : 'Adicione um novo áudio rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Título</label>
              <Input value={audioTitle} onChange={e => setAudioTitle(e.target.value)} placeholder="Digite o título do áudio" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Arquivo de Áudio</label>
              <Input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 file:dark:text-gray-100" />
            </div>
            {userRole === 'master' && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ai-agent-audio" 
                  checked={isAiAgentAudio} 
                  onCheckedChange={(checked) => setIsAiAgentAudio(!!checked)} 
                />
                <Label htmlFor="ai-agent-audio" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200">
                  Exclusivo Agente IA
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Visível para todos
              </Label>
              <Switch checked={isAudioVisibleToAll} onCheckedChange={setIsAudioVisibleToAll} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseAudioModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleCreateAudio} disabled={!audioTitle.trim() || !audioFile && !editingAudioId} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 dark:bg-primary dark:text-primary-foreground">
                {editingAudioId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Mídias */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{editingMediaId ? 'Editar Mídia' : 'Nova Mídia'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              {editingMediaId ? 'Edite os dados da mídia rápida.' : 'Adicione uma nova mídia rápida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Título</label>
              <Input value={mediaTitle} onChange={e => setMediaTitle(e.target.value)} placeholder="Digite o título da mídia" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Arquivo de Mídia</label>
              {editingMediaId && editingMediaFileName && <p className="text-xs text-muted-foreground mb-2 dark:text-gray-400">
                  Arquivo atual: <span className="font-medium">{editingMediaFileName}</span>
                </p>}
              <Input type="file" accept="image/*,video/*" onChange={e => setMediaFile(e.target.files?.[0] || null)} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 file:dark:text-gray-100" />
              {editingMediaId && <p className="text-xs text-muted-foreground mt-1 dark:text-gray-500">
                  Deixe em branco para manter o arquivo atual
                </p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Legenda (Caption)</label>
              <Textarea value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Digite a legenda para a mídia (opcional)" rows={3} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            {userRole === 'master' && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ai-agent-media" 
                  checked={isAiAgentMedia} 
                  onCheckedChange={(checked) => setIsAiAgentMedia(!!checked)} 
                />
                <Label htmlFor="ai-agent-media" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200">
                  Exclusivo Agente IA
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Visível para todos
              </Label>
              <Switch checked={isMediaVisibleToAll} onCheckedChange={setIsMediaVisibleToAll} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseMediaModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleCreateMedia} disabled={!mediaTitle.trim() || !mediaFile && !editingMediaId} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 dark:bg-primary dark:text-primary-foreground">
                {editingMediaId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Documentos */}
      <Dialog open={isDocumentModalOpen} onOpenChange={setIsDocumentModalOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{editingDocumentId ? 'Editar Documento' : 'Novo Documento'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              {editingDocumentId ? 'Edite os dados do documento rápido.' : 'Adicione um novo documento rápido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Título</label>
              <Input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)} placeholder="Digite o título do documento" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Arquivo do Documento</label>
              {editingDocumentId && editingDocumentFileName && <p className="text-xs text-muted-foreground mb-2 dark:text-gray-400">
                  Arquivo atual: <span className="font-medium">{editingDocumentFileName}</span>
                </p>}
              <Input type="file" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" onChange={e => setDocumentFile(e.target.files?.[0] || null)} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 file:dark:text-gray-100" />
              {editingDocumentId && <p className="text-xs text-muted-foreground mt-1 dark:text-gray-500">
                  Deixe em branco para manter o arquivo atual
                </p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Legenda (Caption)</label>
              <Textarea value={documentCaption} onChange={e => setDocumentCaption(e.target.value)} placeholder="Digite a legenda para o documento (opcional)" rows={3} className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>
            {userRole === 'master' && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ai-agent-document" 
                  checked={isAiAgentDocument} 
                  onCheckedChange={(checked) => setIsAiAgentDocument(!!checked)} 
                />
                <Label htmlFor="ai-agent-document" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200">
                  Exclusivo Agente IA
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Visível para todos
              </Label>
              <Switch checked={isDocumentVisibleToAll} onCheckedChange={setIsDocumentVisibleToAll} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseDocumentModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleCreateDocument} disabled={!documentTitle.trim() || !documentFile && !editingDocumentId} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 dark:bg-primary dark:text-primary-foreground">
                {editingDocumentId ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Criar Funil */}
      <Dialog open={isFunnelModalOpen} onOpenChange={setIsFunnelModalOpen}>
        <DialogContent className="max-w-2xl bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{editingFunnelId ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              Crie um funil com múltiplas etapas e delays configuráveis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nome do Funil</label>
              <Input value={funnelName} onChange={e => setFunnelName(e.target.value)} placeholder="Digite o nome do funil" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
            </div>

            {/* Etapas do Funil */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium">Etapas</label>
                <Button onClick={handleOpenAddStepModal} variant="outline" size="sm" className="border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Adicionar Etapas
                </Button>
              </div>

              {funnelSteps.length === 0 ? <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg dark:text-gray-400 dark:border-gray-700">
                  Nenhuma etapa adicionada ainda.
                </div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={funnelSteps.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {funnelSteps.map((step, index) => {
                        const itemDetails = getItemDetails(step.type, step.itemId);
                        return (
                          <SortableFunnelStep
                            key={step.id}
                            step={step}
                            index={index}
                            itemDetails={itemDetails}
                            onDelete={(id) => setFunnelSteps(prev => prev.filter(s => s.id !== id))}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>}
            </div>

            {userRole === 'master' && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="ai-agent-funnel" 
                  checked={isAiAgentFunnel} 
                  onCheckedChange={(checked) => setIsAiAgentFunnel(!!checked)} 
                />
                <Label htmlFor="ai-agent-funnel" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200">
                  Exclusivo Agente IA
                </Label>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Label className="text-sm font-medium leading-none dark:text-gray-200">
                Visível para todos
              </Label>
              <Switch checked={isFunnelVisibleToAll} onCheckedChange={setIsFunnelVisibleToAll} />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
              <Button variant="outline" onClick={handleCloseFunnelModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleSaveFunnel} disabled={!funnelName.trim() || funnelSteps.length === 0} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 dark:bg-primary dark:text-primary-foreground">
                {editingFunnelId ? 'Salvar Alterações' : 'Salvar Funil'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Adicionar Etapa */}
      <Dialog open={isAddStepModalOpen} onOpenChange={setIsAddStepModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-100">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">Adicionar Novo Item</DialogTitle>
            <DialogDescription className="text-primary-foreground/90 dark:text-gray-400">
              Selecione o tipo de conteúdo e configure o delay da etapa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Seleção de Tipo */}
            <div>
              <label className="text-sm font-medium mb-3 block text-gray-700 dark:text-gray-200">Tipo de Mensagem</label>
              <div className="grid grid-cols-4 gap-3">
                <button onClick={() => setSelectedStepType("mensagens")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "mensagens" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 dark:border-gray-700 dark:hover:border-primary/60")}>
                  <MessageSquare className="h-6 w-6" />
                  <span className="text-xs font-medium">Mensagens</span>
                </button>
                <button onClick={() => setSelectedStepType("audios")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "audios" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 dark:border-gray-700 dark:hover:border-primary/60")}>
                  <Mic className="h-6 w-6" />
                  <span className="text-xs font-medium">Áudios</span>
                </button>
                <button onClick={() => setSelectedStepType("midias")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "midias" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 dark:border-gray-700 dark:hover:border-primary/60")}>
                  <Image className="h-6 w-6" />
                  <span className="text-xs font-medium">Mídias</span>
                </button>
                <button onClick={() => setSelectedStepType("documentos")} className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all", selectedStepType === "documentos" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 dark:border-gray-700 dark:hover:border-primary/60")}>
                  <FileText className="h-6 w-6" />
                  <span className="text-xs font-medium">Documentos</span>
                </button>
              </div>
            </div>

            {/* Select do Item */}
            {selectedStepType && <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Selecionar Item</label>
                <select className="w-full mt-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                  <option value="">Selecione um item</option>
                  {selectedStepType === "mensagens" && messages.map(msg => <option key={msg.id} value={msg.id}>{msg.title}</option>)}
                  {selectedStepType === "audios" && audios.map(audio => <option key={audio.id} value={audio.id}>{audio.title}</option>)}
                  {selectedStepType === "midias" && media.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  {selectedStepType === "documentos" && documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                </select>
              </div>}

            {/* Configuração de Delay */}
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-200">Delay para executar a ação</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground dark:text-gray-400">Minutos</label>
                  <Input type="number" min="0" value={stepMinutes} onChange={e => setStepMinutes(parseInt(e.target.value) || 0)} placeholder="0" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground dark:text-gray-400">Segundos</label>
                  <Input type="number" min="0" max="59" value={stepSeconds} onChange={e => setStepSeconds(Math.min(59, parseInt(e.target.value) || 0))} placeholder="0" className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t dark:border-gray-700">
              <Button variant="outline" onClick={handleCloseAddStepModal} className="rounded-none border border-[#d4d4d4] bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button onClick={handleAddStep} disabled={!selectedStepType || !selectedItemId} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70 dark:bg-primary dark:text-primary-foreground">
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais de Visualização */}
      {viewingMedia && viewingMedia.type === 'image' && (
        <ImageModal
          isOpen={!!viewingMedia}
          onClose={() => setViewingMedia(null)}
          imageUrl={viewingMedia.url}
          fileName={viewingMedia.title}
        />
      )}
      
      {viewingMedia && viewingMedia.type === 'video' && (
        <VideoModal
          isOpen={!!viewingMedia}
          onClose={() => setViewingMedia(null)}
          videoUrl={viewingMedia.url}
          fileName={viewingMedia.title}
        />
      )}

      {viewingDocument && (
        <DocumentPreviewModal
          isOpen={!!viewingDocument}
          onClose={() => setViewingDocument(null)}
          fileUrl={viewingDocument.url}
          fileName={viewingDocument.title}
          fileType={viewingDocument.type}
        />
      )}
    </div>
  );
}
