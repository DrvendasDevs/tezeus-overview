import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueues } from '@/hooks/useQueues';

interface EndConversationButtonProps {
  conversation: WhatsAppConversation;
  className?: string;
}

export function EndConversationButton({ conversation, className }: EndConversationButtonProps) {
  // Só mostra o botão se assigned_user_id for preenchido (conversa foi aceita)
  if (conversation.assigned_user_id === null) {
    return null;
  }

  const { queues } = useQueues();

  const filaNome = useMemo(() => {
    if (!conversation.queue_id) {
      return null;
    }

    return queues.find(queue => queue.id === conversation.queue_id)?.name ?? null;
  }, [queues, conversation.queue_id]);

  const conexaoLabel = useMemo(() => {
    if (conversation.connection?.instance_name) {
      return conversation.connection.instance_name;
    }

    if (conversation.connection?.phone_number) {
      return conversation.connection.phone_number;
    }

    return conversation.connection_id ?? null;
  }, [
    conversation.connection?.instance_name,
    conversation.connection?.phone_number,
    conversation.connection_id
  ]);

  const tooltipLines = [
    filaNome ? `Fila: ${filaNome}` : 'Sem fila atribuída',
    conexaoLabel ? `Conexão: ${conexaoLabel}` : null
  ].filter(Boolean);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Button
            disabled
            size="sm"
            className={cn(
              'gap-2 bg-muted text-muted-foreground border border-muted-foreground/30 cursor-not-allowed',
              className
            )}
            variant="outline"
          >
            Conversa aceita
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex flex-col gap-1">
            {tooltipLines.map(line => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}