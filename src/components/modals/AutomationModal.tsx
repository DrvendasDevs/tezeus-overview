import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { logCreate, logUpdate } from '@/utils/auditLog';
// ✅ Removidos hooks que carregam tudo de uma vez - agora fazemos lazy loading

interface AutomationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  automation?: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    ignore_business_hours?: boolean;
    triggers?: Array<{
      id: string;
      trigger_type: string;
      trigger_config: any;
    }>;
    actions?: Array<{
      id: string;
      action_type: string;
      action_config: any;
      action_order: number;
    }>;
  } | null;
  onSaved: () => void;
  isDarkMode?: boolean;
}

interface Trigger {
  id: string;
  trigger_type: 'enter_column' | 'leave_column' | 'time_in_column' | 'scheduled_time' | 'message_received' | '';
  trigger_config: any;
}

interface Action {
  id: string;
  action_type: 'send_message' | 'send_funnel' | 'move_to_column' | 'add_tag' | 'add_agent' | 'remove_agent' | '';
  action_config: any;
  action_order: number;
}

const TRIGGER_TYPES = [
  { value: 'enter_column', label: 'Entrada na etapa' },
  { value: 'leave_column', label: 'Saída da etapa' },
  { value: 'time_in_column', label: 'Tempo na etapa' },
  { value: 'scheduled_time', label: 'Horário específico' },
  { value: 'message_received', label: 'Mensagens recebidas' },
];

const ACTION_TYPES = [
  { value: 'send_message', label: 'Enviar mensagem' },
  { value: 'send_funnel', label: 'Enviar funil' },
  { value: 'move_to_column', label: 'Mudar etapa' },
  { value: 'add_tag', label: 'Adicionar etiqueta' },
  { value: 'add_agent', label: 'Adicionar agente de IA' },
  { value: 'remove_agent', label: 'Remover agente de IA' },
];

const CONNECTION_MODES = [
  { value: 'default', label: 'Conexão padrão' },
  { value: 'last', label: 'Última conversa' },
  { value: 'specific', label: 'Conexão específica' },
];

const TIME_UNITS = [
  { value: 'minutes', label: 'minuto(s)' },
  { value: 'hours', label: 'hora(s)' },
  { value: 'days', label: 'dia(s)' },
];

const HOURS_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0')
);

const MINUTES_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const AUTOMATION_VARIABLES = [
  { label: 'Nome', tag: '{{nome}}' },
  { label: 'Primeiro Nome', tag: '{{primeiro_nome}}' },
  { label: 'Telefone', tag: '{{telefone}}' },
  { label: 'Email', tag: '{{email}}' },
  { label: 'Etapa', tag: '{{etapa}}' },
  { label: 'Pipeline', tag: '{{pipeline}}' },
];

