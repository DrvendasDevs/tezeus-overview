import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConversationAssignments } from "@/hooks/useConversationAssignments";
import { useAgentHistory } from "@/hooks/useAgentHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { UserCircle, ArrowRight, UserPlus, Clock, Bot, Power, PowerOff, ArrowRightLeft, User, UserMinus, GitBranch } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

interface AssignmentHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

const assignmentActionConfig: Record<string, {
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
}> = {
  accept: {
    icon: <UserPlus className="h-4 w-4 text-blue-500" />,
    label: 'Aceito manualmente',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  assign: {
    icon: <UserPlus className="h-4 w-4 text-blue-500" />,
    label: 'Atribuído',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  transfer: {
    icon: <ArrowRight className="h-4 w-4 text-orange-500" />,
    label: 'Transferido',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  },
  queue_transfer: {
    icon: <ArrowRightLeft className="h-4 w-4 text-purple-500" />,
    label: 'Transferência de fila',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  },
  unassign: {
    icon: <UserMinus className="h-4 w-4 text-red-500" />,
    label: 'Responsável removido',
    badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-400',
  },
};

const agentActionIcons = {
  activated: <Power className="h-4 w-4 text-green-500" />,
  deactivated: <PowerOff className="h-4 w-4 text-red-500" />,
  changed: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
};

const agentActionLabels = {
  activated: 'Agente ativado',
  deactivated: 'Agente desativado',
  changed: 'Agente alterado',
};

const agentActionColors = {
  activated: 'bg-green-500/10 text-green-700 dark:text-green-400',
  deactivated: 'bg-red-500/10 text-red-700 dark:text-red-400',
  changed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

type AgentActionKey = keyof typeof agentActionLabels;

const normalizeAgentId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return value ? String(value) : null;
};

const resolveAgentDisplayAction = (agent: any): AgentActionKey => {
  if (agent?.action === 'changed') {
    const previousAgentId = normalizeAgentId(agent?.metadata?.old_agent_id);
    if (!previousAgentId) {
      return 'activated';
    }
  }
  return (agent?.action ?? 'activated') as AgentActionKey;
};

export function AssignmentHistoryModal({
  isOpen,
  onOpenChange,
  conversationId,
}: AssignmentHistoryModalProps) {
  const queryClient = useQueryClient();
  
  // Só buscar dados quando o modal estiver aberto e conversationId for válido
  const shouldFetch = isOpen && conversationId && conversationId.trim() !== '';
  
  const { data: assignments, isLoading: assignmentsLoading, error: assignmentsError } = useConversationAssignments(shouldFetch ? conversationId : undefined);
  const { data: agentHistory, isLoading: agentLoading, error: agentError } = useAgentHistory(shouldFetch ? conversationId : undefined);

  // Invalidar queries quando o modal abrir para garantir dados atualizados
  React.useEffect(() => {
    if (isOpen && conversationId && conversationId.trim() !== '') {
      queryClient.invalidateQueries({ queryKey: ['conversation-assignments', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['agent-history', conversationId] });
    }
  }, [isOpen, conversationId, queryClient]);

  // Log para debug
  React.useEffect(() => {
    if (isOpen && conversationId) {
      console.log('🔍 AssignmentHistoryModal - Buscando histórico:', {
        conversationId,
        assignmentsCount: assignments?.length ?? 0,
        agentHistoryCount: agentHistory?.length ?? 0,
        assignmentsError,
        agentError,
        shouldFetch
      });
    }
  }, [isOpen, conversationId, assignments, agentHistory, assignmentsError, agentError, shouldFetch]);

  // Combinar e ordenar ambos os históricos por data
  const combinedHistory = React.useMemo(() => {
    const combined: Array<{ type: 'assignment' | 'agent', data: any, timestamp: string }> = [];
    
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(a => combined.push({ 
        type: 'assignment', 
        data: a, 
        timestamp: a.changed_at 
      }));
    }
    
    if (agentHistory && Array.isArray(agentHistory)) {
      agentHistory.forEach(h => combined.push({ type: 'agent', data: h, timestamp: h.created_at }));
    }
    
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [assignments, agentHistory]);

  const isLoading = assignmentsLoading || agentLoading;
  const hasError = assignmentsError || agentError;
  const isValidConversationId = conversationId && conversationId.trim() !== '';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 border border-[#d4d4d4] bg-white shadow-sm rounded-none dark:bg-[#1f1f1f] dark:border-gray-700">
        <DialogHeader className="bg-primary text-white p-4 m-0 rounded-none border-b border-[#d4d4d4] dark:border-gray-700 dark:bg-transparent">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Clock className="h-5 w-5" />
            Histórico de Agentes e Transferências
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] bg-white dark:bg-[#1f1f1f]">
          <div className="p-4">
          {!isValidConversationId ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-gray-300 mb-4 dark:text-gray-600" />
              <p className="text-gray-500 font-medium dark:text-gray-400">ID de conversa inválido</p>
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                Não foi possível carregar o histórico sem um ID de conversa válido
              </p>
            </div>
          ) : hasError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-red-300 mb-4 dark:text-red-600" />
              <p className="text-red-500 font-medium dark:text-red-400">Erro ao carregar histórico</p>
              <p className="text-xs text-red-400 mt-1 dark:text-red-500">
                {assignmentsError?.message || agentError?.message || 'Ocorreu um erro ao buscar o histórico'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-4 border border-[#d4d4d4] rounded-none bg-gray-50 dark:bg-[#2d2d2d] dark:border-gray-600">
                  <Skeleton className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700" />
                    <Skeleton className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : combinedHistory && combinedHistory.length > 0 ? (
            <div className="space-y-4">
              {combinedHistory.map((entry, index) => {
                if (entry.type === 'assignment') {
                  const assignment = entry.data;
                  const assignmentConfig = assignmentActionConfig[assignment.action] ?? {
                    icon: <UserCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />,
                    label: assignment.action ?? 'Ação desconhecida',
                    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
                  };
                  const fromUserName = assignment.from_user_name || 'Não atribuído';
                  const toUserName = assignment.to_user_name || 'Não atribuído';
                  const fromQueueName = assignment.from_queue_name || 'Sem fila';
                  const toQueueName = assignment.to_queue_name || 'Sem fila';
                  const isQueueTransfer = assignment.action === 'queue_transfer';
                  return (
                    <div
                      key={`assignment-${assignment.id}`}
                      className="flex items-start gap-4 p-4 rounded-none border border-[#d4d4d4] bg-white hover:bg-gray-50 transition-colors shadow-none dark:bg-[#2d2d2d] dark:border-gray-600 dark:hover:bg-[#333]"
                    >
                      <div className="mt-1">
                        {assignmentConfig.icon}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`rounded-none border text-xs font-medium ${assignmentConfig.badgeClass}`}>
                            {assignmentConfig.label}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                            {isQueueTransfer ? (
                              <GitBranch className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                            <span>
                              {isQueueTransfer ? 'da fila ' : 'de '}
                              <span className="font-bold text-gray-900 dark:text-white">
                                {isQueueTransfer ? fromQueueName : fromUserName}
                              </span>
                            </span>
                            <ArrowRight className="h-3 w-3 mx-1" />
                            <span>
                              {isQueueTransfer ? 'para a fila ' : 'para '}
                              <span className="font-bold text-gray-900 dark:text-white">
                                {isQueueTransfer ? toQueueName : toUserName}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(assignment.changed_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {assignment.changed_by_name && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Por {assignment.changed_by_name}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-400 font-medium dark:text-gray-500">
                        {new Date(assignment.changed_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  );
                } else {
                  const agent = entry.data;
                  const displayAction = resolveAgentDisplayAction(agent);
                  return (
                    <div
                      key={`agent-${agent.id}`}
                      className="flex items-start gap-4 p-4 rounded-none border border-[#d4d4d4] bg-white hover:bg-gray-50 transition-colors shadow-none dark:bg-[#2d2d2d] dark:border-gray-600 dark:hover:bg-[#333]"
                    >
                      <div className="mt-1">
                        {agentActionIcons[displayAction]}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`rounded-none border text-xs font-medium ${agentActionColors[displayAction]}`}>
                            {agentActionLabels[displayAction]}
                          </Badge>
                          
                          <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                            <Bot className="h-3 w-3" />
                            <span className="font-bold text-gray-900 dark:text-white">{agent.agent_name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-gray-500 font-medium dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(agent.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>

                          {agent.changed_by && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>Por usuário</span>
                            </div>
                          )}
                        </div>

                        {agent.metadata && agent.metadata.old_agent_name ? (
                          <div className="text-[10px] text-gray-600 mt-1 flex items-center gap-1 dark:text-gray-400">
                             <span className="text-gray-400 dark:text-gray-500">Agente anterior:</span>
                             <span className="font-medium text-gray-800 dark:text-gray-300">{agent.metadata.old_agent_name}</span>
                          </div>
                        ) : (
                          agent.metadata && Object.keys(agent.metadata).length > 0 && 
                          !(agent.metadata.old_agent_id === null && Object.keys(agent.metadata).length === 1) && (
                            <div className="text-[10px] text-gray-600 bg-gray-50 border border-[#d4d4d4] p-2 rounded-none font-mono mt-1 dark:bg-[#1f1f1f] dark:border-gray-600 dark:text-gray-400">
                              {JSON.stringify(agent.metadata, null, 2)}
                            </div>
                          )
                        )}
                      </div>

                      <div className="text-[10px] text-gray-400 font-medium dark:text-gray-500">
                        {new Date(agent.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-gray-300 mb-4 dark:text-gray-600" />
              <p className="text-gray-500 font-medium dark:text-gray-400">Nenhum histórico encontrado</p>
              <p className="text-xs text-gray-400 mt-1 dark:text-gray-500">
                As mudanças de agentes e transferências serão registradas aqui
              </p>
            </div>
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
