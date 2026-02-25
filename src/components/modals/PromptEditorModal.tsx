import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptEditor, ActionBadge, PromptEditorRef } from "@/components/ui/prompt-editor";
import { removeDuplicateActions } from "@/lib/action-parser";
import { 
  Tag, 
  ArrowRightLeft, 
  Clock, 
  Phone, 
  ArrowRight, 
  Link2, 
  Shuffle,
  ListFilter,
  CheckSquare,
  Target
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { TagSelectorModal } from "./TagSelectorModal";
import { PipelineColumnSelectorModal } from "./PipelineColumnSelectorModal";
import { QueueSelectorModal } from "./QueueSelectorModal";
import { ConnectionSelectorModal } from "./ConnectionSelectorModal";
import { FunnelSelectorModal } from "./FunnelSelectorModal";
import { supabase } from "@/integrations/supabase/client";

interface PromptEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  workspaceId?: string;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  tag: string;
}

const actionButtons: ActionButton[] = [
  {
    id: "add-tag",
    label: "Escolher Etiqueta",
    icon: <Tag className="w-4 h-4" />,
    tag: '[id: ID_DA_TAG]',
  },
  {
    id: "transfer-queue",
    label: "Escolher Fila",
    icon: <ArrowRightLeft className="w-4 h-4" />,
    tag: '[id: ID_DA_FILA]',
  },
  {
    id: "transfer-connection",
    label: "Escolher Conexão",
    icon: <Shuffle className="w-4 h-4" />,
    tag: '[id: ID_DA_CONEXAO]',
  },
  {
    id: "transfer-crm-column",
    label: "Escolher Coluna",
    icon: <ArrowRight className="w-4 h-4" />,
    tag: '[id: ID_DA_COLUNA]',
  },
  {
    id: "send-funnel",
    label: "Escolher Funil",
    icon: <ListFilter className="w-4 h-4" />,
    tag: '[id: ID_DO_FUNIL]',
  },
  {
    id: "qualify-deal",
    label: "Qualificar cliente",
    icon: <CheckSquare className="w-4 h-4" />,
    tag: '',
  },
  {
    id: "opportunity-status",
    label: "Status Oportunidade",
    icon: <Target className="w-4 h-4" />,
    tag: '',
  },
];

// Função para fazer parsing de badges do prompt salvo
function parseBadgesFromPrompt(prompt: string): { text: string; badges: ActionBadge[] } {
  if (!prompt.includes("--- AÇÕES CONFIGURADAS ---")) {
    return { text: prompt, badges: [] };
  }

  const [textPart, actionsPart] = prompt.split("--- AÇÕES CONFIGURADAS ---");
  const text = textPart;
  const badges: ActionBadge[] = [];

  if (actionsPart) {
    const lines = actionsPart.split("\n").filter(line => line.trim().startsWith("["));
    lines.forEach((line, index) => {
      const match = line.match(/\[(.*?)\]/);
      if (match) {
        const content = match[1];
        let badge: ActionBadge | null = null;

        if (content.startsWith("Adicionar Tag: ")) {
          const tagName = content.replace("Adicionar Tag: ", "");
          badge = {
            id: `add-tag-${Date.now()}-${index}`,
            type: "add-tag",
            label: content,
            data: { tagName },
            position: text.length,
          };
        } else if (content.startsWith("Criar Card CRM: ")) {
          const parts = content.replace("Criar Card CRM: ", "").split(" | ");
          badge = {
            id: `create-crm-card-${Date.now()}-${index}`,
            type: "create-crm-card",
            label: content,
            data: { pipelineName: parts[0], columnName: parts[1] },
            position: text.length,
          };
        } else if (content.startsWith("Transferir Coluna CRM: ")) {
          const columnName = content.replace("Transferir Coluna CRM: ", "");
          badge = {
            id: `transfer-crm-column-${Date.now()}-${index}`,
            type: "transfer-crm-column",
            label: content,
            data: { columnName },
            position: text.length,
          };
        } else {
          badge = {
            id: `action-${Date.now()}-${index}`,
            type: "generic",
            label: content,
            data: {},
            position: text.length,
          };
        }

        if (badge) badges.push(badge);
      }
    });
  }

  return { text, badges };
}