export function AutomationModal({
  open,
  onOpenChange,
  columnId,
  automation,
  onSaved,
  isDarkMode = false,
}: AutomationModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ignoreBusinessHours, setIgnoreBusinessHours] = useState(false);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  
  // ✅ OTIMIZADO: Estados para dados sob demanda
  const [funnels, setFunnels] = useState<any[]>([]);
  const [funnelsLoading, setFunnelsLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [columnsByPipeline, setColumnsByPipeline] = useState<Record<string, any[]>>({});
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // ✅ Funções de carregamento lazy estabilizadas com useCallback
  const loadFunnels = useCallback(async () => {
    if (funnels.length > 0 || funnelsLoading) return;
    try {
      setFunnelsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      const { data, error } = await supabase
        .from('quick_funnels')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFunnels(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar funis:', error);
    } finally {
      setFunnelsLoading(false);
    }
  }, [funnels.length, funnelsLoading, selectedWorkspace?.workspace_id]);

  const loadConnections = useCallback(async () => {
    if (connections.length > 0 || connectionsLoading) return;
    try {
      setConnectionsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('status', 'connected')
        .order('instance_name');
      if (error) throw error;
      setConnections(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setConnectionsLoading(false);
    }
  }, [connections.length, connectionsLoading, selectedWorkspace?.workspace_id]);

  const loadTags = useCallback(async () => {
    if (tags.length > 0 || tagsLoading) return;
    try {
      setTagsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      if (error) throw error;
      setTags(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar tags:', error);
    } finally {
      setTagsLoading(false);
    }
  }, [tags.length, tagsLoading, selectedWorkspace?.workspace_id]);

  const loadPipelines = useCallback(async () => {
    if (pipelines.length > 0 || pipelinesLoading) return;
    try {
      setPipelinesLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      if (error) throw error;
      setPipelines(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar pipelines:', error);
    } finally {
      setPipelinesLoading(false);
    }
  }, [pipelines.length, pipelinesLoading, selectedWorkspace?.workspace_id]);

  const loadColumns = useCallback(async (pipelineIdParam?: string) => {
    try {
      setColumnsLoading(true);
      let targetPipelineId = pipelineIdParam;
      if (!targetPipelineId) {
        if (!columnId) return;
        const { data: columnData } = await supabase
          .from('pipeline_columns')
          .select('pipeline_id')
          .eq('id', columnId)
          .maybeSingle();
        targetPipelineId = columnData?.pipeline_id;
      }
      if (targetPipelineId) {
        if (columnsByPipeline[targetPipelineId] && !pipelineIdParam) return;
        const { data: cols, error } = await supabase
          .from('pipeline_columns')
          .select('*')
          .eq('pipeline_id', targetPipelineId)
          .order('order_position');
        if (error) throw error;
        setColumnsByPipeline(prev => ({ ...prev, [targetPipelineId!]: cols || [] }));
      }
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
    } finally {
      setColumnsLoading(false);
    }
  }, [columnId, columnsByPipeline]);

  const loadAgents = useCallback(async () => {
    if (agents.length > 0 || agentsLoading) return;
    try {
      setAgentsLoading(true);
      if (!selectedWorkspace?.workspace_id) return;
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setAgents(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setAgentsLoading(false);
    }
  }, [agents.length, agentsLoading, selectedWorkspace?.workspace_id]);

  useEffect(() => {
    if (open) {
      if (automation) {
        setName(automation.name || '');
        setDescription(automation.description || '');
        setIgnoreBusinessHours(automation.ignore_business_hours || false);
        setTriggers(automation.triggers?.map(t => ({
          id: t.id,
          trigger_type: t.trigger_type as any,
          trigger_config: t.trigger_config || {}
        })) || []);
        setActions(automation.actions?.map(a => ({
          id: a.id,
          action_type: a.action_type as any,
          action_config: {
            ...a.action_config || {},
            // ✅ Garantir que remove_current seja booleano se for remove_agent
            ...(a.action_type === 'remove_agent' && !a.action_config?.remove_current && !a.action_config?.agent_id 
              ? { remove_current: true } 
              : {})
          },
          action_order: a.action_order || 0
        })) || []);
        
        // ✅ Carregar dados necessários se a automação já tiver ações configuradas
        const needsFunnels = automation.actions?.some(a => a.action_type === 'send_funnel');
        const needsConnections = automation.actions?.some(a => 
          (a.action_type === 'send_message' || a.action_type === 'send_funnel') &&
          a.action_config?.connection_mode === 'specific'
        );
        const needsTags = automation.actions?.some(a => a.action_type === 'add_tag');
        const needsColumns = automation.actions?.some(a => a.action_type === 'move_to_column');
        const needsAgents = automation.actions?.some(a => 
          a.action_type === 'add_agent' || a.action_type === 'remove_agent'
        );
        
        if (needsFunnels) loadFunnels();
        if (needsConnections) loadConnections();
        if (needsTags) loadTags();
        if (needsColumns) {
          loadPipelines();
          // Carregar colunas para cada ação de mover para coluna que já tenha pipeline
          automation.actions?.forEach(a => {
            if (a.action_type === 'move_to_column' && (a.action_config?.pipeline_id || a.action_config?.target_pipeline_id)) {
              loadColumns(a.action_config?.pipeline_id || a.action_config?.target_pipeline_id);
            }
          });
          // Também carregar colunas do pipeline atual
          loadColumns();
        }
        if (needsAgents) loadAgents();
      } else {
        setName('');
        setDescription('');
        setIgnoreBusinessHours(false);
        setTriggers([]);
        setActions([]);
      }
      
      // ✅ Limpar cache quando fecha o modal
      return () => {
        // Manter dados em cache para próximas aberturas
      };
    } else {
      // Limpar apenas quando fecha completamente
    }
  }, [open, automation, columnId]);

  const addTrigger = () => {
    setTriggers([...triggers, {
      id: `temp-${Date.now()}`,
      trigger_type: '',
      trigger_config: {}
    }]);
  };

  const removeTrigger = (id: string) => {
    setTriggers(triggers.filter(t => t.id !== id));
  };

  const updateTrigger = (id: string, field: keyof Trigger, value: any) => {
    setTriggers(prevTriggers => prevTriggers.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const updateTriggerConfig = (id: string, configField: string, value: any) => {
    setTriggers(prevTriggers => prevTriggers.map(t => 
      t.id === id ? { ...t, trigger_config: { ...t.trigger_config, [configField]: value } } : t
    ));
  };

  const addAction = () => {
    setActions(prevActions => [...prevActions, {
      id: `temp-${Date.now()}`,
      action_type: '',
      action_config: {},
      action_order: prevActions.length
    }]);
  };

  const removeAction = (id: string) => {
    setActions(prevActions => prevActions.filter(a => a.id !== id));
  };

  const updateAction = async (id: string, field: keyof Action, value: any) => {
    setActions(prevActions => prevActions.map(a => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        
        // ✅ Carregar dados sob demanda quando o tipo de ação muda
        if (field === 'action_type' && value) {
          if (value === 'send_funnel') {
            loadFunnels();
          }
          if (value === 'move_to_column') {
            loadPipelines();
            loadColumns();
          }
          if (value === 'add_tag') {
            loadTags();
          }
          if (value === 'add_agent' || value === 'remove_agent') {
            loadAgents();
          }
        }
        
        return updated;
      }
      return a;
    }));
  };

  const updateActionConfig = useCallback((id: string, updates: Record<string, any>) => {
    setActions(prevActions => prevActions.map(a => {
      if (a.id === id) {
        const updatedConfig = { ...a.action_config };
        
        Object.entries(updates).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            delete updatedConfig[key];
          } else {
            updatedConfig[key] = value;
          }
        });
        
        return {
          ...a,
          action_config: updatedConfig
        };
      }
      return a;
    }));

    // ✅ Verificar se precisa carregar conexões
    if (updates.connection_mode === 'specific') {
      loadConnections();
    }
  }, [loadConnections]);

  const handleSave = async () => {
    // Validações
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da automação é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (triggers.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um gatilho",
        variant: "destructive",
      });
      return;
    }

    if (actions.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma ação",
        variant: "destructive",
      });
      return;
    }

    // Validar que todos os triggers têm tipo
    const invalidTriggers = triggers.filter(t => !t.trigger_type);
    if (invalidTriggers.length > 0) {
      toast({
        title: "Erro",
        description: "Todos os gatilhos devem ter um tipo selecionado",
        variant: "destructive",
      });
      return;
    }

    // Validar que todas as ações têm tipo
    const invalidActions = actions.filter(a => !a.action_type);
    if (invalidActions.length > 0) {
      toast({
        title: "Erro",
        description: "Todas as ações devem ter um tipo selecionado",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();
      const currentUserId = headers['x-system-user-id'] || null;
      const buildAuditPayload = () => ({
        name: name.trim(),
        description: description.trim() || null,
        ignore_business_hours: ignoreBusinessHours,
        triggers: triggers.map(t => ({
          trigger_type: t.trigger_type,
          trigger_config: t.trigger_config || {}
        })),
        actions: actions.map(a => ({
          action_type: a.action_type,
          action_config: a.action_config || {},
          action_order: a.action_order
        }))
      });

      if (automation?.id) {
        // Atualizar automação existente usando função SQL
        const triggersJson = triggers.map(t => ({
          trigger_type: t.trigger_type,
          trigger_config: t.trigger_config || {}
        }));

        const actionsJson = actions.map(a => ({
          action_type: a.action_type,
          action_config: a.action_config || {}
        }));

        // ✅ Log para debug da ação remove_agent
        const removeAgentActions = actionsJson.filter(a => a.action_type === 'remove_agent');
        if (removeAgentActions.length > 0) {
          console.log('🔍 [AutomationModal] Salvando ações remove_agent (UPDATE):', JSON.stringify(removeAgentActions, null, 2));
        }

        // Atualizar automação (RPC)
        const { error: updateError } = await supabase.rpc('update_column_automation', {
          p_automation_id: automation.id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_triggers: triggersJson as any,
          p_actions: actionsJson as any,
          p_user_id: currentUserId,
          p_ignore_business_hours: ignoreBusinessHours, // ✅ Passando explicitamente para resolver ambiguidade
        });

        if (updateError) {
          console.error('❌ Erro no update_column_automation:', updateError);
          // Se falhar porque a versão de 8 parâmetros não existe (fallback)
          if (updateError.message?.includes('p_ignore_business_hours') || updateError.code === 'P0001') {
             const { error: retryError } = await supabase.rpc('update_column_automation', {
              p_automation_id: automation.id,
              p_name: name.trim(),
              p_description: description.trim() || null,
              p_triggers: triggersJson as any,
              p_actions: actionsJson as any,
              p_user_id: currentUserId,
            });
            if (retryError) throw retryError;
            
            // Tentar atualizar ignore_business_hours separadamente se o RPC principal não aceita
            await (supabase.rpc as any)('update_automation_ignore_business_hours', {
              p_automation_id: automation.id,
              p_ignore_business_hours: ignoreBusinessHours
            });
          } else {
            throw updateError;
          }
        }

        await logUpdate(
          'automation',
          automation.id,
          name.trim() || automation.name || 'Automação',
          {
            name: automation.name,
            description: automation.description,
            is_active: automation.is_active,
            ignore_business_hours: automation.ignore_business_hours ?? false,
            triggers: automation.triggers || [],
            actions: automation.actions || []
          },
          buildAuditPayload(),
          selectedWorkspace?.workspace_id || null
        );
      } else {
        // Criar nova automação usando função SQL
        if (!selectedWorkspace?.workspace_id) {
          throw new Error('Workspace não selecionado');
        }

        const triggersJson = triggers.map(t => ({
          trigger_type: t.trigger_type,
          trigger_config: t.trigger_config || {}
        }));

        const actionsJson = actions.map(a => ({
          action_type: a.action_type,
          action_config: a.action_config || {}
        }));

        // ✅ Log para debug da ação remove_agent
        const removeAgentActions = actionsJson.filter(a => a.action_type === 'remove_agent');
        if (removeAgentActions.length > 0) {
          console.log('🔍 [AutomationModal] Salvando ações remove_agent:', JSON.stringify(removeAgentActions, null, 2));
        }

        let createdAutomationId: string | null = null;
        // Criar nova automação
        const { data: automationId, error: createError } = await supabase.rpc('create_column_automation', {
          p_column_id: columnId,
          p_workspace_id: selectedWorkspace.workspace_id,
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_triggers: triggersJson as any,
          p_actions: actionsJson as any,
          p_user_id: currentUserId,
          p_ignore_business_hours: ignoreBusinessHours, // ✅ Passando explicitamente para resolver ambiguidade
        });

        if (createError) {
          console.error('❌ Erro no create_column_automation:', createError);
          // Fallback se a versão de 8 parâmetros não existir
          if (createError.message?.includes('p_ignore_business_hours') || createError.code === 'P0001') {
            const { data: retryId, error: retryError } = await supabase.rpc('create_column_automation', {
              p_column_id: columnId,
              p_workspace_id: selectedWorkspace.workspace_id,
              p_name: name.trim(),
              p_description: description.trim() || null,
              p_triggers: triggersJson as any,
              p_actions: actionsJson as any,
              p_user_id: currentUserId,
            });
            if (retryError) throw retryError;
            
            if (retryId) {
              createdAutomationId = retryId as any;
              await (supabase.rpc as any)('update_automation_ignore_business_hours', {
                p_automation_id: retryId,
                p_ignore_business_hours: ignoreBusinessHours
              });
            }
          } else {
            throw createError;
          }
        } else if (automationId) {
          createdAutomationId = automationId as any;
        }

        if (createdAutomationId) {
          await logCreate(
            'automation',
            createdAutomationId,
            name.trim() || 'Automação',
            buildAuditPayload(),
            selectedWorkspace.workspace_id
          );
        }
      }

      toast({
        title: "Sucesso",
        description: `Automação ${automation ? 'atualizada' : 'criada'} com sucesso`,
      });

      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao salvar automação:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar automação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const insertVariableAtCursor = (
    textareaId: string,
    tag: string,
    currentValue: string,
    setter: (newValue: string) => void
  ) => {
    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!textarea) {
      setter(currentValue + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);
    setter(newValue);
    // Reposicionar cursor após a tag
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      textarea.focus();
    }, 0);
  };

  const renderVariableButtons = (textareaId: string, currentValue: string, setter: (v: string) => void) => (
    <div className="flex flex-wrap gap-1">
      {AUTOMATION_VARIABLES.map((v) => (
        <button
          key={v.tag}
          type="button"
          onClick={() => insertVariableAtCursor(textareaId, v.tag, currentValue, setter)}
          className="h-5 px-1.5 text-[9px] font-medium rounded-none border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#222] text-gray-600 dark:text-gray-400 hover:bg-primary/10 hover:text-primary hover:border-primary/40 dark:hover:bg-primary/20 dark:hover:text-primary transition-colors"
        >
          {v.tag}
        </button>
      ))}
    </div>
  );

  const renderActionFields = (action: Action) => {
    switch (action.action_type) {
      case 'send_message': {
        const variations: string[] = Array.isArray(action.action_config?.message_variations) ? action.action_config.message_variations : [];
        const variationCount = variations.length;

        return (
          <div className="space-y-2">
            {/* Mensagem principal */}
            <Label className={`text-gray-700 dark:text-gray-200`}>Mensagem principal</Label>
            <Textarea
              id={`msg-main-${action.id}`}
              value={action.action_config?.message || ''}
              onChange={(e) => updateActionConfig(action.id, { message: e.target.value })}
              placeholder="Digite a mensagem a ser enviada"
              rows={3}
              className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
            />
            {renderVariableButtons(`msg-main-${action.id}`, action.action_config?.message || '', (v) => updateActionConfig(action.id, { message: v }))}

            {/* Variações */}
            {variations.map((variation: string, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-700 dark:text-gray-200 text-xs">
                    Variação {idx + 2}
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      const newVariations = [...variations];
                      newVariations.splice(idx, 1);
                      updateActionConfig(action.id, { message_variations: newVariations });
                    }}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Textarea
                  id={`msg-var-${action.id}-${idx}`}
                  value={variation}
                  onChange={(e) => {
                    const newVariations = [...variations];
                    newVariations[idx] = e.target.value;
                    updateActionConfig(action.id, { message_variations: newVariations });
                  }}
                  placeholder={`Variação ${idx + 2} da mensagem`}
                  rows={3}
                  className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
                />
                {renderVariableButtons(`msg-var-${action.id}-${idx}`, variation, (v) => {
                  const newVariations = [...variations];
                  newVariations[idx] = v;
                  updateActionConfig(action.id, { message_variations: newVariations });
                })}
              </div>
            ))}

            {/* Botão para adicionar variação */}
            {variationCount < 2 && (
              <button
                type="button"
                onClick={() => {
                  const newVariations = [...variations, ''];
                  updateActionConfig(action.id, { message_variations: newVariations });
                }}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                Adicionar variação ({variationCount + 1}/3)
              </button>
            )}
            {variationCount > 0 && (
              <p className="text-[10px] text-muted-foreground dark:text-gray-400">
                Uma das {variationCount + 1} variações será escolhida aleatoriamente para cada envio.
              </p>
            )}

            <Label className={`text-gray-700 dark:text-gray-200`}>Modo de conexão</Label>
            <Select
              value={action.action_config?.connection_mode || 'default'}
              onValueChange={(value) => updateActionConfig(action.id, { connection_mode: value })}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {CONNECTION_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action.action_config?.connection_mode === 'specific' && (
              <>
                <Label className={`text-gray-700 dark:text-gray-200`}>Conexão específica</Label>
                <Select
                  value={action.action_config?.connection_id || ''}
                  onValueChange={(value) => updateActionConfig(action.id, { connection_id: value })}
                  onOpenChange={(open) => {
                    if (open && connections.length === 0 && !connectionsLoading) {
                      loadConnections();
                    }
                  }}
                >
                  <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                    <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão"} />
                  </SelectTrigger>
                  <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                    {connectionsLoading ? (
                      <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                        Carregando conexões...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className={`p-3 text-sm text-muted-foreground dark:text-gray-400 text-center space-y-1`}>
                        <div className="font-medium">Nenhuma conexão ativa encontrada</div>
                        <div className="text-xs">
                          Conecte uma instância do WhatsApp primeiro
                        </div>
                      </div>
                    ) : (
                      connections.map(conn => (
                        <SelectItem key={conn.id} value={conn.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                          {conn.instance_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        );
      }

      case 'send_funnel':
        return (
          <div className="space-y-2">
            <Label className={`text-gray-700 dark:text-gray-200`}>Funil</Label>
            <Select
              value={action.action_config?.funnel_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, { funnel_id: value })}
              onOpenChange={(open) => {
                if (open && funnels.length === 0 && !funnelsLoading) {
                  loadFunnels();
                }
              }}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder={funnelsLoading ? "Carregando..." : "Selecione um funil"} />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {funnelsLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando funis...
                  </div>
                ) : funnels.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhum funil encontrado
                  </div>
                ) : (
                  funnels.map(funnel => (
                    <SelectItem key={funnel.id} value={funnel.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                      {funnel.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Label className={`text-gray-700 dark:text-gray-200`}>Modo de conexão</Label>
            <Select
              value={action.action_config?.connection_mode || 'default'}
              onValueChange={(value) => updateActionConfig(action.id, { connection_mode: value })}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {CONNECTION_MODES.map(mode => (
                  <SelectItem key={mode.value} value={mode.value} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {action.action_config?.connection_mode === 'specific' && (
              <>
                <Label className={`text-gray-700 dark:text-gray-200`}>Conexão específica</Label>
                <Select
                  value={action.action_config?.connection_id || ''}
                  onValueChange={(value) => updateActionConfig(action.id, { connection_id: value })}
                  onOpenChange={(open) => {
                    if (open && connections.length === 0 && !connectionsLoading) {
                      loadConnections();
                    }
                  }}
                >
                  <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                    <SelectValue placeholder={connectionsLoading ? "Carregando..." : "Selecione uma conexão"} />
                  </SelectTrigger>
                  <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                    {connectionsLoading ? (
                      <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                        Carregando conexões...
                      </div>
                    ) : connections.length === 0 ? (
                      <div className={`p-3 text-sm text-muted-foreground dark:text-gray-400 text-center space-y-1`}>
                        <div className="font-medium">Nenhuma conexão ativa encontrada</div>
                        <div className="text-xs">
                          Conecte uma instância do WhatsApp primeiro
                        </div>
                      </div>
                    ) : (
                      connections.map(conn => (
                        <SelectItem key={conn.id} value={conn.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                          {conn.instance_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        );

      case 'move_to_column':
        const selectedPipelineId = action.action_config?.pipeline_id || action.action_config?.target_pipeline_id;
        const currentPipelineColumns = selectedPipelineId ? (columnsByPipeline[selectedPipelineId] || []) : [];

        return (
          <div className="space-y-2">
            <Label className={`text-gray-700 dark:text-gray-200`}>Pipeline de destino</Label>
            <Select
              value={selectedPipelineId || ''}
              onValueChange={(value) => {
                updateActionConfig(action.id, {
                  pipeline_id: value,
                  target_pipeline_id: value,
                  column_id: '',
                  target_column_id: ''
                });
                loadColumns(value);
              }}
              onOpenChange={(open) => {
                if (open && pipelines.length === 0 && !pipelinesLoading) {
                  loadPipelines();
                }
              }}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder={pipelinesLoading ? "Carregando..." : "Selecione um pipeline"} />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {pipelinesLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando pipelines...
                  </div>
                ) : pipelines.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhum pipeline encontrado
                  </div>
                ) : (
                  pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Label className={`text-gray-700 dark:text-gray-200`}>Etapa de destino</Label>
            <Select
              value={action.action_config?.column_id || action.action_config?.target_column_id || ''}
              onValueChange={(value) => {
                updateActionConfig(action.id, {
                  column_id: value,
                  target_column_id: value
                });
              }}
              disabled={!selectedPipelineId}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder={columnsLoading ? "Carregando..." : !selectedPipelineId ? "Selecione um pipeline primeiro" : "Selecione uma coluna"} />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {columnsLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando colunas...
                  </div>
                ) : currentPipelineColumns.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhuma coluna encontrada
                  </div>
                ) : (
                  currentPipelineColumns
                    .filter(col => col.id !== columnId)
                    .map(col => (
                      <SelectItem key={col.id} value={col.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                        {col.name}
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_tag':
        return (
          <div className="space-y-2">
            <Label className={`text-gray-700 dark:text-gray-200`}>Etiqueta</Label>
            <Select
              value={action.action_config?.tag_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, { tag_id: value })}
              onOpenChange={(open) => {
                if (open && tags.length === 0 && !tagsLoading) {
                  loadTags();
                }
              }}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder={tagsLoading ? "Carregando..." : "Selecione uma etiqueta"} />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {tagsLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando tags...
                  </div>
                ) : tags.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhuma etiqueta encontrada
                  </div>
                ) : (
                  tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                      {tag.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'add_agent':
        return (
          <div className="space-y-2">
            <Label className={`text-gray-700 dark:text-gray-200`}>Agente de IA</Label>
            <Select
              value={action.action_config?.agent_id || ''}
              onValueChange={(value) => updateActionConfig(action.id, { agent_id: value })}
              onOpenChange={(open) => {
                if (open && agents.length === 0 && !agentsLoading) {
                  loadAgents();
                }
              }}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder={agentsLoading ? "Carregando..." : "Selecione um agente"} />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                {agentsLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando agentes...
                  </div>
                ) : agents.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhum agente encontrado
                  </div>
                ) : (
                  agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        );

      case 'remove_agent':
        return (
          <div className="space-y-2">
            <Label className={`text-gray-700 dark:text-gray-200`}>Remover agente</Label>
            <Select
              value={action.action_config?.remove_current === true ? 'current' : (action.action_config?.agent_id || 'current')}
              onValueChange={(value) => {
                if (value === 'current') {
                  // Remover agente atual - não precisa de agent_id específico
                  updateActionConfig(action.id, {
                    remove_current: true,
                    agent_id: null
                  });
                } else {
                  // Remover agente específico
                  updateActionConfig(action.id, {
                    remove_current: false,
                    agent_id: value
                  });
                }
              }}
              onOpenChange={(open) => {
                if (open && agents.length === 0 && !agentsLoading) {
                  loadAgents();
                }
              }}
            >
              <SelectTrigger className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className={`border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                <SelectItem value="current" className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>Remover agente atual</SelectItem>
                {agentsLoading ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Carregando agentes...
                  </div>
                ) : agents.length === 0 ? (
                  <div className={`p-2 text-sm text-muted-foreground dark:text-gray-400 text-center`}>
                    Nenhum agente encontrado
                  </div>
                ) : (
                  agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id} className={`text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {action.action_config?.remove_current === true && (
              <p className={`text-xs text-muted-foreground dark:text-gray-400`}>
                Removerá qualquer agente que esteja ativo na conversa
              </p>
            )}
            {action.action_config?.remove_current === false && action.action_config?.agent_id && (
              <p className={`text-xs text-muted-foreground dark:text-gray-400`}>
                Removerá apenas o agente específico selecionado, se estiver ativo
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm rounded-none ${isDarkMode ? 'dark' : ''}`}>
        <DialogHeader className="bg-primary p-4 rounded-none m-0">
          <DialogTitle className="text-primary-foreground dark:text-gray-100 text-base font-bold">
            {automation ? 'Editar Automação' : 'Nova Automação'}
          </DialogTitle>
        </DialogHeader>

        <div className={`space-y-6 p-6 bg-white dark:bg-[#0f0f0f]`}>
          {/* Nome e Descrição */}
          <div className="space-y-2">
            <Label htmlFor="automation-name" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>Nome da Automação *</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Mensagem de boas-vindas quando entrar na etapa 'Pré-venda'"
              className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="automation-description" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>Descrição</Label>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito desta automação (opcional)"
              rows={2}
              className={`text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0 min-h-[60px]`}
            />
          </div>

          {/* Ignorar Horário de Funcionamento */}
          <div className={`flex items-center justify-between p-3 border border-[#d4d4d4] dark:border-gray-700 rounded-none bg-gray-50 dark:bg-[#1a1a1a]`}>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <div className="space-y-0.5">
                <Label htmlFor="ignore-business-hours" className={`text-xs font-bold text-gray-700 dark:text-gray-200 cursor-pointer`}>
                  Ignorar horário de funcionamento
                </Label>
                <p className={`text-xs text-gray-500 dark:text-gray-400`}>
                  Se ativado, esta automação será executada mesmo fora do horário de atendimento configurado
                </p>
              </div>
            </div>
            <Switch
              id="ignore-business-hours"
              checked={ignoreBusinessHours}
              onCheckedChange={setIgnoreBusinessHours}
            />
          </div>

          {/* Gatilhos */}
          <Card className={`rounded-none border border-[#d4d4d4] dark:border-gray-700 shadow-none bg-white dark:bg-[#111111]`}>
            <CardHeader className={`bg-[#f0f0f0] dark:bg-[#1f1f1f] border-b border-[#d4d4d4] dark:border-gray-700 p-3 rounded-none`}>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-bold text-gray-800 dark:text-gray-100`}>Gatilhos</CardTitle>
                <Button variant="outline" size="sm" onClick={addTrigger} className={`h-7 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300`}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar gatilho
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`space-y-3 p-4 bg-white dark:bg-[#111111]`}>
              {triggers.length === 0 ? (
                <p className={`text-xs text-muted-foreground dark:text-gray-400 text-center py-4`}>
                  Nenhum gatilho adicionado. Clique em "Adicionar gatilho" para começar.
                </p>
              ) : (
                triggers.map((trigger) => (
                  <div key={trigger.id} className={`space-y-3 p-3 border border-[#d4d4d4] dark:border-gray-700 rounded-none bg-gray-50 dark:bg-[#1a1a1a]`}>
                    <div className="flex items-center gap-2">
                      <Select
                        value={trigger.trigger_type}
                        onValueChange={(value) => updateTrigger(trigger.id, 'trigger_type', value)}
                      >
                        <SelectTrigger className={`flex-1 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0`}>
                          <SelectValue placeholder="Selecione o tipo de gatilho" />
                        </SelectTrigger>
                        <SelectContent className={`rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                          {TRIGGER_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value} className={`text-xs rounded-none cursor-pointer text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {trigger.trigger_type === 'message_received' && (
                        <Input
                          type="number"
                          placeholder="Qtd."
                          min="1"
                          className={`w-20 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 focus-visible:ring-0 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
                          value={trigger.trigger_config?.message_count || ''}
                          onChange={(e) => updateTriggerConfig(trigger.id, 'message_count', parseInt(e.target.value) || 1)}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTrigger(trigger.id)}
                        className={`h-8 w-8 p-0 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-none`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {trigger.trigger_type === 'time_in_column' && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Tempo *"
                            min="1"
                            value={trigger.trigger_config?.time_value || ''}
                            onChange={(e) => updateTriggerConfig(trigger.id, 'time_value', e.target.value)}
                            className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 focus-visible:ring-0 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400`}
                          />
                        </div>
                        <div className="flex-1">
                          <Select
                            value={trigger.trigger_config?.time_unit || 'minutes'}
                            onValueChange={(value) => updateTriggerConfig(trigger.id, 'time_unit', value)}
                          >
                            <SelectTrigger className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className={`rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                              {TIME_UNITS.map(unit => (
                                <SelectItem key={unit.value} value={unit.value} className={`text-xs rounded-none cursor-pointer text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {trigger.trigger_type === 'scheduled_time' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between h-8 text-xs rounded-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 px-3 focus-visible:outline-none focus-visible:ring-0"
                                >
                                  <span>
                                    {trigger.trigger_config?.scheduled_time || 'Selecione o horário'}
                                  </span>
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400">▼</span>
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] p-3 w-56">
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={(trigger.trigger_config?.scheduled_time || '').split(':')[0] || '00'}
                                    onValueChange={(value) => {
                                      const minutes = (trigger.trigger_config?.scheduled_time || '00:00').split(':')[1] || '00';
                                      updateTriggerConfig(trigger.id, 'scheduled_time', `${value}:${minutes}`);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                                      {HOURS_OPTIONS.map((hour) => (
                                        <SelectItem key={hour} value={hour} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                                          {hour}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-xs text-gray-600 dark:text-gray-300">:</span>
                                  <Select
                                    value={(trigger.trigger_config?.scheduled_time || '').split(':')[1] || '00'}
                                    onValueChange={(value) => {
                                      const hours = (trigger.trigger_config?.scheduled_time || '00:00').split(':')[0] || '00';
                                      updateTriggerConfig(trigger.id, 'scheduled_time', `${hours}:${value}`);
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                                      {MINUTES_OPTIONS.map((minute) => (
                                        <SelectItem key={minute} value={minute} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                                          {minute}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* Seletor de dias da semana */}
                        <div>
                          <Label className="text-[10px] text-gray-600 dark:text-gray-400 mb-1.5 block">
                            Dias da semana (deixe vazio para todos os dias)
                          </Label>
                          <div className="flex flex-wrap gap-1">
                            {DAY_OPTIONS.map((day) => {
                              const currentDays: number[] = Array.isArray(trigger.trigger_config?.days_of_week) ? trigger.trigger_config.days_of_week : [];
                              const isSelected = currentDays.includes(day.value);
                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  onClick={() => {
                                    const newDays = isSelected
                                      ? currentDays.filter((d: number) => d !== day.value)
                                      : [...currentDays, day.value];
                                    updateTriggerConfig(trigger.id, 'days_of_week', newDays.length > 0 ? newDays : []);
                                  }}
                                  className={`h-7 px-2.5 text-[10px] font-medium rounded-none border transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-white dark:bg-[#1b1b1b] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
                                  }`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {trigger.trigger_type === 'time_in_column' && (
                      <p className={`text-[10px] text-muted-foreground dark:text-gray-400 flex items-start gap-2 pl-1`}>
                        <span className="text-yellow-500 dark:text-yellow-400 font-bold">⚠</span>
                        Executa apenas uma vez quando a oportunidade atinge o tempo configurado na etapa
                      </p>
                    )}

                    {trigger.trigger_type === 'scheduled_time' && (
                      <p className={`text-[10px] text-muted-foreground dark:text-gray-400 flex items-start gap-2 pl-1`}>
                        <span className="text-blue-500 dark:text-blue-400 font-bold">⏰</span>
                        {(Array.isArray(trigger.trigger_config?.days_of_week) && trigger.trigger_config.days_of_week.length > 0)
                          ? 'Executa nos dias selecionados no horário configurado enquanto o card estiver na coluna'
                          : 'Executa diariamente no horário configurado enquanto o card estiver na coluna'}
                      </p>
                    )}
                    
                    {trigger.trigger_type === 'message_received' && (
                      <p className={`text-[10px] text-muted-foreground dark:text-gray-400 flex items-start gap-2 pl-1`}>
                        <span className="text-blue-500 dark:text-blue-400 font-bold">ℹ</span>
                        Executa quando o contato enviar o número de mensagens especificado
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Ações */}
          <Card className={`rounded-none border border-[#d4d4d4] dark:border-gray-700 shadow-none bg-white dark:bg-[#111111]`}>
            <CardHeader className={`bg-[#f0f0f0] dark:bg-[#1f1f1f] border-b border-[#d4d4d4] dark:border-gray-700 p-3 rounded-none`}>
              <div className="flex items-center justify-between">
                <CardTitle className={`text-sm font-bold text-gray-800 dark:text-gray-100`}>Ações</CardTitle>
                <Button variant="outline" size="sm" onClick={addAction} className={`h-7 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300`}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar ação
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`space-y-4 p-4 bg-white dark:bg-[#111111]`}>
              {actions.length === 0 ? (
                <p className={`text-xs text-muted-foreground dark:text-gray-400 text-center py-4`}>
                  Nenhuma ação adicionada. Clique em "Adicionar ação" para começar.
                </p>
              ) : (
                actions.map((action) => (
                  <Card key={action.id} className={`border border-[#d4d4d4] dark:border-gray-700 rounded-none shadow-sm bg-white dark:bg-[#1b1b1b]`}>
                    <CardHeader className={`pb-3 bg-gray-50 dark:bg-[#1a1a1a] border-b border-[#d4d4d4] dark:border-gray-700 p-3 rounded-none`}>
                      <div className="flex items-center justify-between">
                        <CardTitle className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>Ação #{action.action_order + 1}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAction(action.id)}
                          className={`h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-none`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className={`space-y-3 p-3 bg-white dark:bg-[#1b1b1b]`}>
                      <div>
                        <Label className={`text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block`}>Tipo de ação</Label>
                        <Select
                          value={action.action_type}
                          onValueChange={(value) => updateAction(action.id, 'action_type', value)}
                        >
                          <SelectTrigger className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-gray-100 focus:ring-0`}>
                            <SelectValue placeholder="Selecione o tipo de ação" />
                          </SelectTrigger>
                          <SelectContent className={`rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`}>
                            {ACTION_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value} className={`text-xs rounded-none cursor-pointer text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]`}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {action.action_type && renderActionFields(action)}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className={`bg-gray-50 dark:bg-[#1a1a1a] border-t border-[#d4d4d4] dark:border-gray-700 p-4 m-0`}>
          <Button variant="outline" onClick={() => onOpenChange(false)} className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300`}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading} className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading ? "Salvando..." : automation ? "Atualizar" : "Criar"} Automação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

