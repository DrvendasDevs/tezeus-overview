import { useState, useEffect, useRef } from "react";
import { User, Briefcase, FileText, Paperclip, Pencil, Trash2, Plus, Pin, MapPin, MessageCircle, Trophy, Mail, Phone, Home, Globe, X, Loader2, Cake } from "lucide-react";
import { getInitials, getAvatarColor } from '@/lib/avatarUtils';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DealDetailsPage } from "@/pages/DealDetailsPage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { usePipelineCards } from "@/hooks/usePipelineCards";
import { useContactPipelineCards } from '@/hooks/useContactPipelineCards';
import { useContactObservations, ContactObservation } from '@/hooks/useContactObservations';
import { useContactExtraInfo } from '@/hooks/useContactExtraInfo';
import { CriarNegocioModal } from './modals/CriarNegocioModal';
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceContactFields } from "@/hooks/useWorkspaceContactFields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ImageModal } from './chat/ImageModal';
import { PdfModal } from './chat/PdfModal';
import { VideoModal } from './chat/VideoModal';
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { logUpdate } from "@/utils/auditLog";
interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birth_date?: string | null;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
interface Deal {
  id: string;
  title: string;
  description?: string;
  value: number;
  status: string;
  pipeline: string;
  column_name: string;
}
interface ContactSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onContactUpdated?: () => void;
}

// Funções de avatar importadas de avatarUtils para consistência

