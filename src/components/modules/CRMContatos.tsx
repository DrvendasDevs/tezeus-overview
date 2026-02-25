import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Phone,
  MessageCircle,
  Edit,
  Trash2,
  User,
  X,
  Mail,
  MapPin,
  Home,
  Globe,
  FileText,
  Pin,
  Download,
  Upload,
  Filter,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { ContactTags } from "@/components/chat/ContactTags";
import { useContactTags } from "@/hooks/useContactTags";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ContactTagSelector } from "@/components/crm/ContactTagSelector";
import { IniciarConversaContatoModal } from "@/components/modals/IniciarConversaContatoModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProfileImageDebug } from "@/components/debug/ProfileImageDebug";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTags } from "@/hooks/useTags";
import { format } from "date-fns";
import { DeletarTicketModal } from "@/components/modals/DeletarTicketModal";
import { AdicionarTagModal } from "@/components/modals/AdicionarTagModal";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceContactFields } from "@/hooks/useWorkspaceContactFields";
import { ConfigurarCamposObrigatoriosModal } from "@/components/modals/ConfigurarCamposObrigatoriosModal";
import { Separator } from "@/components/ui/separator";
import { useSyncUserContext } from "@/hooks/useUserContext";
import { logCreate, logUpdate, logDelete } from "@/utils/auditLog";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  birth_date?: string | null;
  createdAt: string;
  created_at?: string; // Campo original para exportação
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  avatar?: string;
  profile_image_url?: string;
  extra_info?: Record<string, any>;
}
const DEFAULT_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;

