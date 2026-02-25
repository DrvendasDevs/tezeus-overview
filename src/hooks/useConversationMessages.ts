import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type: 'contact' | 'agent' | 'system' | 'ia' | 'user';
  sender_id?: string;
  file_url?: string;
  file_name?: string;
  mime_type?: string;
  created_at: string;
  status?: string;
  delivered_at?: string;
  read_at?: string;
  external_id?: string;
  metadata?: any;
  workspace_id?: string;
  origem_resposta?: string;
  reply_to_message_id?: string;
  quoted_message?: {
    id: string;
    content: string;
    sender_type: 'contact' | 'agent' | 'system' | 'ia' | 'user';
    message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
    file_url?: string;
    file_name?: string;
    external_id?: string;
  };
  evolution_key_id?: string | null;
  provider_moment?: number; // 🕐 Timestamp real da mensagem no WhatsApp (Unix ms)
}

const isPlainObject = (value: unknown): value is Record<string, any> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const normalizeLinkId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
};

const getProviderLinkedIds = (message: WhatsAppMessage): string[] => {
  const metadata = isPlainObject(message.metadata) ? message.metadata : {};
  const candidates = [
    normalizeLinkId(metadata.provider_msg_id),
    normalizeLinkId(metadata.provider_message_id),
    normalizeLinkId(message.evolution_key_id)
  ];

  return candidates.filter((id): id is string => !!id);
};

const mergeMessageRecords = (
  existing: WhatsAppMessage,
  incoming: WhatsAppMessage
): WhatsAppMessage => {
  const existingMetadata = isPlainObject(existing.metadata) ? existing.metadata : {};
  const incomingMetadata = isPlainObject(incoming.metadata) ? incoming.metadata : {};
  const mergedMetadata = { ...existingMetadata, ...incomingMetadata };

  return {
    ...existing,
    ...incoming,
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined
  };
};

const dedupeAndSortMessages = (messages: WhatsAppMessage[]): WhatsAppMessage[] => {
  const accumulator: WhatsAppMessage[] = [];

  for (const message of messages) {
    const normalizedExternal = normalizeLinkId(message.external_id);

    // 1. Verificar duplicação por ID
    const indexById = accumulator.findIndex(existing => existing.id === message.id);
    if (indexById !== -1) {
      accumulator[indexById] = mergeMessageRecords(accumulator[indexById], message);
      continue;
    }

    // 2. Verificar duplicação por external_id
    if (normalizedExternal) {
      const indexByExternal = accumulator.findIndex(
        existing => normalizeLinkId(existing.external_id) === normalizedExternal
      );
      if (indexByExternal !== -1) {
        accumulator[indexByExternal] = mergeMessageRecords(
          accumulator[indexByExternal],
          message
        );
        continue;
      }
    }

    // 3. Verificar duplicação por provider_msg_id / evolution_key_id
    const incomingProviderIds = getProviderLinkedIds(message);
    const providerMatchIndex = accumulator.findIndex(existing => {
      const existingProviderIds = getProviderLinkedIds(existing);
      const existingExternal = normalizeLinkId(existing.external_id);

      if (
        normalizedExternal &&
        existingProviderIds.some(providerId => providerId === normalizedExternal)
      ) {
        return true;
      }

      if (
        existingExternal &&
        incomingProviderIds.some(providerId => providerId === existingExternal)
      ) {
        return true;
      }

      return existingProviderIds.some(providerId =>
        incomingProviderIds.includes(providerId)
      );
    });

    if (providerMatchIndex !== -1) {
      accumulator[providerMatchIndex] = mergeMessageRecords(
        accumulator[providerMatchIndex],
        message
      );
      continue;
    }

    accumulator.push(message);
  }

  // 🕐 Ordenar por provider_moment (timestamp real do WhatsApp) se disponível
  // Fallback para created_at para mensagens antigas sem provider_moment
  return [...accumulator].sort((a, b) => {
    const aTime = a.provider_moment || new Date(a.created_at).getTime();
    const bTime = b.provider_moment || new Date(b.created_at).getTime();
    return aTime - bTime;
  });
};

