import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useQueues } from "@/hooks/useQueues";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface TransferirModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  selectedCards: string[];
  currentPipelineId: string;
  currentPipelineName: string;
  onTransferComplete: () => void;
}

export function TransferirModal({ 
  isOpen, 
  onClose, 
  isDarkMode = false,
  selectedCards,
  currentPipelineId,
  currentPipelineName,
  onTransferComplete
}: TransferirModalProps) {
  const [targetPipelineId, setTargetPipelineId] = useState("");
  const [targetColumnId, setTargetColumnId] = useState("");
  const [targetColumns, setTargetColumns] = useState<any[]>([]);
  const [targetQueueId, setTargetQueueId] = useState<string>("none");
  const [targetResponsibleId, setTargetResponsibleId] = useState<string>("none");
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const didAutoTransferRef = useRef(false);
  
  // Lógica de desabilitação: se fila selecionada (não "none"), desabilitar responsável e vice-versa
  const isQueueDisabled = !!targetResponsibleId && targetResponsibleId !== "" && targetResponsibleId !== "none";
  const isResponsibleDisabled = !!targetQueueId && targetQueueId !== "" && targetQueueId !== "none" && targetQueueId !== "remove";

  // Quando seleciona uma fila válida, limpa o responsável para aplicar as regras da fila
  useEffect(() => {
    if (targetQueueId && targetQueueId !== "" && targetQueueId !== "none" && targetQueueId !== "remove") {
      console.log('🔄 Fila selecionada, limpando responsável para aplicar regras da fila');
      setTargetResponsibleId("none");
    }
  }, [targetQueueId]);
  
  const { pipelines } = usePipelinesContext();
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  // Incluir todas as filas do workspace (ativas e inativas)
  const { queues } = useQueues(selectedWorkspace?.workspace_id, true);

  // Fetch workspace users
  useEffect(() => {
    if (isOpen && selectedWorkspace?.workspace_id) {
      fetchWorkspaceUsers();
    }
  }, [isOpen, selectedWorkspace?.workspace_id]);

  // Reset de auto-transfer a cada abertura do modal
  useEffect(() => {
    if (isOpen) {
      didAutoTransferRef.current = false;
    }
  }, [isOpen]);

  // Fetch columns when pipeline changes
  useEffect(() => {
    if (targetPipelineId) {
      fetchColumns(targetPipelineId);
    } else {
      setTargetColumns([]);
      setTargetColumnId("");
    }
  }, [targetPipelineId]);

  // ✅ Transferir automaticamente ao selecionar Pipeline + Etapa (sem precisar clicar no botão)
  useEffect(() => {
    if (!isOpen) return;
    if (isLoading) return;
    if (!targetPipelineId || !targetColumnId) return;
    if (selectedCards.length === 0) return;
    if (didAutoTransferRef.current) return;

    didAutoTransferRef.current = true;
    // fire-and-forget (o handleTransfer já fecha modal e chama refresh)
    void handleTransfer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoading, targetPipelineId, targetColumnId, selectedCards.length]);

  const fetchWorkspaceUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'manage-system-user',
        {
          body: {
            action: 'list',
            userData: {}
          }
        }
      );

      if (error) {
        console.error('Error fetching workspace users:', error);
        return;
      }
      
      if (data?.error) {
        console.error('Error from edge function:', data.error);
        return;
      }

      if (!data?.success) {
        console.error('Invalid response from server');
        return;
      }

      // Filter only users from current workspace
      const allUsers = data.data || [];
      const users = allUsers.filter((user: any) => 
        user.workspaces?.some((ws: any) => 
          ws.id === selectedWorkspace?.workspace_id
        )
      );
      
      console.log('✅ Loaded workspace users:', users.length);
      setWorkspaceUsers(users);
    } catch (error) {
      console.error('Error fetching workspace users:', error);
    }
  };

  const fetchColumns = async (pipelineId: string) => {
    try {
      const headers = getHeaders();
      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/columns?pipeline_id=${pipelineId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (error) throw error;
      setTargetColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas do pipeline de destino",
        variant: "destructive",
      });
    }
  };

  const handleTransfer = async () => {
    if (!targetPipelineId || !targetColumnId) {
      toast({
        title: "Atenção",
        description: "Selecione o pipeline e a etapa de destino",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Buscar detalhes da fila se selecionada, para aplicar suas regras
      let queueDetails = null;
      if (targetQueueId) {
        const { data: queueData } = await supabase
          .from('queues')
          .select('*, ai_agent:ai_agents(id, name)')
          .eq('id', targetQueueId)
          .single();
        
        queueDetails = queueData;
        console.log('🔍 Detalhes da fila selecionada:', queueDetails);
      }

      // Transfer each selected card
      for (const cardId of selectedCards) {
        try {
          // Buscar o card para obter conversation_id
          const { data: cardData } = await supabase
            .from('pipeline_cards')
            .select('conversation_id')
            .eq('id', cardId)
            .single();

          const updateBody: any = {
            pipeline_id: targetPipelineId,
            column_id: targetColumnId,
          };

          // Aplicar queue_id e responsible_user_id baseado na seleção
          if (targetQueueId === "remove") {
            updateBody.queue_id = null; // Remove fila
          } else if (targetQueueId && targetQueueId !== "" && targetQueueId !== "none") {
            updateBody.queue_id = targetQueueId; // Atribui fila
          }
          // Se "none" ou vazio, não altera nada
          
          if (targetResponsibleId === "remove") {
            updateBody.responsible_user_id = null; // Remove responsável
          } else if (targetResponsibleId && targetResponsibleId !== "" && targetResponsibleId !== "none") {
            updateBody.responsible_user_id = targetResponsibleId; // Atribui responsável
          }
          // Se "none" ou vazio, não altera nada

          const { error } = await supabase.functions.invoke(
            `pipeline-management/cards?id=${cardId}`,
            {
              method: 'PUT',
              headers,
              body: updateBody,
            }
          );

          if (error) {
            errorCount++;
            // Check if it's a duplicate constraint error
            if (error.message?.includes('idx_unique_contact_pipeline_open')) {
              errors.push('Um ou mais contatos já possuem negócios abertos no pipeline de destino');
            } else {
              throw error;
            }
          } else {
            successCount++;

            // Aplicar regras à conversa se houver conversation_id
            if (cardData?.conversation_id) {
              try {
                // Se tem fila selecionada (não "none", não vazia e não "remove"), aplicar suas regras
                if (targetQueueId && targetQueueId !== "" && targetQueueId !== "none" && targetQueueId !== "remove") {
                  console.log(`🔧 Aplicando regras da fila "${queueDetails?.name}" à conversa ${cardData.conversation_id}`);
                  console.log(`🤖 Agente da fila: ${queueDetails?.ai_agent_id} (${queueDetails?.ai_agent?.name})`);
                  console.log(`📋 Tipo de distribuição: ${queueDetails?.distribution_type}`);
                  
                  // Primeiro: Atualizar fila e remover responsável atual (será redistribuído pela fila)
                  const updateBody: any = {
                    conversation_id: cardData.conversation_id,
                    queue_id: targetQueueId,
                    assigned_user_id: null, // Remover responsável para aplicar distribuição
                    activate_queue_agent: true
                  };

                  console.log('📤 Chamando update-conversation-queue para atualizar fila e remover responsável:', JSON.stringify(updateBody, null, 2));
                  
                  const { data: updateResult, error: updateError } = await supabase.functions.invoke(
                    'update-conversation-queue',
                    {
                      body: updateBody,
                      headers: {
                        'x-force-queue-history': 'true',  // Forçar registro mesmo se fila não mudou na conversa
                        'x-system-user-id': selectedWorkspace?.workspace_id || ''
                      }
                    }
                  );
                  
                  console.log('📥 Resposta de update-conversation-queue:', { data: updateResult, error: updateError });

                  if (updateError) {
                    console.error('❌ Erro ao atualizar fila/agente da conversa:', updateError);
                    toast({
                      title: "Aviso",
                      description: "Negócio transferido, mas não foi possível atualizar a fila na conversa",
                      variant: "default",
                    });
                  } else {
                    console.log('✅ Fila e agente atualizados, responsável removido');
                    
                    // Segundo: Aplicar distribuição da fila (se houver distribuição configurada)
                    if (queueDetails?.distribution_type && queueDetails.distribution_type !== 'nao_distribuir') {
                      console.log(`🔄 Aplicando distribuição automática da fila (tipo: ${queueDetails.distribution_type})`);
                      
                      try {
                        const { data: distributionData, error: distributionError } = await supabase.functions.invoke(
                          'assign-conversation-to-queue',
                          {
                            body: {
                              conversation_id: cardData.conversation_id,
                              queue_id: targetQueueId,
                            },
                            headers
                          }
                        );

                        if (distributionError) {
                          console.error('⚠️ Erro na distribuição automática:', distributionError);
                          toast({
                            title: "Aviso",
                            description: "Fila atualizada, mas não foi possível distribuir automaticamente",
                            variant: "default",
                          });
                        } else {
                          console.log('✅ Conversa distribuída segundo regras da fila:', distributionData);
                          
                          // Atualizar responsible_user_id no card se houver usuário atribuído
                          if (distributionData?.assigned_user_id) {
                            await supabase.functions.invoke(
                              `pipeline-management/cards?id=${cardId}`,
                              {
                                method: 'PUT',
                                headers,
                                body: {
                                  responsible_user_id: distributionData.assigned_user_id
                                },
                              }
                            );
                            console.log(`✅ Responsável ${distributionData.assigned_user_id} atribuído ao card`);
                          }
                        }
                      } catch (distError) {
                        console.error('⚠️ Exceção na distribuição automática:', distError);
                      }
                    } else {
                      console.log('⏭️ Fila não distribui automaticamente, conversa fica sem responsável');
                    }
                  }
                } else if (targetResponsibleId && targetResponsibleId !== "" && targetResponsibleId !== "none" && targetResponsibleId !== "remove") {
                  // Tem responsável selecionado (não "remove" e não "none") mas não tem fila - apenas atualizar responsável
                  console.log(`👤 Atualizando apenas responsável da conversa ${cardData.conversation_id}`);
                  
                  const { data: updateUserResult, error: updateUserError } = await supabase.functions.invoke(
                    'update-conversation-queue',
                    {
                      body: {
                        conversation_id: cardData.conversation_id,
                        assigned_user_id: targetResponsibleId
                      }
                    }
                  );

                  if (updateUserError) {
                    console.error('❌ Erro ao atualizar responsável da conversa:', updateUserError);
                  } else {
                    console.log('✅ Responsável atualizado na conversa:', updateUserResult);
                  }
                } else if (targetQueueId === "remove" || targetResponsibleId === "remove") {
                  // Remover fila e/ou responsável da conversa
                  console.log(`🗑️ Removendo fila/responsável da conversa ${cardData.conversation_id}`);
                  
                  const removeBody: any = {
                    conversation_id: cardData.conversation_id
                  };
                  
                  if (targetQueueId === "remove") {
                    removeBody.queue_id = null;
                    removeBody.activate_queue_agent = false;
                  }
                  
                  if (targetResponsibleId === "remove") {
                    removeBody.assigned_user_id = null;
                  }
                  
                  const { data: removeResult, error: removeError } = await supabase.functions.invoke(
                    'update-conversation-queue',
                    {
                      body: removeBody
                    }
                  );

                  if (removeError) {
                    console.error('❌ Erro ao remover fila/responsável da conversa:', removeError);
                  } else {
                    console.log('✅ Fila/responsável removidos da conversa:', removeResult);
                  }
                }
              } catch (convErr) {
                console.error('❌ Erro ao aplicar regras à conversa:', convErr);
              }
            }
          }
        } catch (err) {
          console.error('Error transferring card:', cardId, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Sucesso",
          description: `${successCount} negócio(s) transferido(s) com sucesso`,
        });
      }

      if (errorCount > 0) {
        toast({
          title: errorCount === selectedCards.length ? "Erro" : "Atenção",
          description: errors.length > 0 
            ? errors[0] 
            : `${errorCount} negócio(s) não puderam ser transferidos`,
          variant: "destructive",
        });
      }

      // Close first, then refresh
      onClose();
      
      // Give a small delay to ensure the modal is closed before refresh
      setTimeout(() => {
        onTransferComplete();
      }, 100);
    } catch (error) {
      console.error('Error transferring cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir negócios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-md p-0 gap-0 border shadow-sm rounded-none",
        "bg-white dark:bg-[#0f0f0f] border-[#d4d4d4] dark:border-gray-700 text-gray-900 dark:text-gray-100"
      )}>
        <DialogHeader className="bg-primary p-4 rounded-none m-0">
          <DialogTitle className="text-sm font-bold text-white">
            Transferir Negócios Selecionados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {/* Origem */}
          <div>
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Origem:
            </Label>
            <p className="mt-1 text-xs text-gray-900 dark:text-white">
              {currentPipelineName}
            </p>
            <p className="text-[10px] mt-1 text-gray-500 dark:text-gray-400">
              {selectedCards.length} negócio(s) selecionado(s) será(ão) transferido(s)
            </p>
          </div>

          {/* Pipeline de Destino */}
          <div>
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Pipeline de Destino
            </Label>
            <Select value={targetPipelineId} onValueChange={setTargetPipelineId}>
              <SelectTrigger className="mt-1 h-8 text-xs rounded-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent className="rounded-none border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                {pipelines
                  .filter(p => p.is_active)
                  .map(pipeline => (
                    <SelectItem 
                      key={pipeline.id} 
                      value={pipeline.id}
                      className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                    >
                      {pipeline.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa de Destino */}
          <div>
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Etapa de Destino
            </Label>
            <Select 
              value={targetColumnId} 
              onValueChange={setTargetColumnId}
              disabled={!targetPipelineId}
            >
              <SelectTrigger className="mt-1 h-8 text-xs rounded-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent className="rounded-none border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                {targetColumns.map(column => (
                  <SelectItem 
                    key={column.id} 
                    value={column.id}
                    className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                  >
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fila (Opcional) */}
          <div>
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Fila
            </Label>
            <Select 
              value={targetQueueId} 
              onValueChange={setTargetQueueId}
              disabled={isQueueDisabled}
            >
              <SelectTrigger className="mt-1 h-8 text-xs rounded-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Sem ações a serem executadas" />
              </SelectTrigger>
              <SelectContent className="rounded-none border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                <SelectItem 
                  value="none"
                  className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                >
                  Sem ações a serem executadas
                </SelectItem>
                <SelectItem 
                  value="remove"
                  className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                >
                  Remover fila
                </SelectItem>
                {queues.map(queue => (
                  <SelectItem 
                    key={queue.id} 
                    value={queue.id}
                    className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                  >
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável (Opcional) */}
          <div>
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Responsável
            </Label>
            <Select 
              value={targetResponsibleId} 
              onValueChange={setTargetResponsibleId}
              disabled={isResponsibleDisabled}
            >
              <SelectTrigger className="mt-1 h-8 text-xs rounded-none bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                <SelectValue placeholder="Sem ações a serem executadas" />
              </SelectTrigger>
              <SelectContent className="rounded-none border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                <SelectItem 
                  value="none"
                  className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                >
                  Sem ações a serem executadas
                </SelectItem>
                <SelectItem 
                  value="remove"
                  className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                >
                  Remover responsável
                </SelectItem>
                {workspaceUsers
                  .filter(user => user.profile !== 'master' && user.profile !== 'support')
                  .map(user => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id}
                      className="text-xs focus:bg-[#e6f2ff] dark:focus:bg-gray-600 focus:text-black dark:focus:text-white cursor-pointer text-gray-900 dark:text-white"
                    >
                      {user.name || user.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 dark:bg-[#0f0f0f] border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="h-8 text-xs rounded-none bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isLoading || !targetPipelineId || !targetColumnId}
            className="h-8 text-xs rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {isLoading ? "Transferindo..." : `Transferir ${selectedCards.length} Negócio(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