export function CRMContatos() {
  // Sincroniza o contexto do usuário para auditoria
  useSyncUserContext();
  
  const { selectedWorkspace } = useWorkspace();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const NO_TAG_FILTER_ID = "__NO_TAG__";
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [customFields, setCustomFields] = useState<
    Array<{
      key: string;
      value: string;
    }>
  >([]);
  const [newCustomField, setNewCustomField] = useState({
    key: "",
    value: "",
  });
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldType, setEditingFieldType] = useState<"key" | "value" | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [selectedDDI, setSelectedDDI] = useState("55");
  const [isDDIPopoverOpen, setIsDDIPopoverOpen] = useState(false);
  const [ddiSearch, setDdiSearch] = useState("");
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugContact, setDebugContact] = useState<Contact | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [selectedContactForTag, setSelectedContactForTag] = useState<string | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedContactForWhatsApp, setSelectedContactForWhatsApp] = useState<Contact | null>(null);
  const [isFieldConfigModalOpen, setIsFieldConfigModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerCheckboxRef = useRef<HTMLButtonElement>(null);
  const { tags } = useTags();
  const { toast } = useToast();
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;
  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };

  // Hook para campos obrigatórios do workspace
  const { fields: workspaceFields, refetch: refetchWorkspaceFields } = useWorkspaceContactFields(
    selectedWorkspace?.workspace_id || null,
  );

  const buildExtraInfoObject = useCallback((fields: Array<{ key: string; value: string }>) => {
    const result: Record<string, string> = {};

    fields.forEach((field) => {
      const key = field.key?.trim();
      if (!key) return;
      result[key] = field.value?.trim() ?? "";
    });

    return result;
  }, []);

  // Fetch contacts directly from contacts table
  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (!selectedWorkspace?.workspace_id) {
        setContacts([]);
        setIsLoading(false);
        return;
      }

      // ✅ Verificar workspace_id antes de fazer query
      if (!selectedWorkspace.workspace_id) {
        console.error("❌ [CRMContatos] workspace_id is missing!");
        toast({
          title: "Erro",
          description: "Workspace não selecionado. Selecione um workspace primeiro.",
          variant: "destructive",
        });
        setContacts([]);
        setIsLoading(false);
        return;
      }

      // Get all contacts from the workspace
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .order("created_at", {
          ascending: false,
        });

      if (contactsError) {
        console.error("❌ [CRMContatos] Error fetching contacts:", {
          code: contactsError.code,
          message: contactsError.message,
          details: contactsError.details,
          hint: contactsError.hint
        });
        
        // ✅ Verificar se é erro de RLS
        if (contactsError.code === '42501' || contactsError.message?.includes('permission denied') || contactsError.message?.includes('row-level security')) {
          toast({
            title: "Erro de permissão",
            description: "Você não tem permissão para visualizar contatos deste workspace. Verifique suas permissões.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao carregar contatos",
            description: contactsError.message || "Não foi possível carregar os contatos. Tente novamente.",
            variant: "destructive",
          });
        }
        
        setContacts([]);
        setIsLoading(false);
        return;
      }

      if (!contactsData || contactsData.length === 0) {
        setContacts([]);
        setIsLoading(false);
        return;
      }

      const contactIds = contactsData.map((c) => c.id);

      // Get contact tags - only if we have contacts
      let contactTagsData: any[] = [];
      let contactExtraInfoData: any[] = [];
      if (contactIds.length > 0) {
        const { data: tagsData, error: tagsError } = await supabase
          .from("contact_tags")
          .select(
            `
            contact_id,
            tags:tag_id (
              id,
              name,
              color
            )
          `,
          )
          .in("contact_id", contactIds);

        if (tagsError) {
          console.warn("⚠️ [CRMContatos] Error fetching tags (non-critical):", tagsError);
          // Continue without tags instead of failing completely
        } else {
          contactTagsData = tagsData || [];
        }

        const { data: extraInfoData, error: extraInfoError } = await supabase
          .from("contact_extra_info")
          .select("contact_id, field_name, field_value")
          .in("contact_id", contactIds);

        if (extraInfoError) {
          console.warn("⚠️ [CRMContatos] Error fetching extra info (non-critical):", extraInfoError);
        } else {
          contactExtraInfoData = extraInfoData || [];
        }
      }

      // Map tags to contacts
      const contactsWithTags = contactsData.map((contact) => {
        const mergedExtraInfo: Record<string, any> = {
          ...((contact.extra_info as Record<string, any>) || {}),
        };

        if (contactExtraInfoData.length > 0) {
          contactExtraInfoData
            .filter((extra) => extra.contact_id === contact.id)
            .forEach((extra) => {
              const key = extra.field_name;
              if (!key) return;
              mergedExtraInfo[key] = extra.field_value ?? "";
            });
        }

        const contactTags =
          contactTagsData
            .filter((ct) => ct.contact_id === contact.id)
            .map((ct) => ({
              id: ct.tags?.id || "",
              name: ct.tags?.name || "",
              color: ct.tags?.color || "#808080",
            })) || [];
        
        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone || "",
          email: contact.email || "",
          birth_date: contact.birth_date || null,
          createdAt: format(new Date(contact.created_at), "dd/MM/yyyy HH:mm:ss"),
          created_at: contact.created_at, // Manter o original para exportação
          tags: contactTags,
          profile_image_url: contact.profile_image_url,
          extra_info: mergedExtraInfo,
        };
      });

      setContacts(contactsWithTags);
    } catch (error: any) {
      console.error("❌ [CRMContatos] Unexpected error fetching contacts:", error);
      toast({
        title: "Erro ao carregar contatos",
        description: error?.message || "Ocorreu um erro inesperado. Tente recarregar a página.",
        variant: "destructive",
      });
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWorkspace?.workspace_id, toast]);

  // Resetar página ao mudar termo de busca
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedTagIds, pageSize]);

  // ✅ CARREGAR CONTATOS AUTOMATICAMENTE quando workspace ou página mudar
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    // ✅ FETCH DIRETO SEM DEPENDÊNCIA CIRCULAR
    const loadContacts = async () => {
      try {
        setIsLoading(true);

      // Get contacts com suporte a busca (ilike) e paginação apenas quando sem busca
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        const search = searchTerm.trim();
        const wantsNoTag = selectedTagIds.includes(NO_TAG_FILTER_ID);
        const realTagIds = selectedTagIds.filter((id) => id !== NO_TAG_FILTER_ID);
        const hasTagFilter = selectedTagIds.length > 0;
        const hasAnyFilter = !!search || hasTagFilter;

        let tagFilteredContactIds: string[] | null = null;
        if (realTagIds.length > 0) {
          // AND: contato deve ter TODAS as tags selecionadas
          const { data: tagLinks, error: tagLinksError } = await supabase
            .from("contact_tags")
            .select("contact_id, tag_id")
            .in("tag_id", realTagIds);

          if (tagLinksError) {
            console.error("❌ [CRMContatos] Error fetching contact_tags:", tagLinksError);
            toast({
              title: "Erro ao filtrar por etiqueta",
              description: tagLinksError.message || "Não foi possível aplicar o filtro de etiquetas.",
              variant: "destructive",
            });
            setContacts([]);
            setTotalCount(0);
            return;
          }

          const map = new Map<string, Set<string>>();
          (tagLinks || []).forEach((row: any) => {
            const contactId = String(row.contact_id || "");
            const tagId = String(row.tag_id || "");
            if (!contactId || !tagId) return;
            const set = map.get(contactId) || new Set<string>();
            set.add(tagId);
            map.set(contactId, set);
          });

          tagFilteredContactIds = Array.from(map.entries())
            .filter(([, set]) => set.size >= realTagIds.length)
            .map(([contactId]) => contactId);

          if (tagFilteredContactIds.length === 0) {
            setContacts([]);
            setTotalCount(0);
            return;
          }
        } else if (wantsNoTag) {
          // Sem etiqueta: contatos que NÃO possuem nenhuma tag
          let idsQuery = supabase
            .from("contacts")
            .select("id")
            .eq("workspace_id", selectedWorkspace.workspace_id);

          if (search) {
            idsQuery = idsQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
          }

          const { data: idRows, error: idsError } = await idsQuery;
          if (idsError) {
            console.error("❌ [CRMContatos] Error fetching contact ids for no-tag filter:", idsError);
            toast({
              title: "Erro ao filtrar por etiqueta",
              description: idsError.message || "Não foi possível aplicar o filtro de 'Sem etiqueta'.",
              variant: "destructive",
            });
            setContacts([]);
            setTotalCount(0);
            return;
          }

          const allIds = Array.from(new Set((idRows || []).map((r: any) => String(r.id)).filter(Boolean)));
          if (allIds.length === 0) {
            setContacts([]);
            setTotalCount(0);
            return;
          }

          const { data: taggedRows, error: taggedError } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .in("contact_id", allIds);

          if (taggedError) {
            console.error("❌ [CRMContatos] Error fetching tagged contacts for no-tag filter:", taggedError);
            toast({
              title: "Erro ao filtrar por etiqueta",
              description: taggedError.message || "Não foi possível aplicar o filtro de 'Sem etiqueta'.",
              variant: "destructive",
            });
            setContacts([]);
            setTotalCount(0);
            return;
          }

          const taggedSet = new Set<string>((taggedRows || []).map((r: any) => String(r.contact_id)).filter(Boolean));
          tagFilteredContactIds = allIds.filter((id) => !taggedSet.has(id));

          if (tagFilteredContactIds.length === 0) {
            setContacts([]);
            setTotalCount(0);
            return;
          }
        }

        let query = supabase
          .from("contacts")
          .select("*", { count: "exact" })
          .eq("workspace_id", selectedWorkspace.workspace_id)
          .order("created_at", {
            ascending: false,
          });

        if (search) {
          query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        if (tagFilteredContactIds && tagFilteredContactIds.length > 0) {
          query = query.in("id", tagFilteredContactIds);
        }

        // Sem filtros -> paginação normal. Com filtros (busca ou etiqueta) -> traz tudo na primeira tela.
        if (!hasAnyFilter) {
          query = query.range(start, end);
        }

        const { data: contactsData, error: contactsError, count } = await query;

        if (contactsError) {
          console.error("❌ [CRMContatos] Error:", contactsError);
          toast({
            title: "Erro ao carregar contatos",
            description: contactsError.message || "Não foi possível carregar os contatos.",
            variant: "destructive",
          });
          setContacts([]);
          return;
        }

        setTotalCount(count || 0);

        if (!contactsData || contactsData.length === 0) {
          setContacts([]);
          return;
        }

        // Buscar tags opcionalmente (não bloquear se falhar)
        const contactIds = contactsData.map((c) => c.id);
        let contactTagsData: any[] = [];
        let contactExtraInfoData: any[] = [];
        
        if (contactIds.length > 0) {
          try {
            const { data: tagsData } = await supabase
              .from("contact_tags")
              .select("contact_id, tags:tag_id (id, name, color)")
              .in("contact_id", contactIds);
            
            contactTagsData = tagsData || [];
          } catch (tagsError) {
            console.warn("⚠️ [CRMContatos] Tags error (non-critical):", tagsError);
          }

          try {
            const { data: extraInfoData } = await supabase
              .from("contact_extra_info")
              .select("contact_id, field_name, field_value")
              .in("contact_id", contactIds);

            contactExtraInfoData = extraInfoData || [];
          } catch (extraError) {
            console.warn("⚠️ [CRMContatos] Extra info error (non-critical):", extraError);
          }
        }

        // Mapear contatos com tags
        const contactsWithTags = contactsData.map((contact) => {
          const mergedExtraInfo: Record<string, any> = {
            ...((contact.extra_info as Record<string, any>) || {}),
          };

          if (contactExtraInfoData.length > 0) {
            contactExtraInfoData
              .filter((extra) => extra.contact_id === contact.id)
              .forEach((extra) => {
                const key = extra.field_name;
                if (!key) return;
                mergedExtraInfo[key] = extra.field_value ?? "";
              });
          }

          const contactTags =
            contactTagsData
              .filter((ct) => ct.contact_id === contact.id)
              .map((ct) => ({
                id: ct.tags?.id || "",
                name: ct.tags?.name || "",
                color: ct.tags?.color || "#808080",
              })) || [];
          
          return {
            id: contact.id,
            name: contact.name,
            phone: contact.phone || "",
            email: contact.email || "",
            birth_date: contact.birth_date || null,
            createdAt: format(new Date(contact.created_at), "dd/MM/yyyy HH:mm:ss"),
            created_at: contact.created_at, // Manter o original para exportação
            tags: contactTags,
            profile_image_url: contact.profile_image_url,
            extra_info: mergedExtraInfo,
          };
        });

        setContacts(contactsWithTags);
      } catch (error: any) {
        console.error("❌ [CRMContatos] Unexpected error:", error);
        toast({
          title: "Erro ao carregar contatos",
          description: error?.message || "Ocorreu um erro inesperado.",
          variant: "destructive",
        });
        setContacts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, [selectedWorkspace?.workspace_id, toast, page, searchTerm, selectedTagIds, pageSize]); // ✅ inclui filtros (busca + tags)

  // Real-time subscription for contacts changes
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) return;

    const channel = supabase
      .channel(`contacts-changes-${selectedWorkspace.workspace_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        async (payload) => {
          const newContactData = payload.new;
          const newContact: Contact = {
            id: newContactData.id,
            name: newContactData.name,
            phone: newContactData.phone || "",
            email: newContactData.email || "",
            createdAt: format(new Date(newContactData.created_at), "dd/MM/yyyy HH:mm:ss"),
            tags: [],
            profile_image_url: newContactData.profile_image_url,
            extra_info: (newContactData.extra_info as Record<string, any>) || {},
          };
          setContacts((prev) => {
            // Avoid duplicates
            if (prev.some(c => c.id === newContact.id)) {
              return prev;
            }
            return [newContact, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        (payload) => {
          // ✅ Atualizar apenas o contato específico (mais eficiente)
          const updatedContact = payload.new;
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === updatedContact.id
                ? {
                    ...contact,
                    name: updatedContact.name,
                    phone: updatedContact.phone || "",
                    email: updatedContact.email || "",
                    profile_image_url: updatedContact.profile_image_url,
                    extra_info: (updatedContact.extra_info as Record<string, any>) || {},
                  }
                : contact
            )
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "contacts",
          filter: `workspace_id=eq.${selectedWorkspace.workspace_id}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          setContacts((prev) => prev.filter((c) => c.id !== deletedId));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("❌ [CRMContatos] Realtime subscription error");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, fetchContacts]);

  // Filter contacts based on search and tag filter
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      !searchTerm ||
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm);

    // Se nenhuma tag está selecionada, mostra todos os contatos
    if (selectedTagIds.length === 0) {
      return matchesSearch;
    }

    const wantsNoTag = selectedTagIds.includes(NO_TAG_FILTER_ID);
    const realTagIds = selectedTagIds.filter((id) => id !== NO_TAG_FILTER_ID);

    // "Sem etiqueta" => contato sem nenhuma tag
    if (wantsNoTag) {
      return matchesSearch && (!contact.tags || contact.tags.length === 0);
    }

    // AND => contato deve ter todas as tags selecionadas
    const contactTagIds = contact.tags.map((t) => t.id).filter(Boolean);

    const matchesTag = realTagIds.every((selectedId) => contactTagIds.includes(selectedId));

    return matchesSearch && matchesTag;
  });
  const handleDeleteContact = async (contact: Contact, muteToast?: boolean): Promise<boolean> => {
    try {
      // Delete in the correct order due to foreign key constraints

      // 1. Delete messages first
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (messagesError) throw messagesError;

      // 2. Delete conversation tags
      const { error: conversationTagsError } = await supabase
        .from("conversation_tags")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (conversationTagsError) throw conversationTagsError;

      // 3. Delete conversation participants
      const { error: participantsError } = await supabase
        .from("conversation_participants")
        .delete()
        .in(
          "conversation_id",
          await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .then(({ data }) => data?.map((c) => c.id) || []),
        );
      if (participantsError) throw participantsError;

      // 4. Delete conversations
      const { error: conversationsError } = await supabase.from("conversations").delete().eq("contact_id", contact.id);
      if (conversationsError) throw conversationsError;

      // 5. Delete n8n chat histories (usando telefone do contato como session_id)
      if (contact.phone) {
        try {
          // Função para normalizar telefone (remove caracteres não numéricos)
          const normalizePhone = (phone: string): string => {
            return phone.replace(/\D/g, '');
          };

          // Gerar variações possíveis do telefone para buscar
          const phoneVariations = new Set<string>();
          
          // Adicionar formato original
          phoneVariations.add(contact.phone);
          
          // Normalizar e adicionar variações
          const normalized = normalizePhone(contact.phone);
          if (normalized) {
            phoneVariations.add(normalized);
            
            // Variação com código do país (55 para Brasil)
            if (!normalized.startsWith('55') && normalized.length >= 10) {
              phoneVariations.add(`55${normalized}`);
              phoneVariations.add(`+55${normalized}`);
            }
            
            // Variação sem código do país (remove 55 se houver no início)
            if (normalized.startsWith('55') && normalized.length > 2) {
              phoneVariations.add(normalized.substring(2));
            }
            
            // Variação com + no início
            if (!normalized.startsWith('+')) {
              phoneVariations.add(`+${normalized}`);
            }
          }

          const uniqueVariations = Array.from(phoneVariations).filter(p => p && p.trim() !== '');

          // Tentar deletar com cada variação
          for (const phoneVar of uniqueVariations) {
            try {
              const { error: n8nError } = await supabase
                .from("n8n_chat_histories")
                .delete()
                .eq("session_id", phoneVar)
                .select();
              
              if (n8nError) {
                // Apenas registrar erros críticos (não incluir "No rows" ou "permission denied")
                const errorMsg = n8nError.message || String(n8nError);
                if (!errorMsg.toLowerCase().includes('no rows') && 
                    !errorMsg.toLowerCase().includes('permission') &&
                    !errorMsg.toLowerCase().includes('not found')) {
                  console.warn(`⚠️ Error deleting n8n_chat_histories for ${phoneVar}:`, n8nError);
                }
              }
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              // Apenas registrar erros críticos
              if (!errorMsg.toLowerCase().includes('not found') && 
                  !errorMsg.toLowerCase().includes('permission')) {
                console.warn(`⚠️ Exception deleting n8n_chat_histories for ${phoneVar}:`, errorMsg);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error processing n8n_chat_histories deletion:`, error);
          // Não lançar erro para não impedir a deleção do contato
          // Apenas logar o erro
        }
      }

      // 6. Delete activities
      const { error: activitiesError } = await supabase.from("activities").delete().eq("contact_id", contact.id);
      if (activitiesError) throw activitiesError;

      // 7. Delete contact tags
      const { error: contactTagsError } = await supabase.from("contact_tags").delete().eq("contact_id", contact.id);
      if (contactTagsError) throw contactTagsError;

      // 8. Finally delete the contact
      const { error: contactError } = await supabase.from("contacts").delete().eq("id", contact.id);
      if (contactError) throw contactError;

      // Registrar auditoria
      await logDelete(
        'contact',
        contact.id,
        contact.name || contact.phone || 'Contato',
        { name: contact.name, phone: contact.phone, email: contact.email },
        selectedWorkspace?.workspace_id
      );

      // Update local state
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      if (!muteToast) {
        toast({
          title: "Contato excluído",
          description: "O contato e todos os dados relacionados foram removidos com sucesso.",
        });
      }
      return true;
    } catch (error) {
      console.error("Error deleting contact:", error);
      if (!muteToast) {
        toast({
          title: "Erro ao excluir",
          description: "Ocorreu um erro ao excluir o contato. Tente novamente.",
          variant: "destructive",
        });
      }
      // Propagar erro para operações em massa poderem reagir corretamente
      if (muteToast) throw error;
      return false;
    }
  };
  const handleBulkDelete = async () => {
    const contactsToDelete = contacts.filter((c) => selectedIds.includes(c.id));
    try {
      let success = 0;
      for (const contact of contactsToDelete) {
        try {
          const ok = await handleDeleteContact(contact, true);
          if (ok) success++;
        } catch (e) {
          // já tratado por handleDeleteContact quando muteToast=true (rethrow)
        }
      }
      // Recarregar lista da base para garantir consistência visual
      await fetchContacts();
      toast({
        title: "Exclusão em massa finalizada",
        description: `${success} de ${contactsToDelete.length} contatos foram removidos.`,
      });
      setSelectedIds([]);
      setIsBulkDeleteOpen(false);
    } catch (error) {
      toast({
        title: "Erro na exclusão em massa",
        description: "Ocorreu um erro ao excluir os contatos. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  const handleAddContact = () => {
    setIsCreateMode(true);
    setSelectedDDI("55"); // Reset DDI para Brasil
    setEditingContact({
      id: "",
      name: "",
      phone: "",
      email: "",
      createdAt: "",
      tags: [],
      extra_info: {},
    });
    // Start with empty fields
    setCustomFields([]);
    setNewCustomField({ key: "", value: "" });
  };
  const handleEditContact = async (contact: Contact) => {
    setEditingContact(contact);

    const fieldsMap = new Map<string, string>();

    if (contact.extra_info && typeof contact.extra_info === "object") {
      Object.entries(contact.extra_info).forEach(([key, value]) => {
        if (!key) return;
        fieldsMap.set(key, value !== null && value !== undefined ? String(value) : "");
      });
    }

    // Load existing custom fields from contact_extra_info table
    try {
      const { data: extraInfoData, error } = await supabase
        .from("contact_extra_info")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (extraInfoData && extraInfoData.length > 0) {
        extraInfoData.forEach((field) => {
          if (!field.field_name) return;
          fieldsMap.set(field.field_name, field.field_value ?? "");
        });
      }

      if (fieldsMap.size > 0) {
        setCustomFields(
          Array.from(fieldsMap.entries()).map(([key, value]) => ({
            key,
            value,
          })),
        );
      } else {
        setCustomFields([]);
      }
    } catch (error) {
      console.error("Error loading extra info:", error);
      setCustomFields([]);
    }

    // Reset new field inputs
    setNewCustomField({ key: "", value: "" });
  };
  const handleSaveContact = async () => {
    if (!editingContact) return;

    // Basic validation
    if (!editingContact.name.trim()) {
      toast({
        title: "Erro de validação",
        description: "O nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // Campos padrões do workspace (não obrigatórios)

    setIsSaving(true);

    // Validar se telefone já existe (apenas no modo criação)
    if (isCreateMode && editingContact.phone.trim()) {
      // Sanitizar telefone para validação (adicionar DDI selecionado se não tiver)
      let sanitizedPhone = editingContact.phone.trim().replace(/\D/g, '');
      if (sanitizedPhone && !sanitizedPhone.startsWith(selectedDDI)) {
        sanitizedPhone = selectedDDI + sanitizedPhone;
      }

      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("workspace_id", selectedWorkspace!.workspace_id)
        .eq("phone", sanitizedPhone)
        .maybeSingle();

      if (existingContact) {
        toast({
          title: "Telefone já cadastrado",
          description: `Este número já pertence ao contato "${existingContact.name}".`,
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
    }

    try {
      const extraInfoObject = buildExtraInfoObject(customFields);

      if (isCreateMode) {
        // Sanitizar telefone adicionando DDI selecionado na frente se não tiver
        let sanitizedPhone = editingContact.phone.trim().replace(/\D/g, '');
        if (sanitizedPhone && !sanitizedPhone.startsWith(selectedDDI)) {
          sanitizedPhone = selectedDDI + sanitizedPhone;
        }

        // Create new contact
        const { data: newContactData, error } = await supabase
          .from("contacts")
          .insert({
            name: editingContact.name.trim(),
            phone: sanitizedPhone || null,
            email: editingContact.email.trim() || null,
            birth_date: editingContact.birth_date || null,
            workspace_id: selectedWorkspace!.workspace_id,
            extra_info: Object.keys(extraInfoObject).length > 0 ? extraInfoObject : null,
          })
          .select()
          .single();
        if (error) throw error;

        // Save custom fields to contact_extra_info table
        const fieldsToInsert = customFields
          .filter((field) => field.key.trim() && field.value.trim())
          .map((field) => ({
            contact_id: newContactData.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.key.trim(),
            field_value: field.value.trim(),
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase.from("contact_extra_info").insert(fieldsToInsert);

          if (extraInfoError) {
            console.error("Error saving extra info:", extraInfoError);
          }
        }

        // O contato será adicionado automaticamente pelo realtime subscription
        // Removido a adição manual para evitar duplicação
        
        // Registrar log de auditoria
        await logCreate(
          'contact',
          newContactData.id,
          newContactData.name,
          { name: newContactData.name, phone: newContactData.phone, email: newContactData.email },
          selectedWorkspace!.workspace_id
        );
        
        toast({
          title: "Contato criado",
          description: "O novo contato foi adicionado com sucesso.",
        });
      } else {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            name: editingContact.name.trim(),
            email: editingContact.email.trim() || null,
            birth_date: editingContact.birth_date || null,
            updated_at: new Date().toISOString(),
            // phone removido - não pode ser alterado para preservar histórico
            extra_info: Object.keys(extraInfoObject).length > 0 ? extraInfoObject : null,
          })
          .eq("id", editingContact.id);
        if (error) throw error;

        // Delete existing extra info fields
        await supabase.from("contact_extra_info").delete().eq("contact_id", editingContact.id);

        // Insert new extra info fields
        const fieldsToInsert = customFields
          .filter((field) => field.key.trim() && field.value.trim())
          .map((field) => ({
            contact_id: editingContact.id,
            workspace_id: selectedWorkspace!.workspace_id,
            field_name: field.key.trim(),
            field_value: field.value.trim(),
          }));

        if (fieldsToInsert.length > 0) {
          const { error: extraInfoError } = await supabase.from("contact_extra_info").insert(fieldsToInsert);

          if (extraInfoError) {
            console.error("Error saving extra info:", extraInfoError);
          }
        }

        // Update local contacts list
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === editingContact.id
              ? {
                  ...contact,
                  name: editingContact.name.trim(),
                  phone: editingContact.phone.trim(),
                  email: editingContact.email.trim(),
                  extra_info: extraInfoObject,
                }
              : contact,
          ),
        );
        
        // Registrar log de auditoria
        await logUpdate(
          'contact',
          editingContact.id,
          editingContact.name.trim(),
          null, // oldData não disponível
          { name: editingContact.name.trim(), email: editingContact.email.trim() },
          selectedWorkspace!.workspace_id
        );
        
        toast({
          title: "Contato atualizado",
          description: "As informações do contato foram salvas com sucesso.",
        });
      }
      setEditingContact(null);
      setCustomFields([]);
      setIsCreateMode(false);
    } catch (error: any) {
      console.error("Error saving contact:", error);

      // Verificar se é erro de constraint único
      if (error.code === "23505" && error.message?.includes("idx_contacts_phone_workspace")) {
        toast({
          title: "Telefone duplicado",
          description: "Já existe um contato com este número de telefone neste workspace.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao salvar",
          description: "Ocorreu um erro ao salvar as alterações. Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleAddCustomField = () => {
    if (!newCustomField.key.trim() || !newCustomField.value.trim()) {
      toast({
        title: "Erro",
        description: "Preencha o nome do campo e o valor",
        variant: "destructive",
      });
      return;
    }

    const fieldExists = customFields.some(
      (field) => field.key.toLowerCase() === newCustomField.key.trim().toLowerCase(),
    );
    if (fieldExists) {
      toast({
        title: "Erro",
        description: "Este campo já existe. Use um nome diferente.",
        variant: "destructive",
      });
      return;
    }

    setCustomFields((prev) => [
      ...prev,
      {
        key: newCustomField.key.trim(),
        value: newCustomField.value.trim(),
      },
    ]);

    setNewCustomField({ key: "", value: "" });
  };

  const updateCustomField = (index: number, key: string, value: string) => {
    setCustomFields(
      customFields.map((field, i) =>
        i === index
          ? {
              ...field,
              [key]: value,
            }
          : field,
      ),
    );
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const getFieldIcon = (fieldKey: string) => {
    const key = fieldKey.toLowerCase();
    if (key.includes("email") || key.includes("e-mail")) {
      return <Mail className="h-4 w-4" />;
    }
    if (key.includes("telefone") || key.includes("phone") || key.includes("celular")) {
      return <Phone className="h-4 w-4" />;
    }
    if (key.includes("cep") || key.includes("zip")) {
      return <MapPin className="h-4 w-4" />;
    }
    if (key.includes("endereço") || key.includes("address") || key.includes("rua")) {
      return <Home className="h-4 w-4" />;
    }
    if (key.includes("perfil") || key.includes("tipo") || key.includes("categoria")) {
      return <User className="h-4 w-4" />;
    }
    if (key.includes("país") || key.includes("country") || key.includes("estado")) {
      return <Globe className="h-4 w-4" />;
    }
    if (key.includes("cpf") || key.includes("cnpj") || key.includes("documento")) {
      return <FileText className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const handleAddTagToContact = () => {
    // Refetch contacts to show updated tags
    fetchContacts();
    setIsTagModalOpen(false);
    setSelectedContactForTag(null);
  };

  const handleExportCSV = async () => {
    if (!selectedWorkspace?.workspace_id) {
      toast({
        title: "Erro",
        description: "Selecione um workspace para exportar.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      // Buscar contatos a exportar:
      // - Se houver seleção, busca pelos IDs selecionados (mesmo fora da página)
      // - Caso contrário, busca todos os contatos do workspace (sem paginação)
      let baseContacts: any[] = [];
      if (selectedIds.length > 0) {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .in("id", selectedIds);
        if (error) throw error;
        baseContacts = data || [];
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .select("*")
          .eq("workspace_id", selectedWorkspace.workspace_id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        baseContacts = data || [];
      }

      if (!baseContacts || baseContacts.length === 0) {
        toast({
          title: "Nenhum contato para exportar",
          description: selectedIds.length > 0
            ? "Selecione contatos válidos para exportar."
            : "Não há contatos disponíveis para exportação.",
          variant: "destructive",
        });
        return;
      }

      // Buscar tags e extra_info para todos os contatos selecionados/base
      const contactIds = baseContacts.map((c) => c.id);
      let contactTagsData: any[] = [];
      let contactExtraInfoData: any[] = [];

      if (contactIds.length > 0) {
        try {
          const { data: tagsData } = await supabase
            .from("contact_tags")
            .select("contact_id, tags:tag_id (id, name, color)")
            .in("contact_id", contactIds);
          contactTagsData = tagsData || [];
        } catch (tagsError) {
          console.warn("⚠️ [Export] Falha ao buscar tags (não bloqueia):", tagsError);
        }

        try {
          const { data: extraInfoData } = await supabase
            .from("contact_extra_info")
            .select("contact_id, field_name, field_value")
            .in("contact_id", contactIds);
          contactExtraInfoData = extraInfoData || [];
        } catch (extraError) {
          console.warn("⚠️ [Export] Falha ao buscar extra_info (não bloqueia):", extraError);
        }
      }

      // Normalizar contatos com tags/extra_info
      const contactsForExport = baseContacts.map((contact) => {
        const mergedExtraInfo: Record<string, any> = {
          ...((contact.extra_info as Record<string, any>) || {}),
        };

        if (contactExtraInfoData.length > 0) {
          contactExtraInfoData
            .filter((extra) => extra.contact_id === contact.id)
            .forEach((extra) => {
              const key = extra.field_name;
              if (!key) return;
              mergedExtraInfo[key] = extra.field_value ?? "";
            });
        }

        const contactTags =
          contactTagsData
            .filter((ct) => ct.contact_id === contact.id)
            .map((ct) => ({
              id: ct.tags?.id || "",
              name: ct.tags?.name || "",
              color: ct.tags?.color || "#808080",
            })) || [];

        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone || "",
          email: contact.email || "",
          birth_date: contact.birth_date || null,
          createdAt: format(new Date(contact.created_at), "dd/MM/yyyy HH:mm:ss"),
          created_at: contact.created_at,
          tags: contactTags,
          profile_image_url: contact.profile_image_url,
          extra_info: mergedExtraInfo,
        };
      });

    const baseHeaders = ["Nome", "Telefone", "Email", "Data de Criação"];
    const workspaceFieldNames = workspaceFields.map((field) => field.field_name);
    const extraInfoKeySet = new Set<string>();

    contactsForExport.forEach((contact) => {
      const extraInfo = contact.extra_info;
      if (extraInfo && typeof extraInfo === "object" && !Array.isArray(extraInfo)) {
        Object.keys(extraInfo).forEach((key) => {
          if (key) {
            extraInfoKeySet.add(key);
          }
        });
      }
    });

    workspaceFieldNames.forEach((key) => {
      if (key) {
        extraInfoKeySet.add(key);
      }
    });

    const orderedWorkspaceKeys = workspaceFieldNames.filter((key) => extraInfoKeySet.has(key));
    const otherExtraKeys = Array.from(extraInfoKeySet).filter((key) => !workspaceFieldNames.includes(key)).sort();
    const extraInfoHeaders = [...orderedWorkspaceKeys, ...otherExtraKeys];
    const headers = [...baseHeaders, ...extraInfoHeaders, "Etiquetas"];

    const normalizeValue = (value: unknown) => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return String(value);
    };

    const escapeCSVValue = (value: unknown) => {
      const normalized = normalizeValue(value);
      const escaped = normalized.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const csvContent = [
      headers.map((header) => escapeCSVValue(header)).join(","),
      ...contactsForExport.map((contact) => {
        const createdAtFormatted = contact.created_at ? format(new Date(contact.created_at), "dd/MM/yyyy HH:mm") : "";
        const extraInfo = contact.extra_info && typeof contact.extra_info === "object" && !Array.isArray(contact.extra_info)
          ? (contact.extra_info as Record<string, unknown>)
          : {};
        const tagsAsString = (contact.tags || []).map((tag) => tag.name).filter(Boolean).join(", ");

        const rowValues = [
          escapeCSVValue(contact.name),
          escapeCSVValue(contact.phone || ""),
          escapeCSVValue(contact.email || ""),
          escapeCSVValue(createdAtFormatted),
          ...extraInfoHeaders.map((key) => escapeCSVValue(extraInfo[key] ?? "")),
          escapeCSVValue(tagsAsString),
        ];

        return rowValues.join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `contatos_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${contactsForExport.length} contato(s) exportado(s) com sucesso.`,
    });
    } catch (error) {
      console.error("❌ [Export] Erro ao exportar contatos:", error);
      toast({
        title: "Erro ao exportar",
        description: error?.message || "Não foi possível exportar os contatos.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const sep = ";";
    const headers = ["Nome", "Empresa", "Telefone", "Etiquetas", "Email"];
    // Forçar telefone como texto no Excel usando ="..." e separar etiquetas por vírgula
    const exampleRow = ["João da Silva", "ACME", '="5511999999999"', "VIP,Ativo", "joao@email.com"];
    
    const csvContent = [
      "sep=;",
      headers.join(sep),
      exampleRow.join(sep)
    ].join("\n");

    // Prepend BOM to avoid charset issues in Excel
    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_contatos.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo baixado",
      description: "O modelo de importação foi baixado com sucesso.",
    });
  };

  const handleDownloadFullTemplate = () => {
    const sep = ";";
    const headers = [
      "Nome",
      "Empresa",
      "Etiquetas",
      "Telefone",
      "Email",
      "Status do negócio",
      "R$",
      "Etapa",
      "Pipeline",
      "Fila",
      "Usuário responsável",
      "Data que foi marcado ganho",
      "Data de criação do negócio",
    ];
    const exampleRow = [
      "João da Silva",          // Nome
      "ACME",                  // Empresa
      "VIP,Ativo",             // Etiquetas
      '="5511999999999"',      // Telefone (como texto)
      "joao@acme.com",         // Email
      "ganho",                 // Status do negócio
      "15000",                 // R$
      "Fechado",               // Etapa
      "Pipeline A",            // Pipeline
      "Suporte",               // Fila
      "gestor@acme.com",       // Usuário responsável
      "2025-12-01",            // Data que foi marcado ganho
      "2025-11-10",            // Data de criação do negócio
    ];

    const csvContent = [
      "sep=;",
      headers.join(sep),
      exampleRow.join(sep)
    ].join("\n");

    // Prepend BOM to avoid charset issues in Excel
    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_completo.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Modelo completo baixado",
      description: "O modelo de importação (contato + oportunidade) foi baixado.",
    });
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        throw new Error("Arquivo CSV vazio ou inválido");
      }

      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      const dataLines = lines.slice(1);

      // Detecta se é importação completa (tem Pipeline e Etapa) ou básica
      const hasPipeline = headers.some((h) => h.toLowerCase().includes("pipeline"));
      const hasEtapa = headers.some((h) => h.toLowerCase().includes("etapa"));
      const isFullImport = hasPipeline && hasEtapa;

      let imported = 0;
      let errors = 0;

      // Pré-carregar dados auxiliares para importação completa
      let pipelinesByName: Record<string, any> = {};
      let columnsByPipelineAndName: Record<string, any> = {};
      let usersByEmail: Record<string, any> = {};
      let usersByName: Record<string, any> = {};

      if (isFullImport) {
        // Pipelines e colunas do workspace
        const { data: pipelines } = await supabase
          .from("pipelines")
          .select("id, name")
          .eq("workspace_id", selectedWorkspace.workspace_id);
        (pipelines || []).forEach((p: any) => {
          pipelinesByName[p.name?.toLowerCase()?.trim() || ""] = p;
        });

        const { data: cols } = await supabase
          .from("pipeline_columns")
          .select("id, name, pipeline_id")
          .eq("workspace_id", selectedWorkspace.workspace_id);
        (cols || []).forEach((c: any) => {
          const key = `${c.pipeline_id}::${(c.name || "").toLowerCase().trim()}`;
          columnsByPipelineAndName[key] = c;
        });

        // Usuários do workspace (system_users via workspace_members)
        const { data: members } = await supabase
          .from("workspace_members")
          .select("user_id, system_users (id, name, email)")
          .eq("workspace_id", selectedWorkspace.workspace_id);
        (members || []).forEach((m: any) => {
          const u = m.system_users;
          if (!u) return;
          if (u.email) usersByEmail[u.email.toLowerCase().trim()] = u;
          if (u.name) usersByName[u.name.toLowerCase().trim()] = u;
        });
      }

      const normalizePhoneForStorage = (rawPhone: string): string | null => {
        if (!rawPhone) return null;
        const digitsOnly = rawPhone.replace(/\D/g, "");
        if (!digitsOnly) return null;
        return digitsOnly.startsWith("55") ? digitsOnly : `55${digitsOnly}`;
      };

      const parseDate = (value: string): string | null => {
        if (!value) return null;
        // Tenta ISO direto
        const isoTry = new Date(value);
        if (!Number.isNaN(isoTry.getTime())) return isoTry.toISOString();
        // Tenta dd/MM/yyyy
        const parts = value.split("/");
        if (parts.length === 3) {
          const [d, m, y] = parts.map((p) => parseInt(p, 10));
          if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
            const date = new Date(Date.UTC(y, m - 1, d));
            if (!Number.isNaN(date.getTime())) return date.toISOString();
          }
        }
        return null;
      };

      for (const line of dataLines) {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
        const getVal = (match: string) => {
          const idx = headers.findIndex((h) => h.toLowerCase().includes(match.toLowerCase()));
          return idx >= 0 ? values[idx] : "";
        };

        const name = getVal("nome");
        const phone = getVal("telefone");
        const email = getVal("email");
        const empresa = getVal("empresa");
        const etiquetasRaw = getVal("etiquetas");

        if (!name) {
          errors++;
          continue;
        }

        try {
          const normalizedPhone = normalizePhoneForStorage(phone);

          // 1) Criar/atualizar contato
          // Match por telefone ou email
          let contactId: string | null = null;
          if (normalizedPhone) {
            const { data: existingByPhone } = await supabase
              .from("contacts")
              .select("id")
              .eq("workspace_id", selectedWorkspace.workspace_id)
              .eq("phone", normalizedPhone)
              .maybeSingle();
            if (existingByPhone?.id) contactId = existingByPhone.id;
          }
          if (!contactId && email) {
            const { data: existingByEmail } = await supabase
              .from("contacts")
              .select("id")
              .eq("workspace_id", selectedWorkspace.workspace_id)
              .eq("email", email)
              .maybeSingle();
            if (existingByEmail?.id) contactId = existingByEmail.id;
          }

          const contactPayload: any = {
            name,
            phone: normalizedPhone,
            email: email || null,
            workspace_id: selectedWorkspace.workspace_id,
            extra_info: empresa ? { empresa } : {},
          };

          if (contactId) {
            const { error: updErr } = await supabase
              .from("contacts")
              .update(contactPayload)
              .eq("id", contactId);
            if (updErr) throw updErr;
          } else {
            const { data: inserted, error: insErr } = await supabase
              .from("contacts")
              .insert(contactPayload)
              .select("id")
              .single();
            if (insErr) throw insErr;
            contactId = inserted?.id || null;
          }

          // 2) Aplicar etiquetas (tags) se houver
          if (contactId && etiquetasRaw) {
            const tagNames = etiquetasRaw.split(",").map((t) => t.trim()).filter(Boolean);
            if (tagNames.length > 0) {
              for (const tagName of tagNames) {
                try {
                  let tagId: string | null = null;
                  const { data: existingTag } = await supabase
                    .from("tags")
                    .select("id")
                    .eq("workspace_id", selectedWorkspace.workspace_id)
                    .eq("name", tagName)
                    .maybeSingle();
                  if (existingTag?.id) {
                    tagId = existingTag.id;
                  } else {
                    const { data: newTag, error: tagErr } = await supabase
                      .from("tags")
                      .insert({ name: tagName, workspace_id: selectedWorkspace.workspace_id })
                      .select("id")
                      .single();
                    if (tagErr) throw tagErr;
                    tagId = newTag?.id || null;
                  }

                  if (tagId) {
                    await supabase
                      .from("contact_tags")
                      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: "contact_id,tag_id" });
                  }
                } catch (tagError) {
                  console.warn("⚠️ [Import] Falha ao aplicar tag:", tagError);
                }
              }
            }
          }

          // 3) Se importação completa, criar oportunidade (pipeline_card)
          if (isFullImport && contactId) {
            const statusNegocio = (getVal("status do negócio") || "").toLowerCase();
            const valorRaw = getVal("r$");
            const etapaName = getVal("etapa");
            const pipelineName = getVal("pipeline");
            const filaName = getVal("fila");
            const responsavelRaw = getVal("usuário responsável");
            const dataGanhoRaw = getVal("data que foi marcado ganho");
            const dataCriacaoRaw = getVal("data de criação do negócio");

            // Resolver pipeline / etapa
            const pipeline = pipelinesByName[pipelineName?.toLowerCase()?.trim() || ""];
            if (!pipeline) {
              errors++;
              continue; // pipeline não encontrado
            }
            const colKey = `${pipeline.id}::${(etapaName || "").toLowerCase().trim()}`;
            const column = columnsByPipelineAndName[colKey];
            if (!column) {
              errors++;
              continue; // etapa não encontrada
            }

            // Resolver responsável
            let responsibleId: string | null = null;
            if (responsavelRaw) {
              const byEmail = usersByEmail[responsavelRaw.toLowerCase().trim()];
              const byName = usersByName[responsavelRaw.toLowerCase().trim()];
              responsibleId = byEmail?.id || byName?.id || null;
            }

            // Status
            let cardStatus = "open";
            if (statusNegocio.includes("ganho") || statusNegocio.includes("win")) cardStatus = "won";
            else if (statusNegocio.includes("perd") || statusNegocio.includes("loss")) cardStatus = "lost";

            const valor = valorRaw ? parseFloat(valorRaw.replace(/[^\d.-]/g, "")) : 0;
            const wonAt = cardStatus === "won" ? parseDate(dataGanhoRaw) : null;
            const createdAtCard = parseDate(dataCriacaoRaw);

            // Inserir card
            const insertPayload: any = {
              pipeline_id: pipeline.id,
              column_id: column.id,
              contact_id: contactId,
              value: Number.isFinite(valor) ? valor : 0,
              status: cardStatus,
              title: name,
            };
            if (responsibleId) insertPayload.responsible_user_id = responsibleId;
            if (createdAtCard) insertPayload.created_at = createdAtCard;
            if (wonAt && cardStatus === "won") insertPayload.won_at = wonAt;
            if (filaName) insertPayload.queue_name = filaName;

            const { error: cardError } = await supabase.from("pipeline_cards").insert(insertPayload);
            if (cardError) {
              console.error("Erro ao criar oportunidade:", cardError);
              errors++;
              continue;
            }
          }

          imported++;
        } catch (error) {
          console.error("Erro ao importar linha:", error);
          errors++;
        }
      }

      await fetchContacts();

      toast({
        title: "Importação concluída",
        description: `${imported} registro(s) importado(s) com sucesso${errors > 0 ? `. ${errors} erro(s) encontrados.` : "."}`,
      });
    } catch (error) {
      console.error("Erro ao processar CSV:", error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível processar o arquivo CSV.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0e0e0e] dark:border-gray-700 dark:text-gray-100">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Contatos
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
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-7 px-3 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 flex gap-1 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]">
                   <Filter className="h-3 w-3" />
                  {selectedTagIds.length === 0 ? (
                    <span>Filtro</span>
                  ) : selectedTagIds.includes(NO_TAG_FILTER_ID) ? (
                    <span>Sem etiqueta</span>
                  ) : (
                    <span>{selectedTagIds.length}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="max-h-60 overflow-y-auto p-2 bg-white dark:bg-[#1b1b1b] dark:text-gray-100">
                  {tags.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs dark:text-gray-400">Nenhuma etiqueta encontrada</div>
                  ) : (
                    <>
                      {/* Opção: Sem etiqueta (mutuamente exclusiva) */}
                      <div
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer dark:hover:bg-[#2a2a2a]"
                        onClick={() => setSelectedTagIds((prev) => (prev.includes(NO_TAG_FILTER_ID) ? [] : [NO_TAG_FILTER_ID]))}
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(NO_TAG_FILTER_ID)}
                          onCheckedChange={() => setSelectedTagIds((prev) => (prev.includes(NO_TAG_FILTER_ID) ? [] : [NO_TAG_FILTER_ID]))}
                        />
                        <span className="text-xs">Sem etiqueta</span>
                      </div>

                      <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer dark:hover:bg-[#2a2a2a]"
                          onClick={() => {
                            setSelectedTagIds((prev) => {
                              const withoutNoTag = prev.filter((id) => id !== NO_TAG_FILTER_ID);
                              return withoutNoTag.includes(tag.id)
                                ? withoutNoTag.filter((id) => id !== tag.id)
                                : [...withoutNoTag, tag.id];
                            });
                          }}
                        >
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={() => {
                              setSelectedTagIds((prev) => {
                                const withoutNoTag = prev.filter((id) => id !== NO_TAG_FILTER_ID);
                                return withoutNoTag.includes(tag.id)
                                  ? withoutNoTag.filter((id) => id !== tag.id)
                                  : [...withoutNoTag, tag.id];
                              });
                            }}
                          />
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                              <span className="text-xs">{tag.name}</span>
                          </div>
                        </div>
                      ))}
                      {selectedTagIds.length > 0 && (
                        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-gray-700 dark:text-gray-200"
                            onClick={() => setSelectedTagIds([])}
                          >
                            Limpar filtros
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={() => setIsFieldConfigModalOpen(true)}
            >
              <Pin className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">Campos</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={handleAddContact}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[9px]">Novo</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">{isExporting ? "..." : "Exportar"}</span>
            </Button>

             <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">{isImporting ? "..." : "Importar"}</span>
            </Button>

            {/* Modelos de importação */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">Modelo básico</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={handleDownloadFullTemplate}
            >
              <Download className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">Modelo completo</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 hover:bg-red-50 hover:text-red-600 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a1f1f]"
              disabled={selectedIds.length === 0}
              onClick={() => setIsBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 text-black dark:text-white" />
              <span className="text-[9px]">Excluir</span>
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportCSV}
          />
        </div>
      </div>

      {/* Excel Grid Table */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505] relative">
        <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
          <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Etiquetas</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Número</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[180px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Empresa</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Email</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[140px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Criado em</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-10 dark:border-gray-700 dark:text-gray-200">
                  <Checkbox
                    checked={
                      filteredContacts.length > 0 && filteredContacts.every((contact) => selectedIds.includes(contact.id))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(filteredContacts.map((contact) => contact.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="h-3 w-3 rounded-[2px] border-gray-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1f1f1f]">
                      <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                         <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700"></td>
                    </tr>
                  ))}
                </>
              ) : filteredContacts.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={8} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a]">
                    <div className="flex flex-col items-center gap-2">
                      <User className="h-8 w-8 text-gray-300 dark:text-gray-500" />
                      <p className="text-gray-500 font-medium dark:text-gray-300">
                        {searchTerm || selectedTagIds.length > 0
                          ? "Nenhum contato encontrado com os filtros aplicados"
                          : "Nenhum contato cadastrado ainda"}
                      </p>
                      {!searchTerm && selectedTagIds.length === 0 && (
                        <Button
                          size="sm"
                          className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs rounded-sm"
                          onClick={handleAddContact}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Adicionar contato
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact, index) => (
                  <tr key={contact.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                    {/* Name */}
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap dark:border-gray-700">
                      <span className="text-gray-900 font-medium truncate dark:text-gray-100">{contact.name && contact.name !== '-' ? contact.name : (contact.phone || 'Sem nome')}</span>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap align-top dark:border-gray-700">
                      <div className="flex items-start gap-1 h-full">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {contact.tags.length > 0 ? (
                            contact.tags.slice(0, 10).map((tag, i) => (
                              <Badge
                                key={`${contact.id}-tag-${i}`}
                                variant="outline"
                                className="h-5 rounded-none text-[10px] font-semibold tracking-tight px-2 py-0 flex items-center gap-1 border-none text-black dark:text-white"
                                style={{
                                  backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)'
                                }}
                              >
                                <span className="truncate max-w-[120px] text-black dark:text-white">{tag.name}</span>
                                <button
                                  className="ml-1 rounded-sm hover:bg-black/10 transition-colors flex items-center justify-center"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await supabase
                                        .from('contact_tags')
                                        .delete()
                                        .eq('contact_id', contact.id)
                                        .eq('tag_id', tag.id);
                                      await fetchContacts();
                                    } catch (error) {
                                      console.error('Erro ao remover tag:', error);
                                    }
                                  }}
                                  title="Remover tag"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-gray-400 italic dark:text-gray-500">Sem etiquetas</span>
                          )}
                        </div>
                        <Popover>
                          <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-sm hover:bg-gray-200 dark:hover:bg-[#2a2a2a] dark:text-gray-200">
                              <Plus className="h-3 w-3 text-gray-500 dark:text-gray-300" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-0" align="start" onClick={(e) => e.stopPropagation()}>
                            <ContactTagSelector contactId={contact.id} onTagAdded={fetchContacts} />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-right text-gray-600 whitespace-nowrap font-mono bg-white dark:bg-[#111111] dark:border-gray-700 dark:text-gray-200">
                      {contact.phone}
                    </td>

                    {/* Empresa */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-gray-600 whitespace-nowrap truncate bg-white dark:bg-[#111111] dark:border-gray-700 dark:text-gray-200">
                      {contact.extra_info?.empresa ||
                        contact.extra_info?.Empresa ||
                        contact.extra_info?.company ||
                        contact.extra_info?.Company ||
                        ""}
                    </td>

                    {/* Email */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-gray-600 whitespace-nowrap truncate bg-white dark:bg-[#111111] dark:border-gray-700 dark:text-gray-200">
                      {contact.email}
                    </td>

                    {/* Created At */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center text-gray-500 whitespace-nowrap bg-white dark:bg-[#111111] dark:border-gray-700 dark:text-gray-300">
                      {contact.createdAt}
                    </td>

                    {/* Actions */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center bg-white dark:bg-[#111111] dark:border-gray-700">
                      <div className="flex items-center justify-center gap-0.5 h-full">
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-sm hover:bg-gray-100 text-black dark:text-white dark:hover:bg-gray-800"
                          onClick={() => {
                            setSelectedContactForWhatsApp(contact);
                            setIsWhatsAppModalOpen(true);
                          }}
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#2a1f1f]"
                          onClick={() => setDeletingContact(contact)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>

                    {/* Checkbox */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center bg-gray-50 dark:bg-[#111111] dark:border-gray-700">
                      <Checkbox
                        checked={selectedIds.includes(contact.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => [...prev, contact.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
                          }
                        }}
                        className="h-3 w-3 rounded-[2px] border-gray-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer fixo com paginação */}
        <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Linhas {startIndex}-{endIndex} de {totalCount || 0}
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                Anterior
              </Button>
              <span>
                Página {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={isLoading || page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Contact Modal */}
      <Dialog
        open={!!editingContact}
        onOpenChange={() => {
          setEditingContact(null);
          setIsCreateMode(false);
        }}
      >
        <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-primary-foreground dark:text-gray-100">{isCreateMode ? "Adicionar contato" : "Editar contato"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-primary">
                Nome
              </Label>
              <Input
                id="name"
                value={editingContact?.name || ""}
                onChange={(e) =>
                  setEditingContact((prev) =>
                    prev
                      ? {
                          ...prev,
                          name: e.target.value,
                        }
                      : null,
                  )
                }
                className="border-primary dark:bg-[#161616] dark:border-primary dark:text-gray-100"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-200">Telefone</Label>
              <div className="flex gap-2">
                <Popover open={isDDIPopoverOpen} onOpenChange={setIsDDIPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={!isCreateMode}
                      className={`flex h-10 w-24 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-[#1a1a1a] dark:border-gray-700 dark:text-gray-300 ${!isCreateMode ? "bg-muted cursor-not-allowed opacity-50" : "hover:bg-accent"}`}
                    >
                      <span>+{selectedDDI}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0 dark:bg-[#1a1a1a] dark:border-gray-700" align="start">
                    <div className="flex flex-col">
                      {/* Campo para digitar manualmente */}
                      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                        <input
                          type="text"
                          placeholder="Escolha abaixo ou digite aqui"
                          value={ddiSearch}
                          onChange={(e) => setDdiSearch(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && ddiSearch) {
                              setSelectedDDI(ddiSearch);
                              setDdiSearch("");
                              setIsDDIPopoverOpen(false);
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-100 outline-none focus:border-primary"
                          maxLength={4}
                        />
                        {ddiSearch && (
                          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                            Pressione Enter para usar +{ddiSearch}
                          </p>
                        )}
                      </div>
                      
                      {/* Lista de sugestões - só mostra se não estiver digitando */}
                      {!ddiSearch && (
                        <div className="max-h-48 overflow-y-auto">
                          <p className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Sugestões</p>
                          {[
                            { code: "55", country: "Brasil" },
                            { code: "1", country: "EUA/Canadá" },
                            { code: "351", country: "Portugal" },
                            { code: "44", country: "Reino Unido" },
                            { code: "33", country: "França" },
                            { code: "49", country: "Alemanha" },
                            { code: "34", country: "Espanha" },
                            { code: "39", country: "Itália" },
                            { code: "81", country: "Japão" },
                            { code: "82", country: "Coreia do Sul" },
                            { code: "86", country: "China" },
                            { code: "54", country: "Argentina" },
                            { code: "52", country: "México" },
                            { code: "57", country: "Colômbia" },
                            { code: "56", country: "Chile" },
                            { code: "591", country: "Bolívia" },
                            { code: "595", country: "Paraguai" },
                            { code: "598", country: "Uruguai" },
                            { code: "51", country: "Peru" },
                            { code: "593", country: "Equador" },
                          ].map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => {
                                setSelectedDDI(item.code);
                                setDdiSearch("");
                                setIsDDIPopoverOpen(false);
                              }}
                              className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              +{item.code} ({item.country})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <Input
                  value={editingContact?.phone || ""}
                  onChange={
                    isCreateMode
                      ? (e) =>
                          setEditingContact((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  phone: e.target.value,
                                }
                              : null,
                          )
                      : undefined
                  }
                  readOnly={!isCreateMode}
                  disabled={!isCreateMode}
                  className={`dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 ${!isCreateMode ? "bg-muted cursor-not-allowed dark:bg-[#1a1a1a]" : ""}`}
                  title={!isCreateMode ? "O telefone não pode ser alterado após a criação do contato" : ""}
                  placeholder={isCreateMode ? "Digite o telefone" : "(55) 2 1981-5490"}
                />
              </div>
              {!isCreateMode && (
                <p className="text-xs text-muted-foreground mt-1 dark:text-gray-400">
                  ⚠️ O número não pode ser alterado para preservar o histórico de conversas
                </p>
              )}
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-200">Email</Label>
              <Input
                value={editingContact?.email || ""}
                onChange={(e) =>
                  setEditingContact((prev) =>
                    prev
                      ? {
                          ...prev,
                          email: e.target.value,
                        }
                      : null,
                  )
                }
                className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-200">Data de Nascimento</Label>
              <Input
                type="date"
                value={editingContact?.birth_date || ""}
                onChange={(e) =>
                  setEditingContact((prev) =>
                    prev
                      ? {
                          ...prev,
                          birth_date: e.target.value || null,
                        }
                      : null,
                  )
                }
                className="dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
              />
            </div>

            {/* Campos obrigatórios da empresa */}
            {workspaceFields.length > 0 && (
              <div>
                <Label className="text-sm font-medium flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <Pin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Campos obrigatórios da empresa
                </Label>
                <div className="space-y-3 mt-2">
                  {workspaceFields.map((field) => {
                    const currentValue = customFields.find((f) => f.key === field.field_name)?.value || "";

                    return (
                      <div
                        key={field.id}
                        className="p-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <Label className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                          {field.field_name} *
                        </Label>
                        <Input
                          value={currentValue}
                          onChange={(e) => {
                            const exists = customFields.findIndex((f) => f.key === field.field_name);
                            if (exists !== -1) {
                              setCustomFields((prev) =>
                                prev.map((f, i) => (i === exists ? { ...f, value: e.target.value } : f)),
                              );
                            } else {
                              setCustomFields((prev) => [...prev, { key: field.field_name, value: e.target.value }]);
                            }
                          }}
                          placeholder={`Digite ${field.field_name.toLowerCase()}`}
                          className="mt-1 border-gray-300 dark:border-gray-700 dark:bg-[#161616] dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {workspaceFields.length > 0 && <Separator className="my-4" />}

            <div>
              <Label className="text-sm font-medium">Informações Adicionais (Opcionais)</Label>
              <div className="space-y-3 mt-2">
                {/* Lista de campos opcionais - Cards compactos */}
                <div className="space-y-3">
                  {customFields
                    .filter((field) => !workspaceFields.some((wf) => wf.field_name === field.key))
                    .map((field, index) => {
                      const originalIndex = customFields.findIndex(
                        (f) => f.key === field.key && f.value === field.value,
                      );
                      return (
                        <div
                          key={originalIndex}
                          className="group relative p-4 bg-muted/30 border border-border/40 rounded-lg hover:shadow-sm transition-all dark:bg-[#1a1a1a] dark:border-gray-700"
                        >
                          <div className="flex items-start gap-3">
                            {/* Ícone dinâmico */}
                            <div className="mt-0.5 text-muted-foreground">{getFieldIcon(field.key)}</div>

                            <div className="flex-1 space-y-1 min-w-0">
                              {/* Label do campo - EDITÁVEL com double-click */}
                              {editingFieldIndex === originalIndex && editingFieldType === "key" ? (
                                <input
                                  type="text"
                                  value={field.key}
                                  onChange={(e) => updateCustomField(originalIndex, "key", e.target.value)}
                                  onBlur={() => {
                                    setEditingFieldIndex(null);
                                    setEditingFieldType(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full text-xs font-bold uppercase tracking-wide bg-transparent border-none outline-none border-b-2 border-primary pb-0.5"
                                />
                              ) : (
                                <p
                                  className="text-xs font-bold uppercase tracking-wide truncate cursor-pointer"
                                  onDoubleClick={() => {
                                    setEditingFieldIndex(originalIndex);
                                    setEditingFieldType("key");
                                  }}
                                  title="Clique duas vezes para editar"
                                >
                                  {field.key}
                                </p>
                              )}

                              {/* Valor editável com underline inline */}
                              {editingFieldIndex === originalIndex && editingFieldType === "value" ? (
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => updateCustomField(originalIndex, "value", e.target.value)}
                                  onBlur={() => {
                                    setEditingFieldIndex(null);
                                    setEditingFieldType(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full text-sm font-normal bg-transparent border-none outline-none border-b-2 border-primary pb-0.5"
                                />
                              ) : (
                                <p
                                  onDoubleClick={() => {
                                    setEditingFieldIndex(originalIndex);
                                    setEditingFieldType("value");
                                  }}
                                  className="text-sm font-normal text-muted-foreground cursor-pointer truncate"
                                  title="Clique duas vezes para editar"
                                >
                                  {field.value || "Clique para adicionar"}
                                </p>
                              )}
                            </div>

                            {/* Botão delete - visível apenas no hover */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              onClick={() => handleRemoveCustomField(originalIndex)}
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Adicionar novo campo */}
                <div className="border-t pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nome do campo"
                      value={newCustomField.key}
                      onChange={(e) => setNewCustomField((prev) => ({ ...prev, key: e.target.value }))}
                      className="text-sm h-9 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                    <Input
                      placeholder="Valor"
                      value={newCustomField.value}
                      onChange={(e) => setNewCustomField((prev) => ({ ...prev, value: e.target.value }))}
                      className="text-sm h-9 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                    onClick={handleAddCustomField}
                    disabled={!newCustomField.key.trim() || !newCustomField.value.trim()}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar campo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-[#d4d4d4] dark:border-gray-700 bg-[#f7f7f7] dark:bg-[#111111]">
            <Button
              variant="outline"
              onClick={() => {
                setEditingContact(null);
                setIsCreateMode(false);
              }}
              disabled={isSaving}
              className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveContact}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-none disabled:opacity-70"
              disabled={isSaving || !editingContact?.name?.trim()}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <DeletarTicketModal
        isOpen={!!deletingContact}
        onClose={() => setDeletingContact(null)}
        onConfirm={() => {
          if (deletingContact) {
            handleDeleteContact(deletingContact);
            setDeletingContact(null);
          }
        }}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeletarTicketModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />

      {/* WhatsApp Conversation Modal */}
      {selectedContactForWhatsApp && (
        <IniciarConversaContatoModal
          open={isWhatsAppModalOpen}
          onOpenChange={setIsWhatsAppModalOpen}
          contactId={selectedContactForWhatsApp.id}
          contactName={selectedContactForWhatsApp.name}
          contactPhone={selectedContactForWhatsApp.phone}
        />
      )}

      {/* Debug Profile Image Modal */}
      {showDebugModal && debugContact && selectedWorkspace && (
        <Dialog open={showDebugModal} onOpenChange={setShowDebugModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
            <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
              <DialogTitle>Debug - Imagem de Perfil</DialogTitle>
            </DialogHeader>
            <ProfileImageDebug
              contactId={debugContact.id}
              contactName={debugContact.name}
              contactPhone={debugContact.phone || ""}
              workspaceId={selectedWorkspace.workspace_id}
              currentImageUrl={debugContact.profile_image_url || undefined}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de configuração de campos obrigatórios */}
      {selectedWorkspace && (
        <ConfigurarCamposObrigatoriosModal
          open={isFieldConfigModalOpen}
          onClose={() => {
            setIsFieldConfigModalOpen(false);
            refetchWorkspaceFields();
          }}
          workspaceId={selectedWorkspace.workspace_id}
        />
      )}
    </div>
  );
}
