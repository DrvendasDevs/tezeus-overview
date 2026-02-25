import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Bot, Upload, FileText, Trash2, TestTube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isReasoningEffortModel, type ReasoningEffort } from "@/lib/ai-models";

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
}

interface KnowledgeFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_processed: boolean;
}

interface ConfigurarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string | null;
  onAgentUpdated?: () => void;
  onClose?: () => void;
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

export function ConfigurarAgenteModal({
  open,
  onOpenChange,
  agentId,
  onAgentUpdated,
  onClose
}: ConfigurarAgenteModalProps) {
  const [activeTab, setActiveTab] = useState("geral");
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
  });

  useEffect(() => {
    if (open && agentId) {
      loadAgent();
      loadKnowledgeFiles();
    } else if (open && !agentId) {
      // Reset para novo agente
      setAgent({
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
      });
      setKnowledgeFiles([]);
    }
  }, [open, agentId]);

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
    if (!agentId) return;
    
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
      const agentData = {
        ...agent,
        temperature: isReasoningEffortModel(agent.model) ? 1 : agent.temperature,
        reasoning_effort: isReasoningEffortModel(agent.model) ? agent.reasoning_effort : null,
      };
      delete agentData.id;

      if (agentId) {
        // Atualizar agente existente
        const { error } = await supabase
          .from('ai_agents')
          .update(agentData)
          .eq('id', agentId);

        if (error) throw error;
        toast.success('Agente atualizado com sucesso!');
      } else {
        // Criar novo agente
        const { data, error } = await supabase
          .from('ai_agents')
          .insert([agentData])
          .select()
          .single();

        if (error) throw error;
        setAgent(data);
        toast.success('Agente criado com sucesso!');
      }

      onAgentUpdated?.();
      onClose?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar agente:', error);
      toast.error('Erro ao salvar agente');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !agentId) return;

    const fileName = `${agentId}/${Date.now()}-${file.name}`;
    
    try {
      const { error: uploadError } = await supabase.storage
        .from('agent-knowledge')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('ai_agent_knowledge_files')
        .insert([{
          agent_id: agentId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
        }]);

      if (dbError) throw dbError;

      loadKnowledgeFiles();
      toast.success('Arquivo carregado com sucesso!');
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
    if (!testMessage.trim() || !agentId) return;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            {agentId ? 'Editar Agente IA' : 'Criar Novo Agente IA'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="avancado">Avançado</TabsTrigger>
            <TabsTrigger value="conhecimento">Conhecimento</TabsTrigger>
            <TabsTrigger value="teste">Teste</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 mt-4">
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Agente Ativo</Label>
                <Switch
                  id="active"
                  checked={agent.is_active}
                  onCheckedChange={(checked) => setAgent({ ...agent, is_active: checked })}
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
            </div>
          </TabsContent>

          <TabsContent value="avancado" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de IA</CardTitle>
                <CardDescription>Ajuste o comportamento da inteligência artificial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <p className="text-xs text-muted-foreground">
                        Define o esforço de raciocínio para modelos compatíveis.
                      </p>
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
                      <p className="text-xs text-muted-foreground">
                        Controla a criatividade das respostas (0 = conservador, 2 = criativo)
                      </p>
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

                <div className="space-y-2">
                  <Label htmlFor="delay">Delay de Resposta (ms)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={agent.response_delay_ms}
                    onChange={(e) => setAgent({ ...agent, response_delay_ms: parseInt(e.target.value) })}
                    min={0}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horário de Funcionamento</CardTitle>
                <CardDescription>Configure quando o agente deve estar ativo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="working-hours">Habilitar Horário de Funcionamento</Label>
                  <Switch
                    id="working-hours"
                    checked={agent.working_hours_enabled}
                    onCheckedChange={(checked) => setAgent({ ...agent, working_hours_enabled: checked })}
                  />
                </div>

                {agent.working_hours_enabled && (
                  <>
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

                    <div className="space-y-2">
                      <Label htmlFor="fallback">Mensagem Fora de Horário</Label>
                      <Textarea
                        id="fallback"
                        value={agent.fallback_message}
                        onChange={(e) => setAgent({ ...agent, fallback_message: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conhecimento" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Base de Conhecimento</CardTitle>
                <CardDescription>Carregue arquivos para treinar seu agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="knowledge-enabled">Habilitar Base de Conhecimento</Label>
                  <Switch
                    id="knowledge-enabled"
                    checked={agent.knowledge_base_enabled}
                    onCheckedChange={(checked) => setAgent({ ...agent, knowledge_base_enabled: checked })}
                  />
                </div>

                {agent.knowledge_base_enabled && agentId && (
                  <>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Arraste arquivos aqui ou clique para selecionar
                      </p>
                      <Input
                        type="file"
                        accept=".pdf,.txt,.docx,.md"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        Selecionar Arquivos
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Arquivos Carregados</Label>
                      {knowledgeFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum arquivo carregado</p>
                      ) : (
                        <div className="space-y-2">
                          {knowledgeFiles.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span className="text-sm">{file.file_name}</span>
                                <Badge variant={file.is_processed ? "default" : "secondary"}>
                                  {file.is_processed ? "Processado" : "Processando"}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteKnowledgeFile(file.id, file.file_path)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teste" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Testar Agente</CardTitle>
                <CardDescription>Envie uma mensagem para testar o comportamento do agente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-message">Mensagem de Teste</Label>
                  <Textarea
                    id="test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Digite uma mensagem para testar o agente"
                    rows={3}
                  />
                </div>

                <Button onClick={testAgent} disabled={testLoading || !testMessage.trim()}>
                  <TestTube className="w-4 h-4 mr-2" />
                  {testLoading ? 'Testando...' : 'Testar Agente'}
                </Button>

                {testResponse && (
                  <div className="space-y-2">
                    <Label>Resposta do Agente</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{testResponse}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Agente'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}