const INVOKE_TIMEOUT_MS = 12000;

const invokeWithTimeout = async <T>(promise: Promise<T>, ms = INVOKE_TIMEOUT_MS): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timeout ao carregar mensagens'));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

interface UseConversationMessagesReturn {
  messages: WhatsAppMessage[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadInitial: (
    conversationId: string,
    arg?:
      | boolean
      | {
          forceRefresh?: boolean;
          /** Refresh sem "piscar" a UI: não limpa `messages` antes do fetch. */
          preserveExisting?: boolean;
        }
  ) => Promise<void>;
  loadMore: () => Promise<void>;
  addMessage: (message: WhatsAppMessage) => void;
  updateMessage: (messageId: string, updates: Partial<WhatsAppMessage>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
}

type RealtimeMessageEventDetail = {
  workspaceId: string;
  message: WhatsAppMessage;
};

type GlobalMessagesChannelState = {
  workspaceId: string;
  channel: RealtimeChannel;
  subscribers: number;
};

let globalMessagesChannelState: GlobalMessagesChannelState | null = null;

const REALTIME_MESSAGE_INSERT_EVENT = 'tezeus:realtime-message-insert';
const REALTIME_MESSAGE_UPDATE_EVENT = 'tezeus:realtime-message-update';

export function useConversationMessages(options?: {
  enableBackgroundPreload?: boolean;
  cacheTtlMs?: number;
  debug?: boolean;
}): UseConversationMessagesReturn {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursorBefore, setCursorBefore] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const { selectedWorkspace } = useWorkspace();
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();
  
  const debug = options?.debug ?? false;
  const enableBackgroundPreload = options?.enableBackgroundPreload ?? false;
  const cacheTtlMs = options?.cacheTtlMs ?? 15_000;

  // Cache em memória
  const cacheRef = useRef<Map<string, { messages: WhatsAppMessage[]; timestamp: number; cursorBefore: string | null; hasMore: boolean }>>(new Map());
  const activeConversationIdRef = useRef<string | null>(null);

  // ✅ ESTABILIZAR headers com useMemo
  const headers = useMemo(() => {
    try {
      return getHeaders();
    } catch (error) {
      console.error('❌ [useConversationMessages] Erro ao gerar headers:', error);
      return {};
    }
  }, [getHeaders]);

  const clearMessages = useCallback(() => {
    if (debug) {
      console.log('🧹 [useConversationMessages] clearMessages chamado:', {
        timestamp: new Date().toISOString()
      });
    }
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    setCurrentConversationId(null);
    activeConversationIdRef.current = null;
  }, []);

  const loadInitial = useCallback(async (conversationId: string, arg: UseConversationMessagesReturn['loadInitial'] extends (id: any, a?: infer A) => any ? A : any = false) => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;

    const forceRefresh =
      typeof arg === 'boolean' ? arg : (arg?.forceRefresh ?? false);
    const preserveExisting =
      typeof arg === 'boolean' ? false : (arg?.preserveExisting ?? false);

    if (debug) {
      console.log('🔄 [useConversationMessages] loadInitial chamado:', {
        conversationId,
        workspaceId,
        forceRefresh,
        preserveExisting,
        timestamp: new Date().toISOString()
      });
    }

    const cacheKey = `${workspaceId}:${conversationId}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();
    const isCacheValid = cached && now - cached.timestamp <= cacheTtlMs;

    if (!forceRefresh && isCacheValid) {
      setCurrentConversationId(conversationId);
      setMessages(cached.messages);
      setCursorBefore(cached.cursorBefore);
      setHasMore(cached.hasMore);
      activeConversationIdRef.current = conversationId;
      setLoading(false);
      return;
    }
    if (forceRefresh) {
      cacheRef.current.delete(cacheKey);
    }

    setLoading(true);
    setCurrentConversationId(conversationId);
    activeConversationIdRef.current = conversationId;

    // Em refresh "suave" (ex.: voltar foco da aba), evitamos limpar as mensagens
    // para não quebrar o scroll do usuário.
    if (!preserveExisting) {
    setMessages([]);
    setHasMore(true);
    setCursorBefore(null);
    }

    try {
      const { data, error } = await invokeWithTimeout(
        supabase.functions.invoke('whatsapp-get-messages', {
          body: {
            conversation_id: conversationId,
            limit: 30
          },
          headers
        })
      );

      if (error) throw error;

      const newMessages = data?.items || [];
      const normalizedMessages = dedupeAndSortMessages(newMessages);

      // Evitar resposta atrasada sobrescrever outra conversa
      if (activeConversationIdRef.current !== conversationId) {
        if (debug) {
          console.log('⏭️ [useConversationMessages] Ignorando resposta atrasada:', {
            conversationId,
            activeConversationId: activeConversationIdRef.current
          });
        }
        return;
      }
      
      setMessages(normalizedMessages);
      const nextBefore = data?.nextBefore;
      setHasMore(!!nextBefore);
      setCursorBefore(nextBefore || null);

      cacheRef.current.set(cacheKey, {
        messages: normalizedMessages,
        timestamp: Date.now(),
        cursorBefore: nextBefore || null,
        hasMore: !!nextBefore
      });

    } catch (error: any) {
      console.error('❌ [useConversationMessages] Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [cacheTtlMs, debug, headers, selectedWorkspace?.workspace_id]);

  const loadMore = useCallback(async () => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId || !currentConversationId || !cursorBefore || !hasMore) {
      return Promise.resolve();
    }

    if (debug) {
      console.log('🔄 [useConversationMessages] loadMore chamado manualmente:', {
        conversationId: currentConversationId,
        cursorBefore,
        hasMore,
        timestamp: new Date().toISOString()
      });
    }

    setLoadingMore(true);

    try {
      const { data, error } = await invokeWithTimeout(
        supabase.functions.invoke('whatsapp-get-messages', {
          body: {
            conversation_id: currentConversationId,
            limit: 30,
            before: cursorBefore
          },
          headers
        })
      );

      if (error) throw error;

      if (!data?.items || data.items.length === 0) {
        setHasMore(false);
        return;
      }

      const olderMessages = data.items;
      setMessages(prev => dedupeAndSortMessages([...olderMessages, ...prev]));
      
      const nextBefore = data.nextBefore;
      setCursorBefore(nextBefore || null);
      setHasMore(!!nextBefore);
      // Não fazer preload em background por padrão (evita travas). Pode ser reativado via options.
      if (enableBackgroundPreload) {
        // noop: reservado para implementação futura com requestIdleCallback/limites
      }

    } catch (error: any) {
      console.error('❌ [useConversationMessages] Erro no loadMore:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [currentConversationId, cursorBefore, enableBackgroundPreload, hasMore, headers, selectedWorkspace?.workspace_id, debug]);

  const addMessage = useCallback((message: WhatsAppMessage) => {
    if (debug) {
      console.log('➕ [useConversationMessages] addMessage chamado:', {
        messageId: message.id,
        external_id: message.external_id,
        conversationId: message.conversation_id,
        timestamp: new Date().toISOString()
      });
    }

    setMessages(prev => {
      const existsById = prev.some(m => m.id === message.id);
      const existsByExternalId =
        message.external_id && prev.some(m => m.external_id === message.external_id);
      const providerMatchIndex = prev.findIndex(existing => {
        const existingProviderIds = getProviderLinkedIds(existing);
        const incomingProviderIds = getProviderLinkedIds(message);
        const matchesIncomingExternal =
          message.external_id && existingProviderIds.includes(message.external_id);
        const matchesExistingExternal =
          existing.external_id && incomingProviderIds.includes(existing.external_id);
        const sharedProviderId = existingProviderIds.some(providerId =>
          incomingProviderIds.includes(providerId)
        );
        return matchesIncomingExternal || matchesExistingExternal || sharedProviderId;
      });

      if (existsById || existsByExternalId || providerMatchIndex !== -1) {
        if (debug) {
          console.log('⚠️ [useConversationMessages] Mensagem duplicada ignorada:', {
            id: message.id,
            external_id: message.external_id,
            existsById,
            existsByExternalId,
            providerMatchIndex
          });
        }
        return dedupeAndSortMessages([...prev, message]);
      }

      return dedupeAndSortMessages([...prev, message]);
    });
    
    const workspaceId = selectedWorkspace?.workspace_id;
    const convId = currentConversationId;
    if (workspaceId && convId) {
      const cacheKey = `${workspaceId}:${convId}`;
      cacheRef.current.delete(cacheKey);
    }
  }, []); // ✅ ESTÁVEL - lê variáveis dentro da função

  const updateMessage = useCallback((messageId: string, updates: Partial<WhatsAppMessage>) => {
    if (debug) {
      console.log('🔄 [updateMessage] Chamado com:', {
        messageId,
        updates,
        OLD_STATUS: messages.find(m => m.id === messageId || m.external_id === messageId)?.status,
        NEW_STATUS: updates.status,
        delivered_at: updates.delivered_at,
        read_at: updates.read_at,
        timestamp: new Date().toISOString()
      });
    }

    setMessages(prev => {
      const messageIndex = prev.findIndex(m => m.id === messageId || m.external_id === messageId);
      if (messageIndex === -1) {
        if (debug) {
          console.log('⚠️ [updateMessage] Mensagem não encontrada para update:', {
            messageId,
            totalMessages: prev.length,
            availableIds: prev.map(m => ({ id: m.id, external_id: m.external_id }))
          });
        }
        return prev;
      }

      const newMessages = [...prev];
      const oldMessage = newMessages[messageIndex];
      newMessages[messageIndex] = { ...oldMessage, ...updates };

      if (debug) {
        console.log('✅ [updateMessage] Mensagem atualizada no estado:', {
          messageId,
          messageIndex,
          oldStatus: oldMessage.status,
          newStatus: newMessages[messageIndex].status,
          oldDelivered: oldMessage.delivered_at,
          newDelivered: newMessages[messageIndex].delivered_at,
          oldRead: oldMessage.read_at,
          newRead: newMessages[messageIndex].read_at
        });
      }

      if (updates.id && updates.id !== messageId) {
        const workspaceId = selectedWorkspace?.workspace_id;
        const convId = currentConversationId;
        if (workspaceId && convId) {
          const cacheKey = `${workspaceId}:${convId}`;
          cacheRef.current.delete(cacheKey);
        }
      }

      return newMessages;
    });
  }, [messages, selectedWorkspace?.workspace_id, currentConversationId]);

  const removeMessage = useCallback((messageId: string) => {
    console.log('🗑️ [useConversationMessages] removeMessage chamado:', {
      messageId,
      timestamp: new Date().toISOString()
    });
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  // Limpar cache quando workspace muda
  useEffect(() => {
    if (selectedWorkspace?.workspace_id) {
      cacheRef.current.clear();
      console.log('🗑️ Cache limpo devido à mudança de workspace');
    }
  }, [selectedWorkspace?.workspace_id]);

  // Limpar cache antigo periodicamente
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of cacheRef.current.entries()) {
        // Usa o TTL configurado (cacheTtlMs). Mantemos uma margem para não ser agressivo.
        if (now - value.timestamp > cacheTtlMs * 3) {
          cacheRef.current.delete(key);
        }
      }
    }, 30000);

    return () => clearInterval(cleanupInterval);
  }, [cacheTtlMs]);

  // ✅ REALTIME: 1 canal por WORKSPACE (evita "Too many channels")
  useEffect(() => {
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;
    if (typeof window === 'undefined') return;

    // (Re)criar canal global se trocar de workspace
    if (globalMessagesChannelState?.workspaceId && globalMessagesChannelState.workspaceId !== workspaceId) {
      try {
        supabase.removeChannel(globalMessagesChannelState.channel);
      } catch {
        // ignore
      }
      globalMessagesChannelState = null;
    }

    if (!globalMessagesChannelState) {
      const channelName = `messages-workspace-${workspaceId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
            filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
            const message = payload.new as WhatsAppMessage;
            window.dispatchEvent(
              new CustomEvent<RealtimeMessageEventDetail>(REALTIME_MESSAGE_INSERT_EVENT, {
                detail: { workspaceId, message },
              })
            );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
            filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
            const message = payload.new as WhatsAppMessage;
            window.dispatchEvent(
              new CustomEvent<RealtimeMessageEventDetail>(REALTIME_MESSAGE_UPDATE_EVENT, {
                detail: { workspaceId, message },
              })
            );
        }
      )
      .subscribe((status, err) => {
          if (!debug) return;
          console.log('📡 [useConversationMessages] STATUS canal global:', {
          status,
            err,
          channelName,
            workspaceId,
            ts: new Date().toISOString(),
        });
          if (status === 'CHANNEL_ERROR') {
            console.error('❌ [useConversationMessages] ERRO no canal global:', err);
          }
        });

      globalMessagesChannelState = { workspaceId, channel, subscribers: 0 };
    }

