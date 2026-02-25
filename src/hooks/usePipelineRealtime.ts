import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PipelineCard, PipelineColumn } from '@/contexts/PipelinesContext';

interface UsePipelineRealtimeProps {
  pipelineId: string | null;
  onCardInsert?: (card: PipelineCard) => void;
  onCardUpdate?: (card: PipelineCard) => void;
  onCardDelete?: (cardId: string) => void;
  onColumnInsert?: (column: PipelineColumn) => void;
  onColumnUpdate?: (column: PipelineColumn) => void;
  onColumnDelete?: (columnId: string) => void;
  onConversationUpdate?: (conversationId: string, updates: any) => void;
}

export function usePipelineRealtime({
  pipelineId,
  onCardInsert,
  onCardUpdate,
  onCardDelete,
  onColumnInsert,
  onColumnUpdate,
  onColumnDelete,
  onConversationUpdate,
}: UsePipelineRealtimeProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!pipelineId) {
      return;
    }

    // Limpar conexão anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Limpar timeout de reconexão se existir
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Canal único e estável para este pipeline
    const channelName = `pipeline-${pipelineId}`;

    // Criar canal com configurações otimizadas
    const channel: RealtimeChannel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false }, // Não receber próprios eventos
          presence: { key: '' },
        },
      })
      // Broadcasts personalizados para contornar casos onde eventos do DB não chegam por RLS
      .on('broadcast', { event: 'pipeline-card-moved' }, (payload: any) => {
        try {
          const { cardId, newColumnId } = payload?.payload || {};
          if (!cardId || !newColumnId) return;

          if (onCardUpdate) {
            // Enviar um objeto mínimo; o handler no contexto mescla com dados existentes
            const minimalUpdate: any = { id: cardId, column_id: newColumnId };
            onCardUpdate(minimalUpdate as PipelineCard);
          }
        } catch (err) {
          console.error('❌ [Realtime][Broadcast] Erro ao processar pipeline-card-moved:', err);
        }
      })
      .on('broadcast', { event: 'conversation-agent-updated' }, (payload: any) => {
        try {
          const { conversationId, agente_ativo, agent_active_id } = payload?.payload || {};
          
          if (!conversationId) return;

          if (onConversationUpdate) {
            onConversationUpdate(conversationId, {
              agente_ativo,
              agent_active_id,
            });
          }
        } catch (err) {
          console.error('❌ [Realtime][Broadcast] Erro ao processar conversation-agent-updated:', err);
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          onCardInsert?.(payload.new as PipelineCard);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          const cardUpdate = payload.new as PipelineCard;
          
          if (onCardUpdate) {
            try {
              onCardUpdate(cardUpdate);
            } catch (error) {
              console.error('❌ [Realtime] Erro ao executar onCardUpdate:', error);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pipeline_cards',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          onCardDelete?.(payload.old.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          onColumnInsert?.(payload.new as PipelineColumn);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          onColumnUpdate?.(payload.new as PipelineColumn);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pipeline_columns',
          filter: `pipeline_id=eq.${pipelineId}`,
        },
        (payload) => {
          onColumnDelete?.(payload.old.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          const updated = payload.new as any;
          
          if (onConversationUpdate) {
            onConversationUpdate(updated.id, {
              agente_ativo: updated.agente_ativo,
              agent_active_id: updated.agent_active_id,
            });
          }
        }
      )
      // Escutar mudanças em tags de contato
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contact_tags',
        },
        async (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Força refresh dos cards para atualizar tags
          // Precisamos encontrar cards relacionados a este contato
          const contactId = newData?.contact_id || oldData?.contact_id;
          if (contactId && onCardUpdate) {
            // Enviar um sinal de "refresh" para o card
            // O card irá buscar as tags atualizadas
            onCardUpdate({ id: `refresh-contact-${contactId}`, _refresh: true } as any);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0; // Reset contador de tentativas
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Erro no canal:', err);
          
          // Tentar reconectar após 3 segundos
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000); // Max 30s
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Forçar recriação do efeito removendo o canal
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            // O useEffect será executado novamente
          }, delay);
        } else if (status === 'TIMED_OUT') {
          // Tentar reconectar
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(3000 * reconnectAttemptsRef.current, 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }, delay);
        }
      });

    // Armazenar referência do canal
    channelRef.current = channel;

    // Cleanup: desconectar ao desmontar
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    pipelineId,
    onCardInsert,
    onCardUpdate,
    onCardDelete,
    onColumnInsert,
    onColumnUpdate,
    onColumnDelete,
    onConversationUpdate
  ]);
}
