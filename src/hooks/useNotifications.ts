import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from './useAuth';
import { useNotificationSound } from './useNotificationSound';

export interface NotificationMessage {
  id: string;
  messageId: string | null;
  conversationId: string;
  contactId: string;
  contactName: string;
  content: string;
  messageType: string;
  senderType: 'contact' | 'agent' | 'ia' | 'system' | 'user' | string;
  timestamp: Date;
  isMedia: boolean;
  status: 'unread' | 'read';
  unreadCount?: number; // quantidade de mensagens não lidas desta conversa
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const { selectedWorkspace } = useWorkspace();
  const { user, hasRole } = useAuth();
  const { playNotificationSound } = useNotificationSound();
  const canViewAllNotifications = hasRole(['master', 'admin']);
  const isMaster = hasRole(['master']);
  const activeConversationIdRef = useRef<string | null>(null);

  // Buscar notificações
  const fetchNotifications = useCallback(async () => {
    if (!selectedWorkspace?.workspace_id || !user?.id) {
      return;
    }

    try {
      // Buscar notificações com join em conversations
      let query = supabase
        .from('notifications')
        .select(`
          *,
          conversations!inner(assigned_user_id, unread_count, status)
        `)
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('status', 'unread');

      if (!canViewAllNotifications && user?.id) {
        // Usuários comuns enxergam apenas notificações destinadas a eles
        query = query.or([
          `user_id.eq.${user.id}`,
          `user_id.is.null`
        ].join(','));
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const filteredData = (data || []).filter((notif: any) => {
        if (canViewAllNotifications) {
          return true;
        }

        const notificationUserId = notif.user_id ?? null;
        if (notificationUserId && notificationUserId !== user?.id) {
          return false;
        }

        // Notificações legadas sem user_id: permitir apenas se conversa está sem responsável ou atribuída ao usuário atual
        if (!notificationUserId) {
          const assignedUserId = notif.conversations?.assigned_user_id ?? null;
          if (assignedUserId && assignedUserId !== user?.id) {
            return false;
          }
        }

        return true;
      });

      const staleNotificationIds: string[] = [];
      const messageUsage = new Set<string>();

      const sanitizedNotifications = filteredData.filter((notif: any) => {
        const conv = notif.conversations;
        if (!conv) {
          staleNotificationIds.push(notif.id);
          return false;
        }

        const conversationId = notif.conversation_id;
        const status = (conv.status || '').toLowerCase();
        const isConversationClosed = ['closed', 'archived'].includes(status);

        // ✅ Não usar unread_count para invalidar notificação (IA/N8n pode alterar esse campo)
        if (isConversationClosed) {
          staleNotificationIds.push(notif.id);
          return false;
        }

        // ✅ Evitar notificações duplicadas para a mesma mensagem
        const messageId = notif.message_id;
        if (messageId) {
          if (messageUsage.has(messageId)) {
            staleNotificationIds.push(notif.id);
            return false;
          }
          messageUsage.add(messageId);
        }
        return true;
      });

      if (staleNotificationIds.length > 0) {
        try {
          await supabase
            .from('notifications')
            .update({
              status: 'read',
              read_at: new Date().toISOString()
            })
            .in('id', staleNotificationIds);
        } catch (cleanupError) {
          console.error('⚠️ [useNotifications] Falha ao limpar notificações obsoletas:', cleanupError);
        }
      }

      const formattedNotifications: NotificationMessage[] = sanitizedNotifications.map((notif: any) => ({
        id: notif.id,
        messageId: notif.message_id || null,
        conversationId: notif.conversation_id,
        contactId: notif.contact_id,
        contactName: notif.title,
        content: notif.content,
        messageType: notif.message_type,
        senderType: notif.sender_type || 'contact',
        timestamp: new Date(notif.created_at),
        isMedia: ['image', 'video', 'audio', 'document'].includes(notif.message_type),
        status: notif.status as 'unread' | 'read',
      }));

      const receivedNotifications = formattedNotifications.filter(
        (notif) => notif.senderType === 'contact'
      );

      // ✅ Agrupar por conversa:
      // - contador = quantidade de notificações (1 por mensagem não lida)
      // - item exibido = última notificação (mais recente) daquela conversa
      const byConversation = new Map<string, { count: number; latest: NotificationMessage }>();
      for (const notif of receivedNotifications) {
        const prev = byConversation.get(notif.conversationId);
        if (!prev) {
          byConversation.set(notif.conversationId, { count: 1, latest: notif });
          continue;
        }
        prev.count += 1;
        // Como a query vem ordenada por created_at desc, o primeiro é o mais recente.
        // Mesmo assim, garantimos pelo timestamp.
        if (notif.timestamp > prev.latest.timestamp) {
          prev.latest = notif;
        }
      }

      const grouped = Array.from(byConversation.values()).map(({ count, latest }) => ({
        ...latest,
        unreadCount: count,
      }));

      // Ordena por mais recente
      grouped.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setNotifications(grouped);
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao buscar notificações:', err);
    }
  }, [canViewAllNotifications, playNotificationSound, selectedWorkspace?.workspace_id, user?.id]);

  // Carregar notificações iniciais
  useEffect(() => {
    fetchNotifications();
  }, [selectedWorkspace?.workspace_id, user?.id]);

  // ✅ Track de conversa ativa (pra não notificar quando o usuário está com a conversa aberta)
  useEffect(() => {
    const handler = (ev: any) => {
      activeConversationIdRef.current = ev?.detail?.conversationId ?? null;
    };
    window.addEventListener('active-conversation-changed', handler as any);
    return () => window.removeEventListener('active-conversation-changed', handler as any);
  }, []);

  // ✅ REALTIME baseado em MESSAGES (quando chega mensagem do contato, atualiza o sino em tempo real)
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id || !user?.id) return;
    const workspaceId = selectedWorkspace.workspace_id;

