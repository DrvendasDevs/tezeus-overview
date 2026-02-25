import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, Clock, User, ArrowRightLeft, Power, PowerOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface AgentHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

const actionIcons = {
  activated: <Power className="h-4 w-4 text-green-500" />,
  deactivated: <PowerOff className="h-4 w-4 text-red-500" />,
  changed: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
};

const actionLabels = {
  activated: 'Agente ativado',
  deactivated: 'Agente desativado',
  changed: 'Agente alterado',
};

const actionColors = {
  activated: 'bg-green-500/10 text-green-700 dark:text-green-400',
  deactivated: 'bg-red-500/10 text-red-700 dark:text-red-400',
  changed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

export function AgentHistoryModal({ isOpen, onOpenChange, conversationId }: AgentHistoryModalProps) {
  const { data: history, isLoading } = useAgentHistory(conversationId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Agentes
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="mt-1">
                    {actionIcons[entry.action]}
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={actionColors[entry.action]}>
                        {actionLabels[entry.action]}
                      </Badge>
                      
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        <span className="font-medium text-foreground">{entry.agent_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>

                      {entry.changed_by && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Por usuário</span>
                        </div>
                      )}
                    </div>

                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum histórico de agentes encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                As mudanças de agentes serão registradas aqui
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