export function ContactSidePanel({
  isOpen,
  onClose,
  contact,
  onContactUpdated
}: ContactSidePanelProps) {
  const [dealDetailsOpen, setDealDetailsOpen] = useState(false);
  const [selectedDealCardId, setSelectedDealCardId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [customFields, setCustomFields] = useState<Array<{
    key: string;
    value: string;
  }>>([]);
  const [newCustomField, setNewCustomField] = useState({
    key: '',
    value: ''
  });
  const [newObservation, setNewObservation] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const editingFileInputRef = useRef<HTMLInputElement>(null);
  const [deletingObservationId, setDeletingObservationId] = useState<string | null>(null);
  const [isCreateDealModalOpen, setIsCreateDealModalOpen] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBirthDate, setIsEditingBirthDate] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<{
    url: string;
    type: string;
    name: string;
  } | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldType, setEditingFieldType] = useState<'key' | 'value' | null>(null);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [editingDealTitle, setEditingDealTitle] = useState<string>('');
  const [stats, setStats] = useState({
    activeConversations: 0,
    activeDeals: 0,
    closedDeals: 0
  });
  const {
    pipelines
  } = usePipelines();
  const {
    cards: contactCards,
    currentPipeline,
    transferToPipeline,
    isLoading: cardsLoading,
    fetchContactCards
  } = useContactPipelineCards(contact?.id || null);
  const { createCard } = usePipelineCards(currentPipeline?.id || null);
  const { columns } = usePipelineColumns(currentPipeline?.id || null);
  const {
    toast
  } = useToast();
  const {
    selectedWorkspace
  } = useWorkspace();
  const { getHeaders } = useWorkspaceHeaders();
  const {
    observations: realObservations,
    addObservation,
    updateObservation,
    deleteObservation,
    removeObservationFile,
    downloadFile,
    getFileIcon,
    isUploading,
    isLoading: observationsLoading
  } = useContactObservations(contact?.id || "");
  const {
    fields: extraFields,
    saveFields: saveExtraFields
  } = useContactExtraInfo(contact?.id || null, selectedWorkspace?.workspace_id || '');
  
  // Hook para campos obrigatórios do workspace
  const { fields: workspaceFields } = useWorkspaceContactFields(
    selectedWorkspace?.workspace_id || null
  );
  const deals: Deal[] = contactCards.map(card => ({
    id: card.id,
    title: card.description || 'Sem descrição',
    description: card.description,
    value: card.value || 0,
    status: card.status,
    pipeline: card.pipeline_name,
    column_name: card.column_name
  }));
  useEffect(() => {
    if (isOpen && contact?.id && selectedWorkspace?.workspace_id) {
      const loadFreshData = async () => {
        try {
          // Query única que carrega contato + estatísticas em um único payload
          const {
            data,
            error
          } = await supabase.from('contacts').select(`
              id, 
              name, 
              phone, 
              email, 
              birth_date,
              profile_image_url, 
              workspace_id, 
              created_at, 
              updated_at
            `).eq('id', contact.id).single();
          if (error) throw error;
          if (data) {
            setEditingContact(data as Contact);

            // Carregar estatísticas em uma única chamada com Promise.all
            const [activeConversationsResult, activeDealsResult, closedDealsResult] = await Promise.all([
            // 1. Contar conversas ativas
            supabase.from('conversations').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('workspace_id', selectedWorkspace.workspace_id).eq('status', 'open').then(result => result.count || 0),
            // 2. Contar negócios ativos
            supabase.from('pipeline_cards').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('status', 'aberto').then(result => result.count || 0),
            // 3. Contar negócios fechados
            supabase.from('pipeline_cards').select('*', {
              count: 'exact',
              head: true
            }).eq('contact_id', contact.id).eq('status', 'ganho').then(result => result.count || 0)]);

            // Atualizar estado com estatísticas carregadas
            setStats({
              activeConversations: activeConversationsResult,
              activeDeals: activeDealsResult,
              closedDeals: closedDealsResult
            });
          }
        } catch (error) {
          console.error('❌ Erro ao recarregar dados do contato:', error);
          setStats({
            activeConversations: 0,
            activeDeals: 0,
            closedDeals: 0
          });
        }
      };
      loadFreshData();
    }
  }, [isOpen, contact?.id, selectedWorkspace?.workspace_id, contactCards.length]);

  useEffect(() => {
    if (isOpen && contact?.id && selectedWorkspace?.workspace_id) {
      fetchContactCards();
    }
  }, [isOpen, contact?.id, selectedWorkspace?.workspace_id]);
  useEffect(() => {
    if (extraFields.length > 0) {
      const fields = extraFields.map(field => ({
        key: field.field_name,
        value: field.field_value
      }));
      setCustomFields(fields);
    } else {
      setCustomFields([]);
    }
  }, [extraFields]);
  const handleSaveContact = async () => {
    if (!editingContact) return;
    try {
      const updateData: Record<string, any> = {
        name: editingContact.name?.trim() || '',
        email: editingContact.email?.trim() || '',
        birth_date: editingContact.birth_date || null
      };
      const {
        data: updatedData,
        error: updateError
      } = await supabase.from('contacts').update(updateData).eq('id', editingContact.id).select().single();
      if (updateError) throw updateError;
      const fieldsToSave = customFields.map(f => ({
        field_name: f.key,
        field_value: f.value
      }));
      await saveExtraFields(fieldsToSave);
      if (updatedData) {
        setEditingContact(updatedData as Contact);
        if (onContactUpdated) {
          onContactUpdated();
        }
        
        // Registrar log de auditoria
        await logUpdate(
          'contact',
          updatedData.id,
          updatedData.name,
          null, // oldData não disponível
          { name: updatedData.name, email: updatedData.email },
          selectedWorkspace?.workspace_id || ''
        );
      }
    } catch (error) {
      console.error('❌ Erro ao salvar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar alterações",
        variant: "destructive"
      });
    }
  };
  const handleAddCustomField = async () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive"
      });
      return;
    }
    const fieldExists = customFields.some(field => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase());
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive"
      });
      return;
    }
    const newFields = [...customFields, {
      key: newCustomField.key.trim(),
      value: newCustomField.value.trim()
    }];
    setCustomFields(newFields);
    const fieldsToSave = newFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
    setNewCustomField({
      key: '',
      value: ''
    });
  };
  const handleRemoveCustomField = async (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields);
    const fieldsToSave = newFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
  };
  const updateCustomField = (index: number, key: string, value: string) => {
    setCustomFields(customFields.map((field, i) => i === index ? {
      ...field,
      [key]: value
    } : field));
  };
  const handleSaveCustomFields = async () => {
    const fieldsToSave = customFields.map(f => ({
      field_name: f.key,
      field_value: f.value
    }));
    await saveExtraFields(fieldsToSave);
  };
  const handleAddObservation = async () => {
    if (!newObservation.trim()) return;
    const success = await addObservation(newObservation, selectedFile || undefined);
    if (success) {
      setNewObservation("");
      setSelectedFile(null);
      if (fileInputRef) {
        fileInputRef.value = '';
      }
    }
  };
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "Arquivo muito grande. Máximo 10MB permitido.",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };
  const handleEditObservation = (obs: ContactObservation) => {
    setEditingObservationId(obs.id);
    setEditingContent(obs.content);
    setEditingFile(null);
  };
  const handleSaveEdit = async () => {
    if (!editingObservationId) return;
    const success = await updateObservation(editingObservationId, editingContent, editingFile);
    if (success) {
      setEditingObservationId(null);
      setEditingContent('');
      setEditingFile(null);
    }
  };
  const handleRemoveFile = async (observationId: string) => {
    const success = await removeObservationFile(observationId);
    if (success && editingObservationId === observationId) {
      setEditingObservationId(null);
    }
  };
  const handleCancelEdit = () => {
    setEditingObservationId(null);
    setEditingContent('');
    setEditingFile(null);
  };
  const handleSaveDealTitle = async (dealId: string) => {
    if (!editingDealTitle.trim()) {
      toast({
        title: "Erro",
        description: "O título não pode estar vazio",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.from('pipeline_cards').update({
        description: editingDealTitle
      }).eq('id', dealId);
      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Descrição atualizada"
      });
    } catch (error) {
      console.error('Erro ao salvar título:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar título",
        variant: "destructive"
      });
    }
  };
  const handleConfirmDelete = async () => {
    if (!deletingObservationId) return;
    await deleteObservation(deletingObservationId);
    setDeletingObservationId(null);
  };
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const handleFileClick = (fileUrl: string, fileName: string, fileType?: string) => {
    setViewingMedia({
      url: fileUrl,
      type: fileType || '',
      name: fileName
    });
  };
  const getFileType = (fileName: string, fileType?: string): 'image' | 'pdf' | 'video' | 'audio' | 'other' => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (fileType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (fileType?.includes('pdf') || extension === 'pdf') {
      return 'pdf';
    }
    if (fileType?.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) {
      return 'video';
    }
    if (fileType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension || '')) {
      return 'audio';
    }
    return 'other';
  };
  const getFieldIcon = (fieldKey: string) => {
    const key = fieldKey.toLowerCase();
    if (key.includes('email') || key.includes('e-mail')) {
      return <Mail className="h-4 w-4" />;
    }
    if (key.includes('telefone') || key.includes('phone') || key.includes('celular')) {
      return <Phone className="h-4 w-4" />;
    }
    if (key.includes('cep') || key.includes('zip')) {
      return <MapPin className="h-4 w-4" />;
    }
    if (key.includes('endereço') || key.includes('address') || key.includes('rua')) {
      return <Home className="h-4 w-4" />;
    }
    if (key.includes('perfil') || key.includes('tipo') || key.includes('categoria')) {
      return <User className="h-4 w-4" />;
    }
    if (key.includes('país') || key.includes('country') || key.includes('estado')) {
      return <Globe className="h-4 w-4" />;
    }
    if (key.includes('cpf') || key.includes('cnpj') || key.includes('documento')) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };
  if (!contact) return null;
  return <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[500px] sm:w-[540px] p-0 border-l border-[#d4d4d4] dark:border-gray-700 dark:bg-[#1f1f1f]">
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1">
              <div className="space-y-0">
                {/* ===== HEADER: Topo com gradiente pastel ===== */}
                <div className="relative overflow-hidden pb-10 pt-8 -ml-6 -mr-6 pl-6 pr-6 dark:border-b dark:border-gray-700" style={editingContact?.profile_image_url ? {
                backgroundImage: `url(${editingContact.profile_image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : undefined}>
                  {/* Overlay com blur e gradiente pastel */}
              <div className="absolute inset-0 bg-black/40 dark:bg-black/60" style={{
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)'
                }} />
                  
                  {/* Conteúdo com z-index elevado */}
                  <div className="relative z-10">
                    <div className="flex flex-col items-center">
                      {/* Avatar grande com borda e sombra */}
                      <Avatar className="h-24 w-24 border-4 border-white shadow-xl dark:border-gray-700">
                        {editingContact?.profile_image_url && <AvatarImage src={editingContact.profile_image_url} alt={editingContact.name || 'Contato'} className="object-cover" />}
                        <AvatarFallback className="text-2xl font-semibold" style={{
                        backgroundColor: getAvatarColor(editingContact?.name || 'Contato')
                      }}>
                          {getInitials(editingContact?.name || 'Contato')}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Nome - editável ao duplo clique com underline */}
                      {isEditingName ? <input type="text" value={editingContact?.name || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      name: e.target.value
                    } : null)} onBlur={async () => {
                      setIsEditingName(false);
                      await handleSaveContact();
                    }} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false);
                        handleSaveContact();
                      }
                    }} autoFocus className="text-xl font-bold text-center bg-transparent border-none outline-none border-b-2 border-primary mt-3 pb-0.5 text-gray-900 dark:text-gray-100" /> : <h2 onDoubleClick={() => setIsEditingName(true)} title="Clique duas vezes para editar" className="text-xl font-bold mt-3 cursor-pointer transition-colors text-slate-50 dark:text-gray-100">
                          {editingContact?.name || 'Nome do contato'}
                        </h2>}
                      
                      {/* Telefone - somente leitura */}
                      <p className="text-sm mt-1 text-slate-300 dark:text-gray-400">
                        {editingContact?.phone || 'Sem telefone'}
                      </p>
                      
                      {/* Email - editável ao duplo clique com underline */}
                      {isEditingEmail ? <input type="email" value={editingContact?.email || ''} onChange={e => setEditingContact(prev => prev ? {
                      ...prev,
                      email: e.target.value
                    } : null)} onBlur={async () => {
                      setIsEditingEmail(false);
                      await handleSaveContact();
                    }} onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setIsEditingEmail(false);
                        handleSaveContact();
                      }
                    }} autoFocus className="text-sm text-center bg-transparent border-none outline-none border-b-2 border-primary mt-1 pb-0.5 text-white dark:text-gray-200" /> : <p onDoubleClick={() => setIsEditingEmail(true)} className="text-sm text-white mt-1 cursor-pointer hover:text-white/80 transition-colors dark:text-gray-300 dark:hover:text-gray-100" title="Clique duas vezes para editar">
                          {editingContact?.email || 'Adicionar email'}
                        </p>}

                      {/* Data de Nascimento - editável ao duplo clique */}
                      {isEditingBirthDate ? <div className="flex items-center gap-1 mt-1">
                        <Cake className="h-3.5 w-3.5 text-slate-300" />
                        <input type="date" value={editingContact?.birth_date || ''} onChange={e => setEditingContact(prev => prev ? {
                        ...prev,
                        birth_date: e.target.value || null
                      } : null)} onBlur={async () => {
                        setIsEditingBirthDate(false);
                        await handleSaveContact();
                      }} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setIsEditingBirthDate(false);
                          handleSaveContact();
                        }
                      }} autoFocus className="text-xs text-center bg-transparent border-none outline-none border-b-2 border-primary pb-0.5 text-white dark:text-gray-200 [color-scheme:dark]" />
                      </div> : <div onDoubleClick={() => setIsEditingBirthDate(true)} className="flex items-center gap-1 mt-1 cursor-pointer hover:text-white/80 transition-colors" title="Clique duas vezes para editar">
                        <Cake className="h-3.5 w-3.5 text-slate-300" />
                        <p className="text-xs text-white dark:text-gray-300">
                          {editingContact?.birth_date ? new Date(editingContact.birth_date + 'T00:00:00').toLocaleDateString('pt-BR') : 'Adicionar aniversário'}
                        </p>
                      </div>}
                    </div>
                  </div>
                </div>

                {/* ===== ESTATÍSTICAS: Cards Visuais estilo Office ===== */}
                <div className="grid grid-cols-3 border-b border-[#d4d4d4] bg-white dark:bg-[#1f1f1f] dark:border-gray-700">
                  {/* Conversas Ativas */}
                  <div className="flex flex-col items-center justify-center p-4 border-r border-[#d4d4d4] dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conversas</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeConversations}</p>
                  </div>

                  {/* Negócios Ativos */}
                  <div className="flex flex-col items-center justify-center p-4 border-r border-[#d4d4d4] dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Negócios</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeDeals}</p>
                  </div>

                  {/* Negócios Fechados */}
                  <div className="flex flex-col items-center justify-center p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ganhos</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.closedDeals}</p>
                  </div>
                </div>

                {/* ===== CORPO: Blocos organizados ===== */}
                <div className="p-4 space-y-4 dark:bg-[#1f1f1f]">
                  {/* BLOCO 1: Informações Adicionais */}
                  <Card className="border border-gray-300 rounded-none shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f]">
                    <CardHeader className="py-3 bg-[#f8f9fa] border-b border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-700">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Informações Adicionais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {workspaceFields.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-4 py-2 bg-[#f3f3f3] border-b border-[#d4d4d4] text-[11px] font-semibold text-gray-700 dark:bg-[#2d2d2d] dark:border-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              <Pin className="h-3.5 w-3.5" />
                              Campos obrigatórios da empresa
                            </div>
                            <span>{workspaceFields.length} campo(s)</span>
                          </div>
                          <table className="min-w-full text-xs border-b border-[#d4d4d4] dark:border-gray-700">
                            <thead className="bg-[#ededed] text-[10px] uppercase tracking-wide text-left text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-400">
                              <tr>
                                <th className="px-3 py-2 border border-[#d4d4d4] w-48 dark:border-gray-700">Campo</th>
                                <th className="px-3 py-2 border border-[#d4d4d4] dark:border-gray-700">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workspaceFields.map((field) => {
                                const currentValue = customFields.find(f => f.key === field.field_name)?.value || '';
                                const fieldIndex = customFields.findIndex(f => f.key === field.field_name);
                                
                                return (
                                  <tr key={field.id} className="bg-white hover:bg-blue-50 transition-colors dark:bg-[#1f1f1f] dark:hover:bg-[#2d2d2d]">
                                    <td className="px-3 py-2 border border-[#e0e0e0] font-semibold text-[11px] text-gray-800 dark:border-gray-700 dark:text-gray-300">
                                      {field.field_name} *
                                    </td>
                                    <td className="px-3 py-2 border border-[#e0e0e0] dark:border-gray-700">
                                      {editingFieldIndex === fieldIndex && editingFieldType === 'value' ? (
                                        <input
                                          type="text"
                                          value={currentValue}
                                          onChange={(e) => {
                                            if (fieldIndex !== -1) {
                                              updateCustomField(fieldIndex, 'value', e.target.value);
                                            } else {
                                              setCustomFields(prev => [...prev, { key: field.field_name, value: e.target.value }]);
                                            }
                                          }}
                                          onBlur={async () => {
                                            setEditingFieldIndex(null);
                                            setEditingFieldType(null);
                                            await handleSaveCustomFields();
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur();
                                            }
                                          }}
                                          autoFocus
                                          className="w-full bg-transparent border border-primary focus:border-primary focus:ring-0 text-sm px-2 py-1 rounded-none dark:text-gray-200"
                                        />
                                      ) : !currentValue ? (
                                        <input
                                          type="text"
                                          value={currentValue}
                                          placeholder=""
                                          onChange={(e) => {
                                            if (fieldIndex !== -1) {
                                              updateCustomField(fieldIndex, 'value', e.target.value);
                                            } else {
                                              // cria o campo na primeira digitação
                                              setCustomFields(prev => [...prev, { key: field.field_name, value: e.target.value }]);
                                            }
                                          }}
                                          onBlur={async () => {
                                            // só salva se existir algum valor (evita criar entrada vazia sem intenção)
                                            if (fieldIndex !== -1 ? Boolean(customFields[fieldIndex]?.value?.trim()) : false) {
                                              await handleSaveCustomFields();
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur();
                                            }
                                          }}
                                          className="w-full bg-transparent border border-primary focus:border-primary focus:ring-0 text-sm px-2 py-1 rounded-none dark:text-gray-200"
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onDoubleClick={() => {
                                            setEditingFieldIndex(fieldIndex);
                                            setEditingFieldType('value');
                                          }}
                                          className="w-full text-left text-sm text-gray-800 truncate hover:bg-blue-50 px-2 py-1 rounded-none dark:text-gray-300 dark:hover:bg-[#2d2d2d]"
                                          title="Clique duas vezes para editar"
                                        >
                                          {currentValue}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between px-4 py-2 bg-[#f3f3f3] border-b border-[#d4d4d4] text-[11px] font-semibold text-gray-700 dark:bg-[#2d2d2d] dark:border-gray-700 dark:text-gray-300">
                          <span>Campos personalizados</span>
                          <span>{customFields.filter(field => !workspaceFields.some(wf => wf.field_name === field.key)).length} campo(s)</span>
                        </div>
                        <table className="min-w-full text-xs">
                          <thead className="bg-[#ededed] text-[10px] uppercase tracking-wide text-left text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-400">
                            <tr>
                              <th className="px-3 py-2 border border-[#d4d4d4] w-44 dark:border-gray-700">Campo</th>
                              <th className="px-3 py-2 border border-[#d4d4d4] dark:border-gray-700">Valor</th>
                              <th className="px-3 py-2 border border-[#d4d4d4] w-12 text-center dark:border-gray-700">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customFields.filter(field => !workspaceFields.some(wf => wf.field_name === field.key)).length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-3 py-4 text-center text-[11px] text-gray-500 border border-[#d4d4d4] bg-white dark:bg-[#1f1f1f] dark:border-gray-700 dark:text-gray-400">
                                  Nenhum campo personalizado adicionado.
                                </td>
                              </tr>
                            ) : (
                              customFields
                                .filter(field => !workspaceFields.some(wf => wf.field_name === field.key))
                                .map((field) => {
                                  const originalIndex = customFields.findIndex(f => f.key === field.key && f.value === field.value);
                                  return (
                                    <tr key={originalIndex} className="bg-white hover:bg-blue-50 transition-colors dark:bg-[#1f1f1f] dark:hover:bg-[#2d2d2d]">
                                      <td className="px-3 py-2 border border-[#e0e0e0] font-semibold text-[11px] text-gray-800 dark:border-gray-700 dark:text-gray-300">
                                        {editingFieldIndex === originalIndex && editingFieldType === 'key' ? (
                                          <input
                                            type="text"
                                            value={field.key}
                                            onChange={e => updateCustomField(originalIndex, 'key', e.target.value)}
                                            onBlur={async () => {
                                              setEditingFieldIndex(null);
                                              setEditingFieldType(null);
                                              await handleSaveCustomFields();
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            autoFocus
                                            className="w-full bg-transparent border border-primary focus:border-primary focus:ring-0 text-xs px-2 py-1 rounded-none uppercase tracking-wide dark:text-gray-200"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onDoubleClick={() => {
                                              setEditingFieldIndex(originalIndex);
                                              setEditingFieldType('key');
                                            }}
                                            className="w-full text-left uppercase tracking-wide text-[11px] text-gray-800 truncate px-1 py-1 dark:text-gray-300"
                                            title="Clique duas vezes para editar"
                                          >
                                            {field.key}
                                          </button>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 border border-[#e0e0e0] text-gray-700 dark:border-gray-700 dark:text-gray-300">
                                        {editingFieldIndex === originalIndex && editingFieldType === 'value' ? (
                                          <input
                                            type="text"
                                            value={field.value}
                                            onChange={e => updateCustomField(originalIndex, 'value', e.target.value)}
                                            onBlur={async () => {
                                              setEditingFieldIndex(null);
                                              setEditingFieldType(null);
                                              await handleSaveCustomFields();
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            autoFocus
                                            className="w-full bg-transparent border border-primary focus:border-primary focus:ring-0 text-sm px-2 py-1 rounded-none dark:text-gray-200"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onDoubleClick={() => {
                                              setEditingFieldIndex(originalIndex);
                                              setEditingFieldType('value');
                                            }}
                                            className="w-full text-left text-sm text-gray-700 truncate px-1 py-1 dark:text-gray-300"
                                            title="Clique duas vezes para editar"
                                          >
                                            {field.value
                                              ? field.value.length > 20
                                                ? `${field.value.slice(0, 20)}...`
                                                : field.value
                                              : 'Clique para adicionar'}
                                          </button>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 border border-[#e0e0e0] text-center dark:border-gray-700">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 mx-auto text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                          onClick={() => handleRemoveCustomField(originalIndex)}
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-t border-[#d4d4d4] bg-[#f9fafb] px-4 py-3 space-y-2 dark:bg-[#2d2d2d] dark:border-gray-700">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold dark:text-gray-400">
                          Adicionar novo campo
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome do campo"
                            value={newCustomField.key}
                            onChange={e => setNewCustomField(prev => ({
                              ...prev,
                              key: e.target.value
                            }))}
                            className="text-xs h-8 border-gray-300 rounded-none dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-gray-200"
                          />
                          <Input
                            placeholder="Valor"
                            value={newCustomField.value}
                            onChange={e => setNewCustomField(prev => ({
                              ...prev,
                              value: e.target.value
                            }))}
                            className="text-xs h-8 border-gray-300 rounded-none dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-gray-200"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 rounded-none border-gray-400 text-gray-700 hover:bg-gray-100 text-xs font-semibold dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          onClick={handleAddCustomField}
                          disabled={!newCustomField.key.trim() || !newCustomField.value.trim()}
                        >
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Adicionar campo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* BLOCO 2: Pipeline / Negócios */}
                  <Card className="border border-gray-300 rounded-none shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f]">
                    <CardHeader className="py-3 bg-[#f8f9fa] border-b border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                          <Briefcase className="h-4 w-4 text-green-600 dark:text-green-400" />
                          Pipeline
                        </CardTitle>
                        <Button size="sm" variant="ghost" onClick={() => setIsCreateDealModalOpen(true)} className="h-8 rounded-none text-xs font-semibold dark:text-gray-300 dark:hover:bg-gray-700">
                          <Plus className="h-3 w-3 mr-1" /> Criar Negócio
                        </Button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 dark:text-gray-400">
                        Visualize e edite os negócios vinculados a este contato.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-56 overflow-y-auto border-b border-gray-200 bg-white dark:bg-[#1f1f1f] dark:border-gray-700">
                        {cardsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : deals.length > 0 ? (
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-[#ededed] text-[10px] uppercase tracking-wide text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-400">
                              <tr>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-left dark:border-gray-700">Pipeline</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-left w-32 dark:border-gray-700">Etapa</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-right w-28 dark:border-gray-700">Valor</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-center w-24 dark:border-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deals.map((deal) => (
                                <tr key={deal.id} className="bg-white hover:bg-blue-50 transition-colors dark:bg-[#1f1f1f] dark:hover:bg-[#2d2d2d]">
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-gray-700 whitespace-pre-wrap break-words dark:border-gray-700 dark:text-gray-300">
                                    {editingDealId === deal.id ? (
                                      <input
                                        type="text"
                                        value={editingDealTitle}
                                        onChange={e => setEditingDealTitle(e.target.value)}
                                        onBlur={async () => {
                                          await handleSaveDealTitle(deal.id);
                                          setEditingDealId(null);
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        autoFocus
                                        className="w-full bg-transparent border border-primary focus:border-primary focus:ring-0 text-sm px-2 py-1 rounded-none dark:text-gray-200"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedDealCardId(deal.id);
                                          setDealDetailsOpen(true);
                                        }}
                                        onDoubleClick={() => {
                                          setEditingDealId(deal.id);
                                          setEditingDealTitle(deal.title);
                                        }}
                                        className="w-full text-left font-semibold text-gray-800 truncate dark:text-gray-200 underline underline-offset-2 decoration-gray-400 hover:decoration-gray-700 dark:decoration-gray-500 dark:hover:decoration-gray-200"
                                        title="Clique duas vezes para editar"
                                      >
                                        {deal.pipeline}
                                      </button>
                                    )}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-gray-600 dark:border-gray-700 dark:text-gray-400">
                                    {deal.column_name}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-right font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-300">
                                    {formatCurrency(deal.value)}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-center dark:border-gray-700">
                                    <span className={cn(
                                      "px-2 py-1 text-[10px] font-semibold uppercase tracking-wide rounded-none border",
                                      deal.status === 'ganho'
                                        ? "border-green-300 text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                                        : deal.status === 'perdido'
                                          ? "border-red-300 text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                          : "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                                    )}>
                                      {deal.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                            <Briefcase className="h-8 w-8 text-gray-400 mb-2 dark:text-gray-500" />
                            Nenhum negócio vinculado
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Modal de detalhes da oportunidade */}
                  <Sheet
                    open={dealDetailsOpen && !!selectedDealCardId}
                    onOpenChange={(open) => {
                      setDealDetailsOpen(open);
                      if (!open) setSelectedDealCardId(null);
                    }}
                  >
                    <SheetContent
                      side="right"
                      className="p-0 sm:max-w-[95vw] w-[95vw] max-w-[1400px] h-full border-l border-gray-200 dark:border-gray-800 shadow-2xl [&>button]:hidden"
                    >
                      {selectedDealCardId ? (
                        <DealDetailsPage
                          cardId={selectedDealCardId}
                          workspaceId={selectedWorkspace?.workspace_id || null}
                          onClose={() => {
                            setDealDetailsOpen(false);
                            setSelectedDealCardId(null);
                          }}
                        />
                      ) : null}
                    </SheetContent>
                  </Sheet>

                  {/* BLOCO 3: Observações */}
                  <Card className="border border-gray-300 rounded-none shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f]">
                    <CardHeader className="py-3 bg-[#f8f9fa] border-b border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-700">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <FileText className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        Observações
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="h-56 overflow-y-auto border-b border-gray-200 bg-white dark:bg-[#1f1f1f] dark:border-gray-700">
                        {observationsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : realObservations.length > 0 ? (
                          <table className="w-full text-xs border-collapse">
                            <thead className="bg-[#ededed] text-[10px] uppercase tracking-wide text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-400">
                              <tr>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-left w-44 dark:border-gray-700">Responsável</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-left dark:border-gray-700">Observação</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-left w-28 dark:border-gray-700">Registrado em</th>
                                <th className="border border-[#d4d4d4] px-3 py-2 text-center w-16 dark:border-gray-700">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {realObservations.map((obs) => (
                                <tr key={obs.id} className="bg-white hover:bg-yellow-50 dark:bg-[#1f1f1f] dark:hover:bg-yellow-900/10">
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-[11px] font-semibold text-gray-800 dark:border-gray-700 dark:text-gray-300">
                                    {'Usuário'}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-sm text-gray-700 align-top dark:border-gray-700 dark:text-gray-300">
                                    {editingObservationId === obs.id ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={editingContent}
                                          onChange={(e) => setEditingContent(e.target.value)}
                                          className="min-h-[80px] text-xs rounded-none border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200"
                                        />
                                        {obs.file_name && obs.file_url && !editingFile && (
                                          <div className="flex items-center justify-between p-2 bg-gray-50 border border-dashed border-gray-300 text-[11px] dark:bg-[#2d2d2d] dark:border-gray-600">
                                            <button
                                              onClick={() => handleFileClick(obs.file_url!, obs.file_name!, obs.file_type)}
                                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                              <Paperclip className="h-3 w-3" />
                                              {obs.file_name}
                                            </button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 text-red-600 dark:text-red-400"
                                              onClick={() => handleRemoveFile(obs.id)}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <input
                                            ref={editingFileInputRef}
                                            type="file"
                                            onChange={(e) => setEditingFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => editingFileInputRef.current?.click()}
                                            className="flex items-center gap-2 text-[11px] dark:bg-white dark:text-gray-900 dark:border-gray-400 dark:hover:bg-gray-100"
                                          >
                                            <Paperclip className="h-3.5 w-3.5" />
                                            {editingFile ? editingFile.name : 'Anexar arquivo'}
                                          </Button>
                                          {editingFile && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 dark:text-gray-400 dark:hover:bg-gray-700"
                                              onClick={() => setEditingFile(null)}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={handleSaveEdit} disabled={isUploading} className="rounded-none text-xs">
                                            {isUploading ? 'Salvando...' : 'Salvar'}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={handleCancelEdit} className="rounded-none text-xs dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-sm whitespace-pre-wrap">{obs.content}</p>
                                        {obs.file_name && obs.file_url && (
                                          <button
                                            onClick={() => handleFileClick(obs.file_url!, obs.file_name!, obs.file_type)}
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2 dark:text-blue-400 dark:hover:text-blue-300"
                                          >
                                            <Paperclip className="h-3 w-3" />
                                            {obs.file_name}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-400">
                                    {formatDate(obs.created_at)}
                                  </td>
                                  <td className="border border-[#e0e0e0] px-3 py-2 text-center dark:border-gray-700">
                                    {editingObservationId === obs.id ? null : (
                                      <div className="flex justify-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                                          onClick={() => handleEditObservation(obs)}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                          onClick={() => setDeletingObservationId(obs.id)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                            Nenhuma observação encontrada
                          </div>
                        )}
                      </div>

                      <div className="bg-[#f9fafb] px-4 py-3 border-t border-gray-300 space-y-2 dark:bg-[#2d2d2d] dark:border-gray-700">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold dark:text-gray-400">
                          Adicionar observação
                        </p>
                        <Textarea
                          placeholder="Digite uma observação..."
                          value={newObservation}
                          onChange={e => setNewObservation(e.target.value)}
                          className="min-h-[60px] text-xs rounded-none border-gray-300 dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-gray-200"
                        />
                        {selectedFile && (
                          <div className="flex items-center gap-2 text-xs text-gray-600 bg-white border border-dashed border-gray-300 p-2 dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-gray-300">
                            <span>{getFileIcon(selectedFile.type)}</span>
                            <span className="truncate">{selectedFile.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedFile(null)}
                              className="h-4 w-4 p-0 ml-auto dark:hover:bg-gray-700"
                            >
                              ✕
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input type="file" ref={setFileInputRef} onChange={handleFileSelect} className="hidden" accept="*/*" />
                          <Button variant="outline" size="sm" onClick={() => fileInputRef?.click()} disabled={isUploading} className="rounded-none text-xs dark:bg-white dark:text-gray-900 dark:border-gray-400 dark:hover:bg-gray-100">
                            <Paperclip className="h-3 w-3 mr-1" /> Anexar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 rounded-none text-xs font-semibold"
                            onClick={handleAddObservation}
                            disabled={!newObservation.trim() || isUploading}
                          >
                            {isUploading ? 'Enviando...' : 'Adicionar'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Botão Salvar */}
                  
                </div>
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog open={!!deletingObservationId} onOpenChange={() => setDeletingObservationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta observação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Criar Negócio */}
      <CriarNegocioModal 
        open={isCreateDealModalOpen} 
        onOpenChange={setIsCreateDealModalOpen} 
        preSelectedContactId={contact.id} 
        preSelectedContactName={contact.name}
        onCreateBusiness={async (business) => {
          console.log('🚀 INÍCIO - onCreateBusiness chamado com:', business);
          
          if (!selectedWorkspace) {
            console.error('❌ Workspace não selecionado');
            toast({
              title: "Erro",
              description: "Workspace não selecionado",
              variant: "destructive"
            });
            return;
          }

          console.log('✅ Workspace selecionado:', selectedWorkspace.workspace_id);

          try {
            // 1. Buscar dados completos do contato
            const { data: contactData, error: contactError } = await supabase
              .from('contacts')
              .select('*')
              .eq('id', business.lead)
              .single();

            if (contactError) throw contactError;

            // 2. Verificar se já existe conversa ativa (para reusar se existir)
            const { data: existingConversations, error: convError } = await supabase
              .from('conversations')
              .select('id, status')
              .eq('contact_id', business.lead)
              .eq('workspace_id', selectedWorkspace.workspace_id)
              .eq('status', 'open');

            if (convError) {
              console.error('Erro ao verificar conversas existentes:', convError);
            }

            // Se existe conversa, reusar. Se não existe, criar nova
            let conversationId = existingConversations?.[0]?.id;

            // 3. Criar conversa apenas se não existe
            if (!conversationId) {
              const { data: conversationData, error: conversationError } = await supabase.functions.invoke('create-quick-conversation', {
                body: {
                  phoneNumber: contactData.phone,
                  orgId: selectedWorkspace.workspace_id
                }
              });
              if (conversationError) throw conversationError;
              conversationId = conversationData?.conversationId;
            }

            // 4. Buscar colunas do pipeline SELECIONADO pelo usuário (não do currentPipeline)
            console.log('🔍 Dados recebidos do modal:', {
              pipeline: business.pipeline,
              column: business.column,
              lead: business.lead,
              responsible: business.responsible,
              value: business.value
            });

            const { data: pipelineColumns, error: columnsError } = await supabase
              .from('pipeline_columns')
              .select('*')
              .eq('pipeline_id', business.pipeline)
              .order('order_position');

            console.log('📋 Colunas carregadas:', {
              total: pipelineColumns?.length,
              colunas: pipelineColumns?.map(c => ({ id: c.id, name: c.name })),
              columnIdRecebido: business.column
            });

            if (columnsError) throw columnsError;

            // 5. Validar se a coluna selecionada existe
            const targetColumn = pipelineColumns?.find(col => col.id === business.column);
            if (!targetColumn) {
              console.error('❌ Coluna não encontrada!', {
                columnIdBuscado: business.column,
                colunasDisponiveis: pipelineColumns?.map(c => ({ id: c.id, name: c.name }))
              });
              toast({
                title: 'Erro ao criar negócio',
                description: 'A coluna selecionada não foi encontrada. Por favor, selecione uma coluna válida.',
                variant: 'destructive'
              });
              throw new Error('Coluna selecionada não encontrada');
            }

            // 6. Criar o card DIRETAMENTE na edge function com o pipeline correto
            const headers = getHeaders();

            const { data: newCard, error: cardError } = await supabase.functions.invoke('pipeline-management/cards', {
              method: 'POST',
              headers,
              body: {
                pipeline_id: business.pipeline, // CRÍTICO: usar o pipeline selecionado pelo usuário
                column_id: business.column,
                contact_id: business.lead,
                conversation_id: conversationId,
                responsible_user_id: business.responsible,
                value: business.value,
                title: contactData.name || 'Novo negócio',
                description: 'Card criado através do formulário de negócios',
              }
            });

            if (cardError) {
              // Melhorar mensagem de erro: extrair body retornado pela Edge Function
              const ctx: any = (cardError as any)?.context;
              let detailedMessage: string | null =
                ctx?.body?.message ||
                ctx?.body?.error ||
                ctx?.body?.details ||
                null;

              if (!detailedMessage && typeof ctx?.body === 'string') {
                try {
                  const parsed = JSON.parse(ctx.body);
                  detailedMessage = parsed?.message || parsed?.error || parsed?.details || null;
                } catch {
                  detailedMessage = ctx.body;
                }
              }

              throw new Error(detailedMessage || (cardError as any)?.message || 'Erro ao criar negócio');
            }

            toast({
              title: "Sucesso",
              description: "Negócio criado com sucesso!"
            });

            // Aguardar um momento para o banco processar, então recarregar os cards
            setTimeout(async () => {
              await fetchContactCards();
            }, 500);

            setIsCreateDealModalOpen(false);
          } catch (error: any) {
            console.error('Erro ao criar negócio:', error);
            
            // Verificar se é erro de duplicação (do trigger ou da edge function)
            const errorMessage = error?.message || error?.context?.body?.message || '';
            const isDuplicateError = 
              errorMessage.includes('Já existe um card aberto') || 
              errorMessage.includes('duplicate_open_card') ||
              error?.context?.body?.error === 'duplicate_open_card';
            
            if (isDuplicateError) {
              toast({
                title: "Negócio já existe",
                description:
                  error?.message ||
                  error?.context?.body?.message ||
                  "Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.",
                variant: "destructive"
              });
            } else {
              toast({
                title: "Erro",
                description:
                  error?.message ||
                  error?.context?.body?.message ||
                  (error instanceof Error ? error.message : "Erro ao criar negócio"),
                variant: "destructive"
              });
            }
          }
        }}
      />

      {/* Modais de visualização de mídia */}
      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'image' && <ImageModal isOpen={true} onClose={() => setViewingMedia(null)} imageUrl={viewingMedia.url} fileName={viewingMedia.name} />}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'pdf' && <PdfModal isOpen={true} onClose={() => setViewingMedia(null)} pdfUrl={viewingMedia.url} fileName={viewingMedia.name} />}

      {viewingMedia && getFileType(viewingMedia.name, viewingMedia.type) === 'video' && <VideoModal isOpen={true} onClose={() => setViewingMedia(null)} videoUrl={viewingMedia.url} fileName={viewingMedia.name} />}
    </>;
}