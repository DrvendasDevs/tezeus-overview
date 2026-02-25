import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, Send, Upload, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isReasoningEffortModel, type ReasoningEffort } from "@/lib/ai-models";
import { logUpdate } from "@/utils/auditLog";

interface AIAgent {
  id: string;
  name: string;
  description: string;
  api_provider: string;
  model: string;
  system_instructions: string;
  temperature: number;
  reasoning_effort: ReasoningEffort | null;
  max_tokens: number;
  response_delay_ms: number;
  knowledge_base_enabled: boolean;
  auto_responses_enabled: boolean;
  working_hours_enabled: boolean;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[];
  fallback_message: string;
  is_active: boolean;
  api_key_encrypted?: string;
  split_responses: boolean;
  process_messages: boolean;
  disable_outside_platform: boolean;
  assign_responsible: boolean;
  ignore_interval: number;
  workspace_id?: string;
}

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_processed: boolean;
}

interface EditarAgenteProps {
  agentId: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

export function EditarAgente({ agentId }: EditarAgenteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const [agent, setAgent] = useState<AIAgent>({
    id: '',
    name: '',
    description: '',
    api_provider: 'openai',
    model: 'gpt-4o-mini',
    system_instructions: '',
    temperature: 0.7,
    reasoning_effort: null,
    max_tokens: 1000,
    response_delay_ms: 1000,
    knowledge_base_enabled: false,
    auto_responses_enabled: true,
    working_hours_enabled: false,
    working_hours_start: null,
    working_hours_end: null,
    working_days: [1, 2, 3, 4, 5],
    fallback_message: 'Desculpe, não estou disponível no momento.',
    is_active: true,
    api_key_encrypted: '',
    split_responses: true,
    process_messages: true,
    disable_outside_platform: false,
    assign_responsible: false,
    ignore_interval: 0,
  });

  useEffect(() => {
    loadAgent();
    loadKnowledgeFiles();
  }, [agentId]);

  useEffect(() => {
    if (!isReasoningEffortModel(agent.model)) {
      return;
    }
    if (!agent.reasoning_effort) {
      setAgent((prev) => ({ ...prev, reasoning_effort: "medium" }));
    }
  }, [agent.model, agent.reasoning_effort]);

  const loadAgent = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;
      if (data) setAgent(data);
    } catch (error) {
      console.error('Erro ao carregar agente:', error);
      toast.error('Erro ao carregar configurações do agente');
    }
  };

  const loadKnowledgeFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_knowledge_files')
        .select('*')
        .eq('agent_id', agentId);

      if (error) throw error;
      setKnowledgeFiles(data || []);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validar campos obrigatórios
      if (!agent.name.trim()) {
        toast.error('Nome do agente é obrigatório');
        return;
      }

      // Preparar dados para salvar
      const agentData = {
        ...agent,
        temperature: isReasoningEffortModel(agent.model) ? 1 : agent.temperature,
        reasoning_effort: isReasoningEffortModel(agent.model) ? agent.reasoning_effort : null,
      };
      delete agentData.id;

      // Validar horários de trabalho se habilitados
      if (agent.working_hours_enabled) {
        if (!agent.working_hours_start || !agent.working_hours_end) {
          toast.error('Horários de funcionamento são obrigatórios quando habilitados');
          return;
        }
        if (agent.working_days.length === 0) {
          toast.error('Pelo menos um dia da semana deve ser selecionado');
          return;
        }
      }

      // Garantir que working_days seja um array válido
      if (!Array.isArray(agentData.working_days)) {
        agentData.working_days = [1, 2, 3, 4, 5];
      }

      console.log('Dados sendo salvos:', agentData);

      const { error } = await supabase
        .from('ai_agents')
        .update(agentData)
        .eq('id', agentId);

      if (error) {
        console.error('Erro detalhado:', error);
        throw error;
      }
      
      // Registrar log de auditoria
      await logUpdate(
        'ai_agent',
        agentId,
        agent.name,
        null, // oldData não disponível
        { name: agent.name, model: agent.model, is_active: agent.is_active },
        agent.workspace_id
      );
      
      toast.success('Agente atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar agente:', error);
      toast.error(`Erro ao salvar agente: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validação de tamanho (máx 10MB)
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeInBytes) {
      toast.error('Arquivo muito grande. Tamanho máximo: 10MB');
      return;
    }

    const fileName = `${agentId}/${Date.now()}-${file.name}`;
    
    try {
      // 1. Extrair texto do arquivo usando edge function
      const formData = new FormData();
      formData.append('file', file);

      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        'extract-text-from-file',
        {
          body: formData,
        }
      );

      if (extractError) throw extractError;
      if (!extractData?.success) throw new Error(extractData?.error || 'Falha ao extrair texto do arquivo');

      const extractedText = extractData.text;

      // 2. Upload para Storage (mantém o arquivo físico)
      const { error: uploadError } = await supabase.storage
        .from('agent-knowledge')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 3. Salvar metadata + texto extraído na tabela
      const { error: dbError } = await supabase
        .from('ai_agent_knowledge_files')
        .insert([{
          agent_id: agentId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          content_extracted: extractedText,
          is_processed: true,
        }]);

      if (dbError) throw dbError;

      loadKnowledgeFiles();
      toast.success('Arquivo processado e carregado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao carregar arquivo');
    }
  };

  const deleteKnowledgeFile = async (fileId: string, filePath: string) => {
    try {
      await supabase.storage.from('agent-knowledge').remove([filePath]);
      await supabase.from('ai_agent_knowledge_files').delete().eq('id', fileId);
      
      loadKnowledgeFiles();
      toast.success('Arquivo removido com sucesso!');
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error);
      toast.error('Erro ao remover arquivo');
    }
  };

  const testAgent = async () => {
    if (!testMessage.trim()) return;

    setTestLoading(true);
    try {
      // Simular teste do agente
      setTestResponse(`Resposta simulada para: "${testMessage}"`);
      toast.success('Teste realizado com sucesso!');
    } catch (error) {
      console.error('Erro no teste:', error);
      toast.error('Erro ao testar agente');
    } finally {
      setTestLoading(false);
    }
  };

  const toggleWorkingDay = (day: number) => {
    const newDays = agent.working_days.includes(day)
      ? agent.working_days.filter(d => d !== day)
      : [...agent.working_days, day].sort();
    
    setAgent({ ...agent, working_days: newDays });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/?module=DSAgente')}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">{agent.name || 'Carregando...'}</h1>
              <p className="text-sm text-muted-foreground">Configuração do agente</p>
            </div>
          </div>
          <div className="ml-auto">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Formulário Principal - 70% */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Configurações Gerais */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>Informações básicas do agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Agente</Label>
                  <Input
                    id="name"
                    value={agent.name}
                    onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                    placeholder="Nome do agente"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={agent.description}
                  onChange={(e) => setAgent({ ...agent, description: e.target.value })}
                  placeholder="Descrição do agente"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={agent.api_key_encrypted || ''}
                    onChange={(e) => setAgent({ ...agent, api_key_encrypted: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delay">Delay de Resposta (ms)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={agent.response_delay_ms}
                    onChange={(e) => setAgent({ ...agent, response_delay_ms: parseInt(e.target.value) || 1000 })}
                    placeholder="1000"
                    min={0}
                    max={10000}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provedor de IA</Label>
                  <Select value={agent.api_provider} onValueChange={(value) => setAgent({ ...agent, api_provider: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select value={agent.model} onValueChange={(value) => setAgent({ ...agent, model: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instruções do Sistema</Label>
                <Textarea
                  id="instructions"
                  value={agent.system_instructions}
                  onChange={(e) => setAgent({ ...agent, system_instructions: e.target.value })}
                  placeholder="Instruções para o comportamento do agente"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações Avançadas */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Avançadas</CardTitle>
              <CardDescription>Parâmetros de IA e funcionamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  {isReasoningEffortModel(agent.model) ? (
                    <>
                      <Label>Esforço de Raciocínio</Label>
                      <Select
                        value={agent.reasoning_effort || "medium"}
                        onValueChange={(value) => setAgent({ ...agent, reasoning_effort: value as ReasoningEffort })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixo</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="high">Alto</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label>Temperatura: {agent.temperature}</Label>
                      <Slider
                        value={[agent.temperature]}
                        onValueChange={([value]) => setAgent({ ...agent, temperature: value })}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Máximo de Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    value={agent.max_tokens}
                    onChange={(e) => setAgent({ ...agent, max_tokens: parseInt(e.target.value) })}
                    min={1}
                    max={4000}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="split-responses">Dividir respostas em blocos</Label>
                  <Switch
                    id="split-responses"
                    checked={agent.split_responses}
                    onCheckedChange={(checked) => setAgent({ ...agent, split_responses: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="process-messages">Processar mensagens automaticamente</Label>
                  <Switch
                    id="process-messages"
                    checked={agent.process_messages}
                    onCheckedChange={(checked) => setAgent({ ...agent, process_messages: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="disable-outside">Desabilitar quando responder fora da plataforma</Label>
                  <Switch
                    id="disable-outside"
                    checked={agent.disable_outside_platform}
                    onCheckedChange={(checked) => setAgent({ ...agent, disable_outside_platform: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="assign-responsible">Responder tickets com responsável</Label>
                  <Switch
                    id="assign-responsible"
                    checked={agent.assign_responsible}
                    onCheckedChange={(checked) => setAgent({ ...agent, assign_responsible: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Agente Ativo</Label>
                  <Switch
                    id="active"
                    checked={agent.is_active}
                    onCheckedChange={(checked) => setAgent({ ...agent, is_active: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ignore-interval">Ignorar mensagens até X segundos</Label>
                  <Input
                    id="ignore-interval"
                    type="number"
                    value={agent.ignore_interval}
                    onChange={(e) => setAgent({ ...agent, ignore_interval: parseInt(e.target.value) || 0 })}
                    min={0}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-responses">Respostas Automáticas</Label>
                  <Switch
                    id="auto-responses"
                    checked={agent.auto_responses_enabled}
                    onCheckedChange={(checked) => setAgent({ ...agent, auto_responses_enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="working-hours">Horário de Funcionamento</Label>
                  <Switch
                    id="working-hours"
                    checked={agent.working_hours_enabled}
                    onCheckedChange={(checked) => setAgent({ ...agent, working_hours_enabled: checked })}
                  />
                </div>
              </div>

              {agent.working_hours_enabled && (
                <div className="space-y-4 border-l-2 pl-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-time">Horário de Início</Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={agent.working_hours_start || '08:00'}
                        onChange={(e) => setAgent({ ...agent, working_hours_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-time">Horário de Fim</Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={agent.working_hours_end || '18:00'}
                        onChange={(e) => setAgent({ ...agent, working_hours_end: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dias da Semana</Label>
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map((day) => (
                        <Badge
                          key={day.value}
                          variant={agent.working_days.includes(day.value) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleWorkingDay(day.value)}
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Base de Conhecimento */}
          <Card>
            <CardHeader>
              <CardTitle>Base de Conhecimento</CardTitle>
              <CardDescription>Arquivos para treinar o agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="knowledge-base">Habilitar Base de Conhecimento</Label>
                <Switch
                  id="knowledge-base"
                  checked={agent.knowledge_base_enabled}
                  onCheckedChange={(checked) => setAgent({ ...agent, knowledge_base_enabled: checked })}
                />
              </div>

              {agent.knowledge_base_enabled && (
                <div className="space-y-4 border-l-2 pl-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".txt,.pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Carregar Arquivo
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {knowledgeFiles.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{file.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.file_size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKnowledgeFile(file.id, file.file_path)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel de Teste - 30% */}
        <div className="w-96 border-l bg-muted/20 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Testar Agente</h3>
            <p className="text-sm text-muted-foreground">Teste o comportamento do agente</p>
          </div>
          
          <div className="flex-1 p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-message">Mensagem de Teste</Label>
              <Textarea
                id="test-message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Digite uma mensagem para testar..."
                rows={3}
              />
            </div>
            
            <Button 
              onClick={testAgent} 
              disabled={testLoading || !testMessage.trim()}
              className="w-full"
            >
              {testLoading ? 'Testando...' : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Teste
                </>
              )}
            </Button>

            {testResponse && (
              <div className="space-y-2">
                <Label>Resposta do Agente</Label>
                <div className="p-3 border rounded-lg bg-background">
                  <p className="text-sm">{testResponse}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}