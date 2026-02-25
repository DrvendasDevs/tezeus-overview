import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Eye, EyeOff, FileText, Trash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { logUpdate } from "@/utils/auditLog";
import { PromptEditorModal } from "./PromptEditorModal";
import { ActionPreviewDisplay } from "@/components/ui/action-preview-display";
import { useQueryClient } from '@tanstack/react-query';
import { generateRandomId } from "@/lib/generate-random-id";
import { isReasoningEffortModel, type ReasoningEffort } from "@/lib/ai-models";

interface EditarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onAgentUpdated?: () => void;
}

interface FormData {
  workspace_id: string;
  name: string;
  api_key: string;
  model: string;
  system_instructions: string;
  temperature: number;
  reasoning_effort: ReasoningEffort | null;
  max_tokens: number;
  max_messages: number;
  response_delay: number;
  ignore_interval: number;
  assign_responsible: boolean;
  split_responses: boolean;
  disable_outside_platform: boolean;
  is_active: boolean;
  configure_commands: string;
}

export function EditarAgenteModal({
  open,
  onOpenChange,
  agentId,
  onAgentUpdated
}: EditarAgenteModalProps) {
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const { workspaces } = useWorkspaces();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    workspace_id: '',
    name: '',
    api_key: '',
    model: 'gpt-4o',
    system_instructions: '',
    temperature: 0.3,
    reasoning_effort: null,
    max_tokens: 2000,
    max_messages: 300,
    response_delay: 15,
    ignore_interval: 0,
    assign_responsible: false,
    split_responses: true,
    disable_outside_platform: false,
    is_active: true,
    configure_commands: `[REGRAS DE INTERPRETAÇÃO DE COMANDOS - FORMATO COLCHETES]

Os comandos agora virão no formato de colchetes com instruções claras para o agente.

Sua tarefa é interpretar os comandos no formato especificado abaixo e executar as ações correspondentes.

---

📋 MAPEAMENTO DE AÇÕES:

1️⃣ Adicionar Tag:
Formato: [ENVIE PARA O TOOL \`inserir-tag\` (METODO POST) o id: UUID_DA_TAG]
Exemplo: [ENVIE PARA O TOOL \`inserir-tag\` (METODO POST) o id: 123e4567-e89b-12d3-a456-426614174000]

2️⃣ Transferir Fila:
Formato: [ENVIE PARA O TOOL \`transferir-fila\` (METODO POST) o id: UUID_DA_FILA]
Exemplo: [ENVIE PARA O TOOL \`transferir-fila\` (METODO POST) o id: 456e7890-e89b-12d3-a456-426614174111]

3️⃣ Transferir Conexão:
Formato: [ENVIE PARA O TOOL \`transferir-conexao\` (METODO POST) o id: UUID_DA_CONEXAO]
Exemplo: [ENVIE PARA O TOOL \`transferir-conexao\` (METODO POST) o id: 789e0123-e89b-12d3-a456-426614174222]

4️⃣ Criar Card CRM:
Formato: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Formato com título: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA com o title TÍTULO_DO_CARD]
Exemplo: [ENVIE PARA O TOOL \`criar-card\` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: ghi-456-jkl com o title Novo Lead]

5️⃣ Transferir Card para Coluna (CRM):
Formato: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Exemplo: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: xyz-789-uvw]

6️⃣ Transferir Coluna do CRM (genérico):
Formato: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) movendo o card atual para a coluna_id: UUID_DA_COLUNA dentro do pipeline_id: UUID_DO_PIPELINE]
Exemplo: [ENVIE PARA O TOOL \`transferir-coluna\` (METODO POST) movendo o card atual para a coluna_id: xyz-789-uvw dentro do pipeline_id: abc-123-def]

7️⃣ Salvar Informações Adicionais:
Formato: [ENVIE PARA O TOOL \`info-adicionais\` (METODO POST) o id: UUID_DA_INFO e o valor VALOR_CORRESPONDENTE]
Exemplo: [ENVIE PARA O TOOL \`info-adicionais\` (METODO POST) o id: campo-empresa e o valor Tezeus Tech]

8️⃣ Qualificar Cliente (Negócio):
Formato: [ENVIE PARA O TOOL \`qualificar-cliente\` (METODO POST) o workspace_id: WORKSPACE_ID e o card_id: ID_DO_CARD e o title QUALIFICADO_OU_DESQUALIFICADO]
Exemplo: [ENVIE PARA O TOOL \`qualificar-cliente\` (METODO POST) o workspace_id: 123e4567-e89b-12d3-a456-426614174000 e o card_id: 456e7890-e89b-12d3-a456-426614174111 e o title Qualificado]

---

✅ REGRAS CRÍTICAS:

1. NUNCA use JSON novamente
2. SEMPRE escreva os comandos nesse formato de colchetes
3. NUNCA misture texto conversacional com comandos
4. SEMPRE utilize IDs reais (UUIDs)
5. Se faltar parâmetro obrigatório, ignore a ação
6. Todos os UUIDs estão no formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
7. Use backticks (\`) para envolver os nomes das tools
8. Escreva METODO POST em maiúsculas
9. Use "o id:", "o pipeline_id:", "a coluna_id:", "o valor" conforme especificado

---

⚠️ TRATAMENTO DE ERROS:

- Se o formato do comando estiver incorreto, ignore o comando e continue o processamento
- Se o UUID não estiver no formato correto, ignore o comando
- Se faltar algum parâmetro obrigatório, ignore o comando e registre um erro no log
- NUNCA tente executar comandos com IDs inválidos ou inexistentes`,
  });

  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeFiles, setKnowledgeFiles] = useState<Array<{
    id: string;
    file_name: string;
    file_size: number;
    file_path: string;
  }>>([]);

  useEffect(() => {
    if (open && agentId) {
      loadAgentData();
      loadKnowledgeFiles();
    }
  }, [open, agentId]);

  useEffect(() => {
    if (!isReasoningEffortModel(formData.model)) {
      return;
    }
    if (!formData.reasoning_effort) {
      setFormData((prev) => ({ ...prev, reasoning_effort: "medium" }));
    }
  }, [formData.model, formData.reasoning_effort]);

  const loadAgentData = async () => {
    if (!agentId) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar agente:', error);
        toast.error(`Erro ao carregar agente: ${error.message}`);
        return;
      }

      if (!data) {
        console.error('Agente não encontrado:', agentId);
        toast.error('Agente não encontrado');
        return;
      }

      const loadedFormData = {
        workspace_id: data.workspace_id || '',
        name: data.name || '',
        api_key: data.api_key_encrypted || '',
        model: data.model || 'gpt-4o',
        system_instructions: data.system_instructions || '',
        temperature: data.temperature ?? 0.3,
        reasoning_effort: (data.reasoning_effort as ReasoningEffort | null) ?? null,
        max_tokens: data.max_tokens || 2000,
        max_messages: data.max_messages || 300,
        response_delay: (data.response_delay_ms || 15000) / 1000,
        ignore_interval: data.ignore_interval || 0,
        assign_responsible: data.assign_responsible || false,
        split_responses: data.split_responses ?? true,
        disable_outside_platform: data.disable_outside_platform || false,
        is_active: data.is_active ?? true,
        configure_commands: data.configure_commands || '',
      };

      setFormData(loadedFormData);
    } catch (error: any) {
      console.error('Exceção ao carregar agente:', error);
      toast.error('Erro ao carregar dados do agente');
    }
  };

  const loadKnowledgeFiles = async () => {
    if (!agentId) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_agent_knowledge_files')
        .select('id, file_name, file_size, file_path')
        .eq('agent_id', agentId);

      if (error) throw error;
      setKnowledgeFiles(data || []);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKnowledgeFile(file);
    }
  };

  const handleRemoveFile = () => {
    setKnowledgeFile(null);
  };

  const handleDeleteKnowledgeFile = async (fileId: string, filePath: string) => {
    try {
      // Deletar do storage
      const { error: storageError } = await supabase.storage
        .from('agent-knowledge')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Deletar do banco
      const { error: dbError } = await supabase
        .from('ai_agent_knowledge_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      toast.success('Arquivo excluído com sucesso');
      loadKnowledgeFiles();
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      toast.error('Erro ao excluir arquivo');
    }
  };

  const handleSave = async () => {
    if (!formData.workspace_id || !formData.name || !formData.api_key) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      // 1. Upload do arquivo de conhecimento (se houver novo)
      if (knowledgeFile) {
        // Validação de tamanho (máx 10MB)
        const maxSizeInBytes = 10 * 1024 * 1024;
        if (knowledgeFile.size > maxSizeInBytes) {
          toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
          setLoading(false);
          return;
        }

        const filePath = `${formData.workspace_id}/${agentId}/${knowledgeFile.name}`;
        
        // Extrair texto do arquivo usando edge function
        const uploadFormData = new FormData();
        uploadFormData.append('file', knowledgeFile);

        const { data: extractData, error: extractError } = await supabase.functions.invoke(
          'extract-text-from-file',
          {
            body: uploadFormData,
          }
        );

        if (extractError) throw extractError;
        if (!extractData?.success) throw new Error(extractData?.error || 'Falha ao extrair texto do arquivo');

        const extractedText = extractData.text;

        // Upload para Storage
        const { error: uploadError } = await supabase.storage
          .from('agent-knowledge')
          .upload(filePath, knowledgeFile, { upsert: true });

        if (uploadError) throw uploadError;

        // Salvar na tabela ai_agent_knowledge_files com texto extraído
        const knowledgeFileId = generateRandomId();
        const { error: fileError } = await supabase
          .from('ai_agent_knowledge_files')
          .insert([{
            id: knowledgeFileId,
            agent_id: agentId,
            file_name: knowledgeFile.name,
            file_path: filePath,
            file_type: knowledgeFile.type,
            file_size: knowledgeFile.size,
            content_extracted: extractedText,
            is_processed: true,
          }]);

        if (fileError) throw fileError;

        // Criar registro na documents_base (RAG) e disparar webhook via Edge Function (com logs no Supabase)
        try {
          const { data: ragData, error: ragError } = await supabase.functions.invoke('rag-webhook', {
            body: {
              workspace_id: formData.workspace_id,
              agent_id: agentId,
              knowledge_file_id: knowledgeFileId,
              text: extractedText,
              file_name: knowledgeFile.name,
              file_path: filePath,
            },
          });

          if (ragError) throw ragError;
          if (!ragData?.success) {
            throw new Error(ragData?.error || 'Falha ao processar RAG');
          }
        } catch (ragError) {
          console.error('Falha ao processar RAG (Edge Function):', ragError);
          // Não bloquear a edição do agente se o RAG falhar
        }
      }

      // 2. Atualizar agente no banco
      const { error } = await supabase
        .from('ai_agents')
        .update({
          workspace_id: formData.workspace_id,
          name: formData.name,
          api_key_encrypted: formData.api_key,
          model: formData.model,
          system_instructions: formData.system_instructions,
          temperature: isReasoningEffortModel(formData.model) ? 1 : formData.temperature,
          reasoning_effort: isReasoningEffortModel(formData.model) ? formData.reasoning_effort : null,
          max_tokens: formData.max_tokens,
          max_messages: formData.max_messages,
          response_delay_ms: formData.response_delay * 1000,
          ignore_interval: formData.ignore_interval,
          assign_responsible: formData.assign_responsible,
          split_responses: formData.split_responses,
          disable_outside_platform: formData.disable_outside_platform,
          is_active: formData.is_active,
          configure_commands: formData.configure_commands,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (error) throw error;

      // Registrar log de auditoria
      await logUpdate(
        'ai_agent',
        agentId,
        formData.name,
        null, // oldData não disponível
        { name: formData.name, model: formData.model, is_active: formData.is_active },
        formData.workspace_id
      );

      // Invalidar cache do workspace-agent para atualizar o botão
      queryClient.invalidateQueries({ queryKey: ['workspace-agent'] });

      toast.success('Agente atualizado com sucesso!');
      await loadKnowledgeFiles(); // Recarregar lista de arquivos
      setKnowledgeFile(null); // Limpar arquivo temporário
      onAgentUpdated?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao atualizar agente:', error);
      toast.error(error.message || 'Erro ao atualizar agente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 border border-[#d4d4d4] bg-white dark:bg-[#0b0b0b] dark:border-gray-700 shadow-sm rounded-none">
        <DialogHeader className="bg-primary dark:bg-[#0f0f0f] p-4 rounded-none m-0 border-b border-[#d4d4d4] dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-white dark:text-gray-100 text-base font-bold">
            Editar Agente de IA
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-4 p-6 bg-white dark:bg-[#0b0b0b]">
          {/* Workspace e Nome */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="workspace" className="text-xs font-medium text-gray-700 dark:text-gray-300">Empresa</Label>
              <Select value={formData.workspace_id} onValueChange={(value) => setFormData({ ...formData, workspace_id: value })}>
                <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200">
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.workspace_id} value={workspace.workspace_id} className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-gray-700 dark:text-gray-300">Nome do Agente</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do agente"
                className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
              />
            </div>
          </div>

          {/* Modelo */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs font-medium text-gray-700 dark:text-gray-300">Modelo OpenAI</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                  <SelectItem value="gpt-4.1-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1-mini</SelectItem>
                  <SelectItem value="gpt-3.5-turbo" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-3.5-turbo</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-0125" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-3.5-turbo-0125</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-1106" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-3.5-turbo-1106</SelectItem>
                  <SelectItem value="gpt-3.5-turbo-16k" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-3.5-turbo-16k</SelectItem>
                  <SelectItem value="gpt-4.1" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1</SelectItem>
                  <SelectItem value="gpt-4.1-2025-04-14" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4.1-mini-2025-04-14" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1-mini-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4.1-nano" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1-nano</SelectItem>
                  <SelectItem value="gpt-4.1-nano-2025-04-14" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4.1-nano-2025-04-14</SelectItem>
                  <SelectItem value="gpt-4o" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o</SelectItem>
                  <SelectItem value="gpt-4o-2024-05-13" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-2024-05-13</SelectItem>
                  <SelectItem value="gpt-4o-2024-08-06" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-2024-08-06</SelectItem>
                  <SelectItem value="gpt-4o-2024-11-20" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-2024-11-20</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-audio-preview</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2024-10-01" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-audio-preview-2024-10-01</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2024-12-17" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-audio-preview-2024-12-17</SelectItem>
                  <SelectItem value="gpt-4o-audio-preview-2025-06-03" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-audio-preview-2025-06-03</SelectItem>
                  <SelectItem value="gpt-4o-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini</SelectItem>
                  <SelectItem value="gpt-4o-mini-2024-07-18" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-2024-07-18</SelectItem>
                  <SelectItem value="gpt-4o-mini-audio-preview" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-audio-preview</SelectItem>
                  <SelectItem value="gpt-4o-mini-audio-preview-2024-12-17" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-audio-preview-2024-12-17</SelectItem>
                  <SelectItem value="gpt-4o-mini-search-preview" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-search-preview</SelectItem>
                  <SelectItem value="gpt-4o-mini-search-preview-2025-03-11" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-search-preview-2025-03-11</SelectItem>
                  <SelectItem value="gpt-4o-mini-transcribe" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-transcribe</SelectItem>
                  <SelectItem value="gpt-4o-mini-tts" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-mini-tts</SelectItem>
                  <SelectItem value="gpt-4o-search-preview" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-search-preview</SelectItem>
                  <SelectItem value="gpt-4o-search-preview-2025-03-11" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-search-preview-2025-03-11</SelectItem>
                  <SelectItem value="gpt-4o-transcribe" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-transcribe</SelectItem>
                  <SelectItem value="gpt-4o-transcribe-diarize" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-4o-transcribe-diarize</SelectItem>
                  <SelectItem value="gpt-5" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5</SelectItem>
                  <SelectItem value="gpt-5.1" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5.1</SelectItem>
                  <SelectItem value="gpt-5-2025-08-07" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-chat-latest" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-chat-latest</SelectItem>
                  <SelectItem value="gpt-5-codex" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-codex</SelectItem>
                  <SelectItem value="gpt-5-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-mini</SelectItem>
                  <SelectItem value="gpt-5-mini-2025-08-07" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-mini-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-nano" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-nano</SelectItem>
                  <SelectItem value="gpt-5-nano-2025-08-07" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-nano-2025-08-07</SelectItem>
                  <SelectItem value="gpt-5-pro" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-pro</SelectItem>
                  <SelectItem value="gpt-5-pro-2025-10-06" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-pro-2025-10-06</SelectItem>
                  <SelectItem value="gpt-5-search-api" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-search-api</SelectItem>
                  <SelectItem value="gpt-5-search-api-2025-10-14" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-5-search-api-2025-10-14</SelectItem>
                  <SelectItem value="gpt-audio" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-audio</SelectItem>
                  <SelectItem value="gpt-audio-2025-08-28" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-audio-2025-08-28</SelectItem>
                  <SelectItem value="gpt-audio-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-audio-mini</SelectItem>
                  <SelectItem value="gpt-audio-mini-2025-10-06" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-audio-mini-2025-10-06</SelectItem>
                  <SelectItem value="gpt-image-1" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-image-1</SelectItem>
                  <SelectItem value="gpt-image-1-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">gpt-image-1-mini</SelectItem>
                  <SelectItem value="o1" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o1</SelectItem>
                  <SelectItem value="o1-2024-12-17" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o1-2024-12-17</SelectItem>
                  <SelectItem value="o1-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o1-mini</SelectItem>
                  <SelectItem value="o1-mini-2024-09-12" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o1-mini-2024-09-12</SelectItem>
                  <SelectItem value="o3" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o3</SelectItem>
                  <SelectItem value="o3-2025-04-16" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o3-2025-04-16</SelectItem>
                  <SelectItem value="o3-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o3-mini</SelectItem>
                  <SelectItem value="o3-mini-2025-01-31" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o3-mini-2025-01-31</SelectItem>
                  <SelectItem value="o4-mini" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o4-mini</SelectItem>
                  <SelectItem value="o4-mini-2025-04-16" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">o4-mini-2025-04-16</SelectItem>
                  <SelectItem value="sora-2" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">sora-2</SelectItem>
                  <SelectItem value="sora-2-pro" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">sora-2-pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instruções do Sistema */}
          <div className="space-y-1.5">
            <Label htmlFor="system_instructions" className="text-xs font-medium text-gray-700 dark:text-gray-300">Instruções do Sistema (Prompt)</Label>
            <div 
              onClick={() => setShowPromptEditor(true)}
              className="min-h-[56px] max-h-28 overflow-hidden p-3 rounded-none border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {formData.system_instructions ? (
                <ActionPreviewDisplay value={formData.system_instructions} />
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Clique para editar o prompt com ações avançadas...
                </p>
              )}
            </div>
          </div>

          {/* Base de Conhecimento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Base de Conhecimento</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adicione arquivos (PDF, TXT, MD, etc.) para o agente usar como referência
            </p>
            
            <div className="space-y-3">
              {/* Arquivos existentes */}
              {knowledgeFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 dark:text-gray-400">Arquivos carregados</Label>
                  {knowledgeFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 p-3 border border-[#d4d4d4] dark:border-gray-700 rounded-none bg-[#f0f0f0] dark:bg-[#2d2d2d]">
                      <FileText className="h-5 w-5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{file.file_name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {(file.file_size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteKnowledgeFile(file.id, file.file_path)}
                        className="h-6 w-6 rounded-none hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <Trash className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload de novo arquivo */}
              {knowledgeFile ? (
                <div className="flex items-center gap-2 p-3 border border-[#d4d4d4] dark:border-gray-700 rounded-none bg-white dark:bg-[#2d2d2d]">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-xs truncate">{knowledgeFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-6 w-6 rounded-none hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#d4d4d4] dark:border-gray-700 rounded-none p-4 bg-[#f0f0f0] dark:bg-[#2d2d2d]">
                  <input
                    type="file"
                    id="knowledge-file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.txt,.md,.doc,.docx,.csv"
                  />
                  <label
                    htmlFor="knowledge-file"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <FileText className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Adicionar novo arquivo</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <hr className="my-4 border-[#d4d4d4] dark:border-gray-700" />

          {/* Configurações Avançadas */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Configurações Avançadas</Label>

            <div className="space-y-1.5">
              <Label htmlFor="api_key" className="text-xs font-medium text-gray-700 dark:text-gray-300">Token da API OpenAI</Label>
              <Input
                id="api_key"
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Insira o token da API"
                className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
              />
            </div>
            
            <div className="space-y-2">
              {isReasoningEffortModel(formData.model) ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Esforço de Raciocínio</Label>
                  <Select
                    value={formData.reasoning_effort || "medium"}
                    onValueChange={(value) => setFormData({ ...formData, reasoning_effort: value as ReasoningEffort })}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                      <SelectItem value="low" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">Baixo</SelectItem>
                      <SelectItem value="medium" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">Médio</SelectItem>
                      <SelectItem value="high" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Temperatura ({formData.temperature})</Label>
                  </div>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="max_tokens" className="text-xs font-medium text-gray-700 dark:text-gray-300">Máximo de Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max_messages" className="text-xs font-medium text-gray-700 dark:text-gray-300">Máx. Mensagens no Histórico</Label>
                <Input
                  id="max_messages"
                  type="number"
                  value={formData.max_messages}
                  onChange={(e) => setFormData({ ...formData, max_messages: parseInt(e.target.value) })}
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="response_delay" className="text-xs font-medium text-gray-700 dark:text-gray-300">Delay para responder (segundos)</Label>
                <Input
                  id="response_delay"
                  type="number"
                  value={formData.response_delay}
                  onChange={(e) => setFormData({ ...formData, response_delay: parseInt(e.target.value) })}
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ignore_interval" className="text-xs font-medium text-gray-700 dark:text-gray-300">Ignorar mensagens até X segundos</Label>
                <Input
                  id="ignore_interval"
                  type="number"
                  value={formData.ignore_interval}
                  onChange={(e) => setFormData({ ...formData, ignore_interval: parseInt(e.target.value) })}
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200 focus-visible:ring-1 focus-visible:ring-primary placeholder:!text-gray-400 dark:placeholder:!text-gray-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Dividir respostas em blocos</Label>
              <Switch
                checked={formData.split_responses}
                onCheckedChange={(checked) => setFormData({ ...formData, split_responses: checked })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Desabilitar quando responder fora da plataforma</Label>
              <Switch
                checked={formData.disable_outside_platform}
                onCheckedChange={(checked) => setFormData({ ...formData, disable_outside_platform: checked })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Responder tickets com responsável</Label>
              <Switch
                checked={formData.assign_responsible}
                onCheckedChange={(checked) => setFormData({ ...formData, assign_responsible: checked })}
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Agente Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                className="scale-75"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-7 px-4 text-xs rounded-none border-[#d4d4d4] bg-white hover:bg-gray-100 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading} className="h-7 px-4 text-xs rounded-none bg-primary hover:bg-primary/90">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>

      <PromptEditorModal
        open={showPromptEditor}
        onOpenChange={setShowPromptEditor}
        value={formData.system_instructions}
        onChange={(value) => setFormData({ ...formData, system_instructions: value })}
        workspaceId={formData.workspace_id}
      />
    </Dialog>
  );
}