    const channel = supabase
      .channel(`notifications-messages-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;

          // Só notificar/atualizar sino para mensagem recebida do contato
          if (String(row.sender_type || '').toLowerCase() !== 'contact') return;

          const conversationId = row.conversation_id as string | undefined;
          if (!conversationId) return;

          // Se a conversa está ativa e a aba está visível, o WhatsAppChat vai marcar como lida.
          // Então evitamos "piscar" notificação.
          if (
            activeConversationIdRef.current === conversationId &&
            document.visibilityState === 'visible'
          ) {
            return;
          }

          try {
            window.dispatchEvent(
              new CustomEvent('new-contact-message', { detail: { conversationId } })
            );
          } catch {}

          // Recarrega notificações imediatamente (sininho em realtime)
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, selectedWorkspace?.workspace_id, user?.id]);

  // Real-time subscription com filtros nativos do Supabase
  useEffect(() => {
    if (!selectedWorkspace?.workspace_id || !user?.id) {
      return;
    }

    const workspaceId = selectedWorkspace.workspace_id;
    const userId = user.id;
    
    const channel = supabase
      .channel(`notifications-${workspaceId}-${userId}`) // ✅ Canal único por user+workspace
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}` // ✅ Filtro nativo
        },
        (payload: any) => {
          // ✅ Para admin/master: qualquer notificação do workspace
          // ✅ Para user: notificações dele OU sem user_id (sem responsável)
          const newUserId = payload?.new?.user_id ?? null;
          const shouldFetch =
            canViewAllNotifications ||
            newUserId === userId ||
            newUserId === null;

          if (shouldFetch) {
            playNotificationSound();
            fetchNotifications();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `workspace_id=eq.${workspaceId}` // ✅ Filtro nativo
        },
        (payload: any) => {
          const newUserId = payload?.new?.user_id ?? null;
          const oldUserId = payload?.old?.user_id ?? null;
          const shouldFetch =
            canViewAllNotifications ||
            newUserId === userId ||
            oldUserId === userId ||
            newUserId === null ||
            oldUserId === null;

          if (shouldFetch) {
            fetchNotifications();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [useNotifications] ERRO no canal de notificações');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedWorkspace?.workspace_id, user?.id, canViewAllNotifications, fetchNotifications]);

  // Marcar conversa como lida
  const markContactAsRead = async (conversationId: string) => {
    if (!user?.id || !selectedWorkspace?.workspace_id || isMaster) {
      return;
    }

    try {
      // Atualização otimista imediata para refletir no sino e nos cards
      setNotifications(prev => prev.filter(n => n.conversationId !== conversationId));
      // Disparar evento global opcional (para outros componentes ouvirem, se necessário)
      try { window.dispatchEvent(new CustomEvent('conversation-read', { detail: { conversationId } })); } catch {}

      let query = supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('conversation_id', conversationId)
        .eq('status', 'unread');

      // ✅ Admin consegue limpar tudo que ele está visualizando
      // ✅ User limpa notificações dele OU sem responsável (user_id null)
      if (!canViewAllNotifications) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { error } = await query;

      if (error) throw error;
      
      // Refetch para sincronizar com o backend (em background)
      fetchNotifications();
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao marcar como lida:', err);
      // Se falhar, re-sincroniza (para não ficar "sumido" apenas no otimista)
      fetchNotifications();
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!user?.id || !selectedWorkspace?.workspace_id || isMaster) {
      return;
    }

    try {
      // Disparar evento global para zerar unread_count/messages (WhatsAppChat ou outros listeners)
      try {
        const conversationIds = Array.from(new Set(notifications.map((n) => n.conversationId)));
        window.dispatchEvent(new CustomEvent('conversations-read-all', { detail: { conversationIds } }));
      } catch {}

      // Otimista: limpa o sino imediatamente
      setNotifications([]);

      let query = supabase
        .from('notifications')
        .update({ 
          status: 'read',
          read_at: new Date().toISOString(),
        })
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('status', 'unread');

      // ✅ Admin limpa tudo que ele vê; user limpa dele + sem responsável
      if (!canViewAllNotifications) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { error } = await query;

      if (error) throw error;

      await fetchNotifications();
    } catch (err) {
      console.error('❌ [useNotifications] Erro ao marcar todas como lidas:', err);
      // rollback/sync
      fetchNotifications();
    }
  };

  // Utilitários
  const getAvatarInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  return {
    notifications,
    totalUnread: notifications.reduce((acc, n) => acc + (n.unreadCount || 0), 0),
    markContactAsRead,
    markAllAsRead,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp
  };
}
