import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

export interface WhatsAppMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia' | 'system' | 'user';
  created_at: string;
  read_at?: string | null;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  file_url?: string;
  file_name?: string;
  origem_resposta: 'automatica' | 'manual';
  provider_moment?: number; // 🕐 Timestamp real da mensagem no WhatsApp (Unix ms)
}

export interface WhatsAppConversation {
  id: string;
  contact: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    profile_image_url?: string;
  };
  agente_ativo: boolean;
  agent_active_id?: string | null;
  status: 'open' | 'closed' | 'pending' | 'em_atendimento';
  unread_count: number;
  last_activity_at: string;
  created_at: string;
  evolution_instance?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assigned_at?: string | null;
  connection_id?: string;
  connection?: {
    id: string;
    instance_name: string;
    phone_number?: string;
    status: string;
  };
  queue_id?: string | null;
  workspace_id?: string;
  conversation_tags?: Array<{
    id: string;
    tag_id: string;
    tags: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  last_message?: Array<{
    content: string;
    message_type: string;
    sender_type: string;
    created_at: string;
  }>;
  messages: WhatsAppMessage[];
  _updated_at?: number; // ✅ Timestamp para forçar re-render
}

export const useWhatsAppConversations = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled !== false;
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const { user, logout } = useAuth();
  const { getHeaders } = useWorkspaceHeaders();
  // Evitar logs extremamente verbosos que podem travar a UI
  
  // Refs simples
  const sendingRef = useRef<Map<string, boolean>>(new Map());

  const sortConversationsByActivity = useCallback((list: WhatsAppConversation[]) => {
    return [...list].sort((a, b) => {
      const getTimestamp = (conv: WhatsAppConversation) => new Date(conv.last_activity_at || conv.created_at).getTime();
      return getTimestamp(b) - getTimestamp(a);
    });
  }, []);

  const formatConversationRecord = (raw: any, previous?: WhatsAppConversation): WhatsAppConversation => {
    const contactData = Array.isArray(raw?.contacts) ? raw.contacts[0] : raw?.contacts;
    const connectionData = Array.isArray(raw?.connections) ? raw.connections[0] : raw?.connections;

    const fallbackContact = previous?.contact || {
      id: raw?.contact_id || 'unknown-contact',
      name: 'Contato',
      phone: undefined,
      email: undefined,
      profile_image_url: undefined
    };

    const contact = contactData ? {
      id: contactData.id,
      name: contactData.name || fallbackContact.name,
      phone: contactData.phone ?? fallbackContact.phone,
      email: contactData.email ?? fallbackContact.email,
      profile_image_url: contactData.profile_image_url ?? fallbackContact.profile_image_url
    } : fallbackContact;

    const connection = connectionData ? {
      id: connectionData.id,
      instance_name: connectionData.instance_name,
      phone_number: connectionData.phone_number,
      status: connectionData.status
    } : previous?.connection;

    return {
      id: raw.id,
      contact,
      agente_ativo: raw.agente_ativo ?? previous?.agente_ativo ?? false,
      agent_active_id: raw.agent_active_id ?? previous?.agent_active_id ?? null,
      status: (raw.status ?? previous?.status ?? 'open') as WhatsAppConversation['status'],
      unread_count: raw.unread_count ?? previous?.unread_count ?? 0,
      last_activity_at: raw.last_activity_at ?? previous?.last_activity_at ?? raw.created_at ?? new Date().toISOString(),
      created_at: raw.created_at ?? previous?.created_at ?? raw.last_activity_at ?? new Date().toISOString(),
      evolution_instance: raw.evolution_instance ?? previous?.evolution_instance ?? null,
      assigned_user_id: raw.assigned_user_id ?? previous?.assigned_user_id ?? null,
      assigned_user_name: raw.assigned_user_name ?? previous?.assigned_user_name ?? null,
      assigned_at: raw.assigned_at ?? previous?.assigned_at ?? null,
      connection_id: raw.connection_id ?? previous?.connection_id,
      connection,
      queue_id: raw.queue_id ?? previous?.queue_id ?? null,
      workspace_id: raw.workspace_id ?? previous?.workspace_id,
      conversation_tags: raw.conversation_tags ?? previous?.conversation_tags ?? [],
      last_message: raw.last_message ?? previous?.last_message ?? [],
      messages: previous?.messages ?? [],
      _updated_at: Date.now()
    };
  };

  const [conversationCounts, setConversationCounts] = useState<{
    all: number;
    mine: number;
    unassigned: number;
    unread: number;
  } | null>(null);

  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreConversationsRef = useRef(false);
  const fetchTokenRef = useRef(0);
  const currentSearchRef = useRef<string | null>(null);
  const unreadReconcileCacheRef = useRef<Map<string, number>>(new Map());

  // ✅ Reconciliar unread_count com a realidade (messages.sender_type='contact' AND read_at IS NULL)
  // Isso evita contadores "inflados" quando triggers/automations falham ou o unread_count deriva.
  const reconcileUnreadCounts = useCallback(
    async (conversationIds: string[]) => {
      const workspaceId = selectedWorkspace?.workspace_id;
      if (!workspaceId) return;

      for (const conversationId of conversationIds) {
        try {
          const { count, error } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('conversation_id', conversationId)
            .eq('sender_type', 'contact')
            .is('read_at', null);

          if (error) throw error;
          const realCount = Math.max(Number(count ?? 0), 0);

          const cached = unreadReconcileCacheRef.current.get(conversationId);
          if (cached === realCount) continue;
          unreadReconcileCacheRef.current.set(conversationId, realCount);

          // Atualiza estado local se estiver divergente
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === conversationId);
            if (idx === -1) return prev;
            const current = prev[idx];
            const currentUnread = Math.max(Number(current.unread_count ?? 0), 0);
            if (currentUnread === realCount) return prev;
            const updated = [...prev];
            updated[idx] = { ...current, unread_count: realCount, _updated_at: Date.now() };
            return updated;
          });

          // Tenta “curar” no banco também (best-effort; se RLS bloquear, ok)
          try {
            await supabase
              .from('conversations')
              .update({ unread_count: realCount })
              .eq('id', conversationId);
          } catch (_e) {
            // ignore
          }
        } catch (e) {
          console.warn('⚠️ [useWhatsAppConversations] Falha ao reconciliar unread_count:', {
            conversationId,
            e,
          });
        }
      }
    },
    [selectedWorkspace?.workspace_id]
  );

  // ✅ Helper: buscar conversa + dependências sem depender de join por FK (evita PGRST200 em schema cache)
  const fetchConversationWithRelations = useCallback(
    async (conversationId: string) => {
      if (!selectedWorkspace?.workspace_id) return null;
      const workspaceId = selectedWorkspace.workspace_id;

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select(
          `
            id,
            agente_ativo,
            agent_active_id,
            status,
            unread_count,
            last_activity_at,
            created_at,
            evolution_instance,
            contact_id,
            workspace_id,
            connection_id,
            assigned_user_id
          `
        )
        .eq('id', conversationId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (convErr || !conv) {
        return null;
      }

      const [contactRes, connRes] = await Promise.all([
        conv.contact_id
          ? supabase
              .from('contacts')
              .select('id, name, phone, email, profile_image_url')
              .eq('id', conv.contact_id)
              .eq('workspace_id', workspaceId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        conv.connection_id
          ? supabase
              .from('connections')
              .select('id, instance_name, phone_number, status')
              .eq('id', conv.connection_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

      // last_message (1 item)
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content, message_type, sender_type, created_at')
        .eq('workspace_id', workspaceId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);

      return {
        ...conv,
        contacts: contactRes?.data ? [contactRes.data] : [],
        connections: connRes?.data ? [connRes.data] : [],
        last_message: lastMessage || [],
      };
    },
    [selectedWorkspace?.workspace_id]
  );

  // Disparar reconciliação apenas para conversas que estão com unread_count > 0 (geralmente poucas)
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) return;
    if (!enabled) return;
    const candidates = conversations
      .filter((c) => Math.max(Number(c.unread_count ?? 0), 0) > 0)
      .slice(0, 30)
      .map((c) => c.id);
    if (candidates.length === 0) return;
    const handle = window.setTimeout(() => {
      reconcileUnreadCounts(candidates);
    }, 500);
    return () => window.clearTimeout(handle);
  }, [conversations, enabled, reconcileUnreadCounts, selectedWorkspace?.workspace_id]);

  const fetchConversations = useCallback(async (options?: { search?: string | null }): Promise<boolean> => {
    try {
      if (!enabled) {
        setLoading(false);
        setConversations([]);
        setHasMoreConversations(false);
        nextCursorRef.current = null;
        return false;
      }
      setLoading(true);

      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;

      if (!currentUserData?.id || !selectedWorkspace?.workspace_id) {
        setLoading(false);
        return false;
      }

      const headers = getHeaders();
      const PAGE_LIMIT = 50;
      const myToken = ++fetchTokenRef.current;

      // reset para novo carregamento
      nextCursorRef.current = null;
      setHasMoreConversations(false);
      setConversations([]);

      const normalizedSearch = (options?.search ?? '').toString().trim();
      currentSearchRef.current = normalizedSearch.length > 0 ? normalizedSearch : null;

      const conversationsById = new Map<string, any>();

      const fetchPage = async (cursor: string | null) => {
        // Enviar paginação via body para não depender de querystring no invoke()
        return await supabase.functions.invoke('whatsapp-get-conversations-lite', {
          body: {
            workspace_id: selectedWorkspace.workspace_id,
            limit: PAGE_LIMIT,
            cursor: cursor || null,
            search: currentSearchRef.current
          },
          headers
        });
      };

      let gotAny = false;

      // Primeira página (rápida)
      const { data, error } = await fetchPage(null);
      if (error) throw error;
      if (fetchTokenRef.current !== myToken) return false; // cancelado

      if (data?.counts) setConversationCounts(data.counts);
      const items = data?.items ?? [];

      // Se retornar 0 conversas, não fazer retry automático (evita loops/travas).
      if (items.length === 0) {
        setLoading(false);
        return false;
      }

      for (const raw of items) {
        const prev = conversationsById.get(raw.id);
        conversationsById.set(raw.id, formatConversationRecord(raw, prev));
      }

      gotAny = conversationsById.size > 0;
      setConversations(sortConversationsByActivity(Array.from(conversationsById.values())));
      nextCursorRef.current = data?.nextCursor || null;
      setHasMoreConversations(!!nextCursorRef.current);

      setLoading(false);
      return gotAny;
    } catch (error: any) {
      console.error('❌ Erro:', error);
      setLoading(false);
      return false;
    }
  }, [enabled, getHeaders, selectedWorkspace?.workspace_id, sortConversationsByActivity]);

  const loadMoreConversations = useCallback(async () => {
    if (!enabled) return;
    if (loadingMoreConversationsRef.current) return;
    const cursor = nextCursorRef.current;
    if (!cursor || !selectedWorkspace?.workspace_id) return;

    loadingMoreConversationsRef.current = true;
    setIsLoadingMoreConversations(true);
    const myToken = fetchTokenRef.current;

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-conversations-lite', {
        body: {
          workspace_id: selectedWorkspace.workspace_id,
          limit: 50,
          cursor,
          search: currentSearchRef.current
        },
        headers: getHeaders()
      });

      if (fetchTokenRef.current !== myToken) return; // cancelado
      if (error) throw error;

      if (data?.counts) setConversationCounts(data.counts);
      const items = data?.items ?? [];
      if (items.length === 0) {
        nextCursorRef.current = null;
        setHasMoreConversations(false);
        return;
      }

      const nextCursor = data?.nextCursor || null;
      if (nextCursor && nextCursor === cursor) {
        console.warn('⚠️ Cursor repetido detectado, interrompendo paginação para evitar loop.');
        nextCursorRef.current = null;
        setHasMoreConversations(false);
      } else {
        nextCursorRef.current = nextCursor;
        setHasMoreConversations(!!nextCursorRef.current);
      }

      setConversations(prev => {
        const byId = new Map(prev.map((c: any) => [c.id, c]));
        for (const raw of items) {
          const existing = byId.get(raw.id);
          byId.set(raw.id, formatConversationRecord(raw, existing));
        }
        return sortConversationsByActivity(Array.from(byId.values()));
      });
    } catch (e) {
      console.error('❌ Erro ao carregar mais conversas:', e);
    } finally {
      loadingMoreConversationsRef.current = false;
      setIsLoadingMoreConversations(false);
    }
  }, [getHeaders, selectedWorkspace?.workspace_id]);

  // Accept conversation function - DEPRECATED: Use useConversationAccept hook instead
  // This is kept for backward compatibility but should not be used
  const acceptConversation = useCallback(async (conversationId: string) => {
    console.warn('⚠️ Using deprecated acceptConversation from useWhatsAppConversations. Use useConversationAccept hook instead.');
    
    try {
      // Get current user from localStorage (custom auth system)
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('conversations')
        .update({ assigned_user_id: currentUserData.id })
        .eq('id', conversationId);

      if (error) {
        console.error('Error accepting conversation:', error);
        toast({
          title: "Erro",
          description: "Erro ao aceitar conversa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conversa aceita",
        description: "Você aceitou esta conversa",
      });
      
      // Update local state
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { 
                ...conv, 
                assigned_user_id: currentUserData.id,
                assigned_user_name: currentUserData.name || null
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Error in acceptConversation:', error);
      toast({
        title: "Erro",
        description: "Erro ao aceitar conversa",
        variant: "destructive",
      });
    }
  }, []);

  // Função utilitária para obter tipo de arquivo
  const getFileType = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'image/jpeg';
      case 'mp4':
      case 'mov':
      case 'avi':
        return 'video/mp4';
      case 'mp3':
      case 'wav':
      case 'ogg':
        return 'audio/mpeg';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  };

  // Enviar mensagem
  const sendMessage = useCallback(async (
    conversationId: string, 
    content: string, 
    contactPhone: string, 
    messageType: string = 'text', 
    fileUrl?: string, 
    fileName?: string
  ) => {
    // ✅ MUTEX: Prevenir duplo envio
    if (sendingRef.current.get(conversationId)) {
      return;
    }
    
    sendingRef.current.set(conversationId, true);
    
    try {
      // Obter dados do usuário logado
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se há workspace selecionado
      let workspaceId = selectedWorkspace?.workspace_id;
      
      if (!workspaceId) {
        return;
      }

      // ✅ GERAR clientMessageId ÚNICO
      const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Montar payload com clientMessageId
      const payload = {
        conversation_id: conversationId,
        content: content,
        message_type: messageType,
        sender_id: currentUserData.id,
        sender_type: "user", // ✅ CORRIGIDO: user ao invés de agent
        status: "sending", // ✅ CORRIGIDO: sending ao invés de sent
        file_url: fileUrl,
        file_name: fileName,
        clientMessageId // ✅ ENVIAR clientMessageId
      };

      const headers: Record<string, string> = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      // Add workspace context if available
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      }

      const { data: sendResult, error: apiError } = await supabase.functions.invoke('test-send-msg', {
        body: payload,
        headers
      });

      if (apiError) {
        console.error('Erro ao enviar via edge function:', apiError);
        const errorMessage = apiError.message || 'Erro ao enviar mensagem';
        throw new Error(errorMessage);
      }

      if (!sendResult?.success) {
        console.error('Envio falhou:', sendResult);
        const errorMessage = sendResult?.message || sendResult?.error || 'Falha no envio da mensagem';
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      // ✅ SEMPRE limpar mutex
      sendingRef.current.set(conversationId, false);
    }
  }, [selectedWorkspace, toast]);

  // Assumir atendimento (desativar IA)
  const assumirAtendimento = useCallback(async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: false,
          agent_active_id: null  // ✅ LIMPAR ID DO AGENTE
        })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: false, agent_active_id: null, _updated_at: Date.now() }
          : conv
      ));

      toast({
        title: "Agente Desativado",
        description: "O agente não irá mais interagir nessa conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao assumir atendimento:', error);
      toast({
        title: "Erro",
        description: "Erro ao assumir atendimento",
        variant: "destructive",
      });
    }
  }, []);

  // Reativar IA
  const reativarIA = useCallback(async (conversationId: string) => {
    try {
      // Buscar conversa para obter agent_active_id ou queue_id
      const { data: conversation } = await supabase
        .from('conversations')
        .select('agent_active_id, queue_id')
        .eq('id', conversationId)
        .single();
      
      let agentIdToActivate = conversation?.agent_active_id || null;
      
      // Se não tem agent_active_id mas tem queue_id, buscar da fila
      if (!agentIdToActivate && conversation?.queue_id) {
        const { data: queue } = await supabase
          .from('queues')
          .select('ai_agent_id')
          .eq('id', conversation.queue_id)
          .single();
        
        agentIdToActivate = queue?.ai_agent_id || null;
      }
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          agente_ativo: true,
          agent_active_id: agentIdToActivate  // ✅ RESTAURAR ID DO AGENTE
        })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, agente_ativo: true, agent_active_id: agentIdToActivate, _updated_at: Date.now() }
          : conv
      ));

      toast({
        title: "IA reativada",
        description: "A IA voltou a responder automaticamente nesta conversa",
      });
    } catch (error) {
      console.error('❌ Erro ao reativar IA:', error);
      toast({
        title: "Erro",
        description: "Erro ao reativar IA",
        variant: "destructive",
      });
    }
  }, []);

  // Marcar como lida
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      // Get current user data
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      // Marcar todas as mensagens do contato como lidas
      const { error: messagesError } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'contact')
        .is('read_at', null);

      if (messagesError) {
        console.error('❌ Erro ao marcar mensagens como lidas:', messagesError);
      }

      // Atualizar contador de não lidas na conversa
      const { error: conversationError } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);

      if (conversationError) {
        console.error('❌ Erro ao atualizar contador da conversa:', conversationError);
      }

      // ✅ CORREÇÃO 7: Atualizar estado local imediatamente
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { 
              ...conv, 
              unread_count: 0,
              messages: conv.messages.map(msg => 
                msg.sender_type === 'contact' 
                  ? { ...msg, read_at: new Date().toISOString() }
                  : msg
              )
            }
          : conv
      ));
    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  }, [selectedWorkspace]);

  // Limpar todas as conversas
  const clearAllConversations = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('clear-conversations');
      
      if (error) throw error;
      
      setConversations([]);
      toast({
        title: "Conversas limpas",
        description: "Todas as conversas foram removidas",
      });
    } catch (error) {
      console.error('❌ Erro ao limpar conversas:', error);
      toast({
        title: "Erro",
        description: "Erro ao limpar conversas",
        variant: "destructive",
      });
    }
  }, []);

  // ✅ CORREÇÃO: Flag de sucesso separada da flag de tentativa
  // Carregar conversas quando workspace muda
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const userData = localStorage.getItem('currentUser');
    if (!userData) {
      setLoading(false);
      return;
    }

    fetchConversations();
  }, [selectedWorkspace?.workspace_id]);

  // ===== REALTIME SUBSCRIPTION =====
  useEffect(() => {
    const startTime = Date.now();

    if (!selectedWorkspace?.workspace_id) {
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id;
    const channelName = `conversations-${workspaceId}-${startTime}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`
        },
        async (payload) => {
          const newConv = payload.new as any;
          
          if (newConv.canal !== 'whatsapp') {
            return;
          }
          
          // Buscar dados completos
          if (!selectedWorkspace?.workspace_id) {
            return;
          }

          if (!selectedWorkspace?.workspace_id) {
            return;
          }

          const conversationData = await fetchConversationWithRelations(newConv.id);

          if (!conversationData) {
            console.error('❌ Erro ao buscar conversa completa (sem join):', newConv.id);
            return;
          }

          setConversations(prev => {
            const exists = prev.some(c => c.id === conversationData.id);
            if (exists) {
              return prev;
            }
            const formattedConv = formatConversationRecord(conversationData);
            return sortConversationsByActivity([formattedConv, ...prev]);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`
        },
        async (payload) => {
          const updatedConv = payload.new as any;

          if (updatedConv.canal !== 'whatsapp') {
            return;
          }

          const conversationData = await fetchConversationWithRelations(updatedConv.id);

          if (!conversationData) {
            console.error('❌ Erro ao buscar conversa atualizada (sem join):', updatedConv.id);
            return;
          }

          setConversations(prev => {
            const index = prev.findIndex(c => c.id === conversationData.id);
            const formattedConv = formatConversationRecord(conversationData, index !== -1 ? prev[index] : undefined);
            if (index === -1) {
              return sortConversationsByActivity([formattedConv, ...prev]);
            }
            const updated = [...prev];
            updated[index] = formattedConv;
            return sortConversationsByActivity(updated);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `workspace_id=eq.${workspaceId}`
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Atualizar a conversa com a nova mensagem
          setConversations(prev => {
            const index = prev.findIndex(c => c.id === newMessage.conversation_id);
            
            if (index === -1) {
              return prev;
            }

            const updatedConversation = {
              ...prev[index],
              last_message: [{
                content: newMessage.content,
                message_type: newMessage.message_type,
                sender_type: newMessage.sender_type,
                created_at: newMessage.created_at
              }],
              last_activity_at: newMessage.created_at,
              _updated_at: Date.now()
            };

            const updatedList = [...prev];
            updatedList[index] = updatedConversation;
            return sortConversationsByActivity(updatedList);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME Conversations] ERRO NO CANAL!');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ [REALTIME Conversations] TIMEOUT!');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id]);

  return {
    conversations,
    loading,
    conversationCounts,
    loadMoreConversations,
    hasMoreConversations,
    isLoadingMoreConversations,
    sendMessage,
    markAsRead,
    assumirAtendimento,
    reativarIA,
    clearAllConversations,
    fetchConversations,
    acceptConversation
  };
};