import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePipelinesContext } from "@/contexts/PipelinesContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { DeletarPipelineModal } from "@/components/modals/DeletarPipelineModal";

interface PipelineConfigProps {
  isDarkMode?: boolean;
  onColumnsReorder?: (newOrder: any[]) => void;
}

interface Action {
  id: string;
  actionName: string;
  nextPipeline: string;
  targetColumn: string;
  dealState: string;
  buttonColor?: string;
}

// Inicializar com as 3 ações padrão obrigatórias
const STANDARD_ACTIONS = [
  { name: 'Ganho', state: 'Ganho' },
  { name: 'Perdido', state: 'Perda' },
  { name: 'Reabrir', state: 'Aberto' }
];

export default function PipelineConfiguracao({
  isDarkMode,
  onColumnsReorder
}: PipelineConfigProps) {
  const [actions, setActions] = useState<Action[]>([]);
  const [actionColumns, setActionColumns] = useState<{[key: string]: any[]}>({});
  const { getHeaders } = useWorkspaceHeaders();
  const [isDeletePipelineModalOpen, setIsDeletePipelineModalOpen] = useState(false);
  const [isDeletingPipeline, setIsDeletingPipeline] = useState(false);
  const {
    columns,
    selectedPipeline,
    reorderColumns,
    pipelines,
    isLoadingColumns: contextIsLoadingColumns,
    selectPipeline,
    refreshCurrentPipeline,
    deletePipeline
  } = usePipelinesContext();
  const {
    user,
    userRole
  } = useAuth();
  const {
    selectedWorkspace,
    setSelectedWorkspace
  } = useWorkspace();
  const { toast } = useToast();
  const [pipelineName, setPipelineName] = useState(selectedPipeline?.name || "Vendas");
  const [currency, setCurrency] = useState("brl");
  const [selectedColumn, setSelectedColumn] = useState("qualificar");
  const [selectedAutomation, setSelectedAutomation] = useState("");
  const canConfigureOpenStatus = userRole === 'master' || userRole === 'admin';

  const deleteColumn = async (columnId: string) => {
    try {
      console.log('🗑️ Deleting column:', columnId);
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'DELETE',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });

      if (error) throw error;

      console.log('✅ Column deleted successfully');
      
      toast({
        title: "Sucesso",
        description: "Coluna excluída com sucesso",
      });

      // O realtime já vai atualizar automaticamente, mas forçar refresh para garantir
      await refreshCurrentPipeline();
      
    } catch (error: any) {
      console.error('❌ Error deleting column:', error);
      
      // Show user-friendly error message
      if (error.message?.includes('existing cards')) {
        toast({
          title: "Erro ao excluir coluna",
          description: "Não é possível excluir uma coluna que contém cards. Mova os cards para outra coluna primeiro.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao excluir coluna",
          description: "Ocorreu um erro ao tentar excluir a coluna. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeletePipeline = async () => {
    if (!selectedPipeline) return;
    
    setIsDeletingPipeline(true);
    
    try {
      await deletePipeline(selectedPipeline.id);
      setIsDeletePipelineModalOpen(false);
      
      toast({
        title: "Pipeline excluído",
        description: "O pipeline foi excluído com sucesso.",
      });
      
    } catch (error: any) {
      console.error('❌ Erro ao deletar pipeline:', error);
      toast({
        title: "Erro ao excluir pipeline",
        description: error.message || "Ocorreu um erro ao tentar excluir o pipeline.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingPipeline(false);
    }
  };

  // Carregar ações salvas e garantir as 3 padrão
  const loadPipelineActions = async (pipelineId: string) => {
    try {
      console.log('📥 Carregando ações para pipeline:', pipelineId);
      
      const headers = getHeaders();
      const { data: dbActions, error } = await supabase.functions.invoke(
        `pipeline-management/actions?pipeline_id=${pipelineId}`,
        {
          method: 'GET',
          headers
        }
      );

      if (error) throw error;

      console.log('📦 Ações carregadas do banco:', dbActions);

      // Mapear ações do banco ou criar temporárias para as 3 padrão
      const finalActions: Action[] = STANDARD_ACTIONS.map((std, index) => {
        const found = (dbActions || []).find((a: any) => 
          a.action_name.toLowerCase() === std.name.toLowerCase() || 
          a.deal_state === std.state
        );

        if (found) {
          return {
            id: found.id,
            actionName: std.name, // Nome fixo
            nextPipeline: found.target_pipeline_id || "",
            targetColumn: found.target_column_id || "",
            dealState: std.state, // Status fixo
            buttonColor: found.button_color || undefined
          };
        }

        // Se não existir no banco, cria uma temporária
        return {
          id: `temp-${std.name.toLowerCase()}`,
          actionName: std.name,
          nextPipeline: "",
          targetColumn: "",
          dealState: std.state,
          buttonColor: undefined
        };
      });

      setActions(finalActions);

      // Carregar colunas para cada ação
      finalActions.forEach(action => {
        if (action.nextPipeline) {
          fetchPipelineColumns(action.nextPipeline).then(columns => {
            setActionColumns(prev => ({
              ...prev,
              [action.id]: columns
            }));
          });
        }
      });

    } catch (error) {
      console.error('❌ Error loading pipeline actions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as ações.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedPipeline?.id) {
      loadPipelineActions(selectedPipeline.id);
    }
  }, [selectedPipeline?.id]);

  const updateAction = (id: string, field: keyof Action, value: string) => {
    console.log('🔄 updateAction chamado:', { id, field, value });
    setActions(prevActions => {
      const newActions = prevActions.map(action => action.id === id ? {
        ...action,
        [field]: value
      } : action);
      console.log('✅ Novo estado actions:', newActions);
      return newActions;
    });
  };

  const saveAction = async (action: Action) => {
    console.log('💾 saveAction chamado com:', action);
    console.log('📊 Pipeline selecionado:', selectedPipeline);
    console.log('👤 Usuário:', { id: user?.id, email: user?.email });
    console.log('🏢 Workspace:', selectedWorkspace?.workspace_id);
    
    if (!selectedPipeline?.id) {
      console.error('❌ Nenhum pipeline selecionado!');
      return;
    }

    if (!user?.id || !user?.email) {
      console.error('❌ Usuário não autenticado!');
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar autenticado para salvar ações.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedWorkspace?.workspace_id) {
      console.error('❌ Nenhum workspace selecionado!');
      toast({
        title: "Erro",
        description: "Nenhum workspace selecionado.",
        variant: "destructive",
      });
      return;
    }
    
    if (!action.actionName || !action.nextPipeline || !action.targetColumn || !action.dealState) {
      console.log('❌ Campos faltando:', {
        actionName: action.actionName,
        nextPipeline: action.nextPipeline,
        targetColumn: action.targetColumn,
        dealState: action.dealState
      });
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Configurar contexto do usuário primeiro
      const { error: contextError } = await supabase.rpc('set_current_user_context', {
        user_id: user.id,
        user_email: user.email
      });

      if (contextError) {
        console.error('❌ Erro ao configurar contexto:', contextError);
        throw new Error('Falha ao configurar contexto do usuário');
      }

      console.log('✅ Contexto do usuário configurado');

      const actionData = {
        pipeline_id: selectedPipeline.id,
        action_name: action.actionName,
        target_pipeline_id: action.nextPipeline,
        target_column_id: action.targetColumn,
        deal_state: action.dealState,
        button_color: action.buttonColor || null, // Enviar exatamente o que tem, sem fallback
        order_position: actions.indexOf(action)
      };
      
      console.log('📤 Dados que serão enviados:', actionData);
      console.log('🎨 buttonColor da ação:', action.buttonColor, '→ será salvo como:', actionData.button_color);

      if (action.id.startsWith('temp-')) {
        // Criar nova ação
        const headers = getHeaders();
        const { data, error } = await supabase.functions.invoke(
          'pipeline-management/actions',
          {
            method: 'POST',
            headers,
            body: actionData
          }
        );

        if (error) {
          console.error('❌ Erro ao criar ação:', error);
          throw error;
        }

        console.log('✅ Ação criada com sucesso:', data);
        console.log('🎨 Cor retornada pela API:', data?.button_color || data?.buttonColor);

        // Atualizar apenas a ação criada no estado local, preservando as outras
        // Usar a cor retornada pela API se disponível, senão usar a cor local (sem fallback azul)
        const savedColor = data?.button_color || data?.buttonColor || action.buttonColor || undefined;
        
        setActions(prevActions => prevActions.map(a => 
          a.id === action.id 
            ? {
                ...a,
                id: data.id, // Atualizar com o ID real do banco
                buttonColor: savedColor // Usar cor retornada pela API ou preservar a escolhida
              }
            : a // Manter outras ações intactas
        ));

        // Carregar colunas se necessário
        if (action.nextPipeline) {
          const columns = await fetchPipelineColumns(action.nextPipeline);
          setActionColumns(prev => ({
            ...prev,
            [data.id]: columns
          }));
        }

        toast({
          title: "Ação salva",
          description: "A ação foi criada com sucesso.",
        });
      } else {
        // Atualizar ação existente
        const headers = getHeaders();
        const { data, error } = await supabase.functions.invoke(
          `pipeline-management/actions?id=${action.id}`,
          {
            method: 'PUT',
            headers,
            body: actionData
          }
        );

        if (error) {
          console.error('❌ Erro ao atualizar ação:', error);
          throw error;
        }

        console.log('✅ Ação atualizada com sucesso');
        console.log('🎨 Dados retornados pela API:', data);
        console.log('🎨 Cor retornada pela API:', data?.button_color || data?.buttonColor);

        // Usar a cor retornada pela API se disponível, senão usar a cor local (sem fallback azul)
        const savedColor = data?.button_color || data?.buttonColor || action.buttonColor || undefined;

        // Atualizar apenas a ação específica no estado local, preservando as outras
        setActions(prevActions => prevActions.map(a => 
          a.id === action.id 
            ? {
                ...a,
                ...action, // Preservar todos os valores locais
                buttonColor: savedColor // Usar cor retornada pela API ou preservar a escolhida
              }
            : a // Manter outras ações intactas com suas cores
        ));

        toast({
          title: "Ação atualizada",
          description: "A ação foi atualizada com sucesso.",
        });
      }
    } catch (error: any) {
      console.error('❌ Error saving action:', error);
      toast({
        title: "Erro ao salvar ação",
        description: error.message || "Não foi possível salvar a ação. Verifique suas permissões.",
        variant: "destructive",
      });
    }
  };

  // Buscar colunas do pipeline selecionado
  const fetchPipelineColumns = async (pipelineId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: {
          'x-system-user-id': user?.id || '',
          'x-system-user-email': user?.email || '',
          'x-workspace-id': selectedWorkspace?.workspace_id || ''
        }
      });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pipeline columns:', error);
      return [];
    }
  };

  // Quando um pipeline for selecionado, buscar suas colunas
  const handlePipelineChange = async (actionId: string, pipelineId: string) => {
    console.log('🎯 handlePipelineChange chamado:', { actionId, pipelineId });
    console.log('📊 Estado actions antes:', actions);
    
    updateAction(actionId, 'nextPipeline', pipelineId);
    updateAction(actionId, 'targetColumn', ''); // Reset coluna selecionada
    
    console.log('📊 Estado actions depois updateAction:', actions);
    
    const columns = await fetchPipelineColumns(pipelineId);
    console.log('📋 Colunas carregadas:', columns);
    
    setActionColumns(prev => ({
      ...prev,
      [actionId]: columns
    }));
  };

  return (
    <div
      className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:text-gray-100"
    >
      <div className="flex-1 overflow-auto bg-[#f3f3f3] dark:bg-[#050505] p-4">
        <div className="w-full space-y-4">
            <div className="bg-white border border-gray-200 shadow-sm dark:bg-[#111111] dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between dark:border-gray-700">
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Dados principais</p>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Atualize o nome e defina o pipeline padrão</span>
                </div>
                <div className="text-[11px] text-gray-400 uppercase tracking-widest">
                  #{selectedPipeline?.id?.slice(0, 6) || "---"}
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nome do pipeline</label>
                    <Input
                      value={pipelineName}
                      onChange={(e) => setPipelineName(e.target.value)}
                      className="rounded-none text-sm dark:bg-[#161616] dark:border-gray-700"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 self-end">
                    <Button
                      className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={async () => {
                        if (!selectedPipeline?.id) return;

                        try {
                          const { error } = await supabase
                            .from('pipelines')
                            .update({
                              name: pipelineName
                            })
                            .eq('id', selectedPipeline.id);

                          if (error) throw error;

                          toast({
                            title: "Sucesso",
                            description: "Pipeline atualizado com sucesso"
                          });

                          if (refreshCurrentPipeline) {
                            await refreshCurrentPipeline();
                          }
                        } catch (error) {
                          console.error('Erro ao atualizar pipeline:', error);
                          toast({
                            title: "Erro",
                            description: "Erro ao atualizar pipeline",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      Salvar
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 bg-white dark:border-gray-500 dark:text-gray-100 dark:bg-[#1f1f1f] dark:hover:bg-[#353535]"
                      onClick={async () => {
                        if (!selectedPipeline?.id || !selectedWorkspace?.workspace_id) return;

                        try {
                          const { error } = await supabase.functions.invoke('manage-workspaces', {
                            body: {
                              action: 'update',
                              workspaceId: selectedWorkspace.workspace_id,
                              name: selectedWorkspace.name,
                              defaultPipelineId: selectedPipeline.id
                            },
                            headers: getHeaders()
                          });

                          if (error) throw error;

                          toast({
                            title: "Sucesso",
                            description: "Pipeline definido como padrão com sucesso!",
                          });

                          // Atualiza contexto/localStorage para refletir o novo padrão imediatamente
                          if (selectedWorkspace && setSelectedWorkspace) {
                            setSelectedWorkspace({
                              ...selectedWorkspace,
                              default_pipeline_id: selectedPipeline.id
                            });
                          }

                          if (refreshCurrentPipeline) {
                            await refreshCurrentPipeline();
                          }
                        } catch (error) {
                          console.error('Erro ao definir pipeline padrão:', error);
                          toast({
                            title: "Erro",
                            description: "Erro ao definir pipeline padrão",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      Definir como padrão
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-red-200 shadow-sm dark:bg-[#181111] dark:border-red-900/50">
              <div className="px-4 py-3 border-b border-red-200 bg-red-50 dark:bg-[#2a1212] dark:border-red-900/40">
                <p className="text-xs font-semibold text-red-900 dark:text-red-200">Zona de perigo</p>
                <span className="text-[11px] text-red-700 dark:text-red-300">Excluir o pipeline remove etapas e oportunidades.</span>
              </div>
              <div className="p-4">
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-none bg-red-600 hover:bg-red-700"
                  onClick={() => setIsDeletePipelineModalOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir pipeline
                </Button>
              </div>
            </div>

          {/* Aba "Ações" removida: botões (Ganho/Perdido/Reabrir) são fixos no detalhe da oportunidade */}

        </div>
      </div>

      <DeletarPipelineModal
        isOpen={isDeletePipelineModalOpen}
        onClose={() => setIsDeletePipelineModalOpen(false)}
        onConfirm={handleDeletePipeline}
        pipelineName={selectedPipeline?.name || ""}
        isDeleting={isDeletingPipeline}
      />
    </div>
  );
}