// Função para formatar o preview do prompt para exibição no textarea
export function formatPromptPreview(prompt: string): string {
  if (!prompt) return "";
  
  const parsed = parseBadgesFromPrompt(prompt);
  let preview = parsed.text;
  
  // Adicionar badges formatados no final
  if (parsed.badges.length > 0) {
    preview += "\n\n--- AÇÕES CONFIGURADAS ---\n";
    parsed.badges.forEach((badge) => {
      preview += `\n[${badge.label}]`;
    });
  }
  
  return preview;
}

export function PromptEditorModal({
  open,
  onOpenChange,
  value,
  onChange,
  workspaceId,
}: PromptEditorModalProps) {
  const [localValue, setLocalValue] = useState("");
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showQueueSelector, setShowQueueSelector] = useState(false);
  const [showConnectionSelector, setShowConnectionSelector] = useState(false);
  const [showPipelineColumnSelector, setShowPipelineColumnSelector] = useState(false);
  const [showFunnelSelector, setShowFunnelSelector] = useState(false);
  const [showQualificationSelector, setShowQualificationSelector] = useState(false);
  const [qualificationSelection, setQualificationSelection] = useState<'qualified' | 'unqualified'>('qualified');
  const [showOpportunityStatusSelector, setShowOpportunityStatusSelector] = useState(false);
  const [opportunityStatusSelection, setOpportunityStatusSelection] = useState<'aberto' | 'ganho' | 'perda'>('aberto');
  const [pendingActionType, setPendingActionType] = useState<string | null>(null);
  const editorRef = useRef<PromptEditorRef>(null);

  const resolveIdToken = async (id: string) => {
    // Resolver o "tipo" do id pelo banco para reconstruir a badge (nome + cor + ícone)
    try {
      // 1) Tag
      const { data: tag } = await supabase
        .from('tags')
        .select('id, name')
        .eq('id', id)
        .maybeSingle();

      if (tag?.id) {
        return {
          label: `Etiqueta: ${tag.name}`,
          type: 'adicionar_tag',
          colorClass: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
        };
      }

      // 2) Fila
      const { data: queue } = await supabase
        .from('queues')
        .select('id, name')
        .eq('id', id)
        .maybeSingle();

      if (queue?.id) {
        return {
          label: `Fila: ${queue.name}`,
          type: 'transferir_fila',
          colorClass: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
        };
      }

      // 3) Conexão
      const { data: conn } = await supabase
        .from('connections')
        .select('id, instance_name')
        .eq('id', id)
        .maybeSingle();

      if (conn?.id) {
        return {
          label: `Conexão: ${conn.instance_name}`,
          type: 'transferir_conexao',
          colorClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
        };
      }

      // 4) Coluna (inclui pipeline)
      const { data: col } = await (supabase as any)
        .from('pipeline_columns')
        .select('id, name, pipeline_id, pipelines(name)')
        .eq('id', id)
        .maybeSingle();

      if (col?.id) {
        const pipelineName = Array.isArray(col?.pipelines) ? col.pipelines?.[0]?.name : col?.pipelines?.name;
        return {
          label: `Coluna: ${col.name}${pipelineName ? ` (${pipelineName})` : ''}`,
          type: 'transferir_coluna_crm',
          colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
        };
      }

      // 5) Funil (quick_funnels)
      const { data: funnel } = await (supabase as any)
        .from('quick_funnels')
        .select('id, title')
        .eq('id', id)
        .maybeSingle();

      if (funnel?.id) {
        return {
          label: `Funil: ${funnel.title}`,
          type: 'enviar_funil',
          colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
        };
      }

      return {
        label: `ID: ${id}`,
        type: 'id_token',
        colorClass: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      };
    } catch {
      return {
        label: `ID: ${id}`,
        type: 'id_token',
        colorClass: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      };
    }
  };

  // Sincronizar com o value quando o modal abre
  useEffect(() => {
    if (open) {
      setLocalValue(value || "");
    }
  }, [open, value]);

  const handleActionSelect = (action: ActionButton) => {
    // Ações que precisam de modal de seleção
    if (action.id === "add-tag") {
      setPendingActionType(action.id);
      setShowTagSelector(true);
      return;
    }

    if (action.id === "transfer-queue") {
      setPendingActionType(action.id);
      setShowQueueSelector(true);
      return;
    }

    if (action.id === "transfer-connection") {
      setPendingActionType(action.id);
      setShowConnectionSelector(true);
      return;
    }

    if (action.id === "transfer-crm-column") {
      setPendingActionType(action.id);
      setShowPipelineColumnSelector(true);
      return;
    }

    if (action.id === "send-funnel") {
      setPendingActionType(action.id);
      setShowFunnelSelector(true);
      return;
    }

    if (action.id === "qualify-deal") {
      setShowQualificationSelector(true);
      return;
    }

    if (action.id === "opportunity-status") {
      setShowOpportunityStatusSelector(true);
      return;
    }

    // Para outras ações genéricas (incluindo save-info), inserir texto diretamente
    const actionText = `\n${action.tag}\n`;
    editorRef.current?.insertText(actionText);
  };

  const handleTagSelected = (tagId: string, tagName: string) => {
    editorRef.current?.insertBadge({
      token: `[id: ${tagId}]`,
      label: `Etiqueta: ${tagName}`,
      type: 'adicionar_tag',
      colorClass: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
    });
    setShowTagSelector(false);
    setPendingActionType(null);
  };

  const handleQueueSelected = (queueId: string, queueName: string) => {
    editorRef.current?.insertBadge({
      token: `[id: ${queueId}]`,
      label: `Fila: ${queueName}`,
      type: 'transferir_fila',
      colorClass: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
    });
    setShowQueueSelector(false);
    setPendingActionType(null);
  };

  const handleConnectionSelected = (connectionId: string, connectionName: string) => {
    editorRef.current?.insertBadge({
      token: `[id: ${connectionId}]`,
      label: `Conexão: ${connectionName}`,
      type: 'transferir_conexao',
      colorClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    });
    setShowConnectionSelector(false);
    setPendingActionType(null);
  };

  const handlePipelineColumnSelected = (
    pipelineId: string, 
    pipelineName: string, 
    columnId: string, 
    columnName: string
  ) => {
    editorRef.current?.insertBadge({
      token: `[id: ${columnId}]`,
      label: `Coluna: ${columnName}${pipelineName ? ` (${pipelineName})` : ''}`,
      type: 'transferir_coluna_crm',
      colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
    });
    setShowPipelineColumnSelector(false);
    setPendingActionType(null);
  };

  const handleFunnelSelected = (funnelId: string, funnelTitle: string) => {
    editorRef.current?.insertBadge({
      token: `[id: ${funnelId}]`,
      label: `Funil: ${funnelTitle}`,
      type: 'enviar_funil',
      colorClass: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
    });
    setShowFunnelSelector(false);
    setPendingActionType(null);
  };

  const handleConfirmQualification = () => {
    // Agora deve inserir apenas o token de qualificação
    const actionText = `\n[${qualificationSelection}]\n`;
    editorRef.current?.insertText(actionText);
    setShowQualificationSelector(false);
  };

  const handleConfirmOpportunityStatus = () => {
    // Inserir token de status no formato [status:aberto], [status:ganho] ou [status:perda]
    editorRef.current?.insertBadge({
      token: `[status:${opportunityStatusSelection}]`,
      label: `Status: ${opportunityStatusSelection === 'aberto' ? 'Aberto' : opportunityStatusSelection === 'ganho' ? 'Ganho' : 'Perdido'}`,
      type: 'status_oportunidade',
      colorClass: opportunityStatusSelection === 'ganho' 
        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
        : opportunityStatusSelection === 'perda'
        ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
        : 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
    });
    setShowOpportunityStatusSelector(false);
  };

  const handleSave = () => {
    // Remover ações duplicadas antes de salvar
    const cleanedValue = removeDuplicateActions(localValue);
    onChange(cleanedValue);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalValue(value || "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border border-[#d4d4d4] shadow-lg sm:rounded-none bg-white dark:bg-[#0b0b0b] dark:border-gray-700 dark:text-gray-100">
        <DialogHeader className="mx-0 mt-0 px-6 py-4 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none flex-shrink-0 dark:border-gray-700">
          <DialogTitle className="text-white">Editor de Prompt com Ações</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0f0f0f]">
          {/* Editor Area with Context Menu */}
          <div className="flex-1 p-6 overflow-y-auto text-gray-900 dark:text-gray-100">
            <ContextMenu>
              <ContextMenuTrigger className="w-full">
                <PromptEditor
                  ref={editorRef}
                  value={localValue}
                  onChange={setLocalValue}
                  resolveIdToken={resolveIdToken}
                  placeholder="Digite o prompt do agente aqui... Clique com o botão direito para adicionar ações."
                  className="min-h-[400px]"
                />
              </ContextMenuTrigger>
              <ContextMenuContent className="w-64 bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-600 text-gray-900 dark:text-gray-100">
                {actionButtons.map((action) => (
                  <ContextMenuItem
                    key={action.id}
                    onClick={() => handleActionSelect(action)}
                    className="flex items-center gap-3 cursor-pointer focus:bg-[#e6f2ff] dark:focus:bg-gray-700 dark:text-gray-200"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary">
                      {action.icon}
                    </div>
                    <span className="dark:text-gray-200">{action.label}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuContent>
            </ContextMenu>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-background dark:bg-[#111111] dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-red-500 text-red-500 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Salvar Prompt
          </Button>
        </div>
      </DialogContent>

      <TagSelectorModal
        open={showTagSelector}
        onOpenChange={setShowTagSelector}
        onTagSelected={handleTagSelected}
        workspaceId={workspaceId}
      />

      <QueueSelectorModal
        open={showQueueSelector}
        onOpenChange={setShowQueueSelector}
        onQueueSelected={handleQueueSelected}
        workspaceId={workspaceId}
      />

      <ConnectionSelectorModal
        open={showConnectionSelector}
        onOpenChange={setShowConnectionSelector}
        onConnectionSelected={handleConnectionSelected}
        workspaceId={workspaceId}
      />

      <PipelineColumnSelectorModal
        open={showPipelineColumnSelector}
        onOpenChange={setShowPipelineColumnSelector}
        onColumnSelected={handlePipelineColumnSelected}
        workspaceId={workspaceId}
      />

      <FunnelSelectorModal
        open={showFunnelSelector}
        onOpenChange={setShowFunnelSelector}
        onFunnelSelected={handleFunnelSelected}
        workspaceId={workspaceId}
      />

      {/* Modal de qualificação */}
      <Dialog open={showQualificationSelector} onOpenChange={setShowQualificationSelector}>
        <DialogContent
          className="max-w-md border border-[#d4d4d4] shadow-lg sm:rounded-none bg-white dark:bg-[#0b0b0b] dark:border-gray-700 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmQualification();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Qualificar cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={qualificationSelection === 'qualified' ? 'default' : 'outline'}
                onClick={() => setQualificationSelection('qualified')}
                className="rounded-none"
              >
                Qualificado
              </Button>

              <Button
                type="button"
                variant={qualificationSelection === 'unqualified' ? 'default' : 'outline'}
                onClick={() => setQualificationSelection('unqualified')}
                className="rounded-none"
              >
                Não qualificado
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => setShowQualificationSelector(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="rounded-none" onClick={handleConfirmQualification}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Status Oportunidade */}
      <Dialog open={showOpportunityStatusSelector} onOpenChange={setShowOpportunityStatusSelector}>
        <DialogContent
          className="max-w-md border border-[#d4d4d4] shadow-lg sm:rounded-none bg-white dark:bg-[#0b0b0b] dark:border-gray-700 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirmOpportunityStatus();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Status da Oportunidade</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o status que será atribuído à oportunidade/negócio:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={opportunityStatusSelection === 'aberto' ? 'default' : 'outline'}
                onClick={() => setOpportunityStatusSelection('aberto')}
                className="rounded-none"
              >
                Aberto
              </Button>

              <Button
                type="button"
                variant={opportunityStatusSelection === 'ganho' ? 'default' : 'outline'}
                onClick={() => setOpportunityStatusSelection('ganho')}
                className={cn(
                  "rounded-none",
                  opportunityStatusSelection === 'ganho' && "bg-green-600 hover:bg-green-700"
                )}
              >
                Ganho
              </Button>

              <Button
                type="button"
                variant={opportunityStatusSelection === 'perda' ? 'default' : 'outline'}
                onClick={() => setOpportunityStatusSelection('perda')}
                className={cn(
                  "rounded-none",
                  opportunityStatusSelection === 'perda' && "bg-red-600 hover:bg-red-700"
                )}
              >
                Perdido
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={() => setShowOpportunityStatusSelector(false)}
              >
                Cancelar
              </Button>
              <Button type="button" className="rounded-none" onClick={handleConfirmOpportunityStatus}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