    globalMessagesChannelState.subscribers += 1;

    return () => {
      if (!globalMessagesChannelState) return;
      globalMessagesChannelState.subscribers -= 1;
      if (globalMessagesChannelState.subscribers <= 0) {
        try {
          supabase.removeChannel(globalMessagesChannelState.channel);
        } catch {
          // ignore
        }
        globalMessagesChannelState = null;
      }
    };
  }, [selectedWorkspace?.workspace_id, debug]);

  // ✅ Consumir eventos do canal global e aplicar só na conversa ativa
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const workspaceId = selectedWorkspace?.workspace_id;
    if (!workspaceId) return;

    const handleInsert = (evt: Event) => {
      const detail = (evt as CustomEvent<RealtimeMessageEventDetail>).detail;
      if (!detail || detail.workspaceId !== workspaceId) return;
      const newMessage = detail.message;

      // invalidar cache sempre que chega msg nova
      const cacheKey = `${workspaceId}:${newMessage.conversation_id}`;
      cacheRef.current.delete(cacheKey);

      if (!currentConversationId || newMessage.conversation_id !== currentConversationId) return;

      setMessages((prev) => dedupeAndSortMessages([...prev, newMessage]));
    };

    const handleUpdate = (evt: Event) => {
      const detail = (evt as CustomEvent<RealtimeMessageEventDetail>).detail;
      if (!detail || detail.workspaceId !== workspaceId) return;
      const updatedMessage = detail.message;

      const cacheKey = `${workspaceId}:${updatedMessage.conversation_id}`;
      cacheRef.current.delete(cacheKey);

      if (!currentConversationId || updatedMessage.conversation_id !== currentConversationId) return;

      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.id === updatedMessage.id || (m.external_id && m.external_id === updatedMessage.external_id)
        );
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...updatedMessage };
        return next;
      });
    };

    window.addEventListener(REALTIME_MESSAGE_INSERT_EVENT, handleInsert as any);
    window.addEventListener(REALTIME_MESSAGE_UPDATE_EVENT, handleUpdate as any);
    return () => {
      window.removeEventListener(REALTIME_MESSAGE_INSERT_EVENT, handleInsert as any);
      window.removeEventListener(REALTIME_MESSAGE_UPDATE_EVENT, handleUpdate as any);
    };
  }, [selectedWorkspace?.workspace_id, currentConversationId]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadInitial,
    loadMore,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages
  };
}
