import { useState, useEffect, useRef } from 'react';
import { 
  FlaskConical, 
  Send, 
  Trash2, 
  Play, 
  User, 
  Bot,
  Tag,
  ArrowRight,
  Plus,
  Save,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Settings2,
  Columns,
  Users,
  Calendar,
  GitBranch,
  UserCheck,
  Smartphone,
  Settings,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLabSession, LabMessage, LabActionLog } from '@/hooks/useLabSession';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIAgent {
  id: string;
  name: string;
  workspace_id: string;
  workspaces?: { name: string };
}

interface Connection {
  id: string;
  instance_name: string;
  phone_number: string;
  status: string;
  workspace_id: string;
  workspaces?: { name: string };
  metadata?: {
    id?: string;
    token?: string;
    instanceId?: string;
    instanceToken?: string;
  };
  default_pipeline_id?: string;
  default_column_id?: string;
  queue_id?: string;
}

// Mapeamento de tipos de ação para ícones e labels
const actionConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  'add-tag': { icon: <Tag className="w-3.5 h-3.5" />, label: 'Adicionar Tag', color: 'text-blue-500' },
  'remove-tag': { icon: <Tag className="w-3.5 h-3.5" />, label: 'Remover Tag', color: 'text-orange-500' },
  'transfer-queue': { icon: <Users className="w-3.5 h-3.5" />, label: 'Transferir Fila', color: 'text-purple-500' },
  'transfer-column': { icon: <Columns className="w-3.5 h-3.5" />, label: 'Mover Coluna', color: 'text-indigo-500' },
  'create-card': { icon: <Plus className="w-3.5 h-3.5" />, label: 'Criar Card', color: 'text-green-500' },
  'save-info': { icon: <Save className="w-3.5 h-3.5" />, label: 'Salvar Info', color: 'text-cyan-500' },
  'set-status': { icon: <Settings2 className="w-3.5 h-3.5" />, label: 'Status Oportunidade', color: 'text-amber-500' },
  'qualify-contact': { icon: <UserCheck className="w-3.5 h-3.5" />, label: 'Qualificar', color: 'text-emerald-500' },
  'schedule-activity': { icon: <Calendar className="w-3.5 h-3.5" />, label: 'Agendar Atividade', color: 'text-pink-500' },
  'send-funnel': { icon: <GitBranch className="w-3.5 h-3.5" />, label: 'Enviar Funil', color: 'text-violet-500' },
  'assign-user': { icon: <User className="w-3.5 h-3.5" />, label: 'Atribuir Responsável', color: 'text-teal-500' },
};

function getActionConfig(type: string) {
  return actionConfig[type] || { 
    icon: <ArrowRight className="w-3.5 h-3.5" />, 
    label: type, 
    color: 'text-gray-500' 
  };
}

function ActionItem({ action }: { action: LabActionLog }) {
  const config = getActionConfig(action.action_type);
  
  return (
    <div className="flex items-start gap-2 p-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {action.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
        {action.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
        {action.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("flex-shrink-0", config.color)}>
            {config.icon}
          </span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
            {config.label}
          </span>
        </div>
        
        {/* Params */}
        {action.action_params && Object.keys(action.action_params).length > 0 && (
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
            {Object.entries(action.action_params).map(([key, value]) => (
              <div key={key} className="truncate">
                <span className="font-medium">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        )}
        
        {/* Error Message */}
        {action.status === 'error' && action.error_message && (
          <div className="mt-1 text-[10px] text-red-500 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{action.error_message}</span>
          </div>
        )}
        
        {/* Timestamp */}
        {action.executed_at && (
          <div className="mt-1 text-[10px] text-gray-400">
            {format(new Date(action.executed_at), 'HH:mm:ss', { locale: ptBR })}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: LabMessage }) {
  const isUser = message.sender_type === 'user';
  
  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      
      <div className={cn(
        "max-w-[80%] rounded-lg px-3 py-2 text-xs",
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
      )}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        <div className={cn(
          "text-[10px] mt-1",
          isUser ? "text-primary-foreground/70" : "text-gray-400"
        )}>
          {format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}
        </div>
      </div>
      
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </div>
      )}
    </div>
  );
}

export function LaboratorioTab() {
  const {
    session,
    messages,
    actions,
    isLoading,
    isSending,
    isInitialized,
    startSession,
    sendMessage,
    clearHistory,
    endSession
  } = useLabSession();

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  
  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [messageInput, setMessageInput] = useState('');
  
  // Webhook settings
  const [savedWebhookUrl, setSavedWebhookUrl] = useState('');
  const [showWebhookEdit, setShowWebhookEdit] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionsEndRef = useRef<HTMLDivElement>(null);

  const activeAgent = session ? agents.find(agent => agent.id === session.agent_id) : null;
  const activeConnection = session ? connections.find(conn => conn.id === session.connection_id) : null;
  const activeWorkspaceName =
    activeConnection?.workspaces?.name ||
    activeAgent?.workspaces?.name ||
    'N/A';

  // Carregar URL do webhook salva
  useEffect(() => {
    async function loadWebhookUrl() {
      try {
        const { data, error } = await supabase
          .from('lab_settings')
          .select('value')
          .eq('key', 'default_webhook_url')
          .single();

        if (!error && data?.value) {
          setSavedWebhookUrl(data.value);
          setWebhookUrl(data.value);
        }
      } catch (error) {
        console.error('[Lab] Erro ao carregar webhook URL:', error);
      }
    }

    loadWebhookUrl();
  }, []);

  // Salvar URL do webhook
  const saveWebhookUrl = async () => {
    if (!webhookUrl.trim()) return;
    
    setSavingWebhook(true);
    try {
      const { error } = await supabase
        .from('lab_settings')
        .upsert({
          key: 'default_webhook_url',
          value: webhookUrl.trim(),
          description: 'URL padrão do webhook N8N para o laboratório'
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      
      setSavedWebhookUrl(webhookUrl.trim());
      setShowWebhookEdit(false);
      toast.success('Webhook URL salva com sucesso!');
    } catch (error: any) {
      console.error('[Lab] Erro ao salvar webhook URL:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSavingWebhook(false);
    }
  };

  // Carregar dados via RPC (bypass RLS)
  useEffect(() => {
    async function loadData() {
      console.log('[Lab] Carregando dados via RPC...');
      setLoadingAgents(true);
      setLoadingConnections(true);
      
      try {
        const { data, error } = await supabase.rpc('get_lab_data');

        if (error) {
          console.error('[Lab] Erro na RPC get_lab_data:', error);
          toast.error(`Erro ao carregar dados: ${error.message}`);
          setLoadingAgents(false);
          setLoadingConnections(false);
          return;
        }

        console.log('[Lab] Dados recebidos da RPC:', data);

        // Processar agentes
        const processedAgents = (data?.agents || []).map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          workspace_id: agent.workspace_id,
          workspaces: { name: agent.workspace_name || 'N/A' }
        }));
        console.log('[Lab] Agentes processados:', processedAgents.length);
        setAgents(processedAgents);

        // Processar conexões
        const processedConnections = (data?.connections || []).map((conn: any) => ({
          id: conn.id,
          instance_name: conn.instance_name,
          phone_number: conn.phone_number,
          status: conn.status,
          workspace_id: conn.workspace_id,
          metadata: conn.metadata,
          workspaces: { name: conn.workspace_name || 'N/A' },
          default_pipeline_id: conn.default_pipeline_id,
          default_column_id: conn.default_column_id,
          queue_id: conn.queue_id
        }));
        console.log('[Lab] Conexões processadas:', processedConnections.length);
        setConnections(processedConnections);

      } catch (error: any) {
        console.error('[Lab] Erro geral:', error);
        toast.error(`Erro: ${error.message}`);
      } finally {
        setLoadingAgents(false);
        setLoadingConnections(false);
      }
    }

    loadData();
  }, []);

  // Scroll para última mensagem/ação
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    actionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [actions]);

  // Iniciar sessão
  const handleStartSession = async () => {
    console.log('[Lab] handleStartSession chamado');
    console.log('[Lab] Estados:', {
      selectedAgentId,
      selectedConnectionId,
      contactPhone,
      webhookUrl,
      connectionsCount: connections.length
    });

    if (!selectedAgentId || !selectedConnectionId || !contactPhone || !webhookUrl) {
      console.log('[Lab] Campos faltando, abortando');
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Usar o workspace_id da conexão selecionada
    console.log('[Lab] Buscando conexão no array local:', selectedConnectionId);
    console.log('[Lab] Conexões disponíveis:', connections.map(c => ({ id: c.id, name: c.instance_name })));
    
    const connection = connections.find(c => c.id === selectedConnectionId);
    
    if (!connection) {
      console.error('[Lab] Conexão não encontrada no array local!');
      toast.error('Conexão não encontrada. Recarregue a página.');
      return;
    }

    console.log('[Lab] Conexão encontrada:', connection.instance_name, 'workspace:', connection.workspace_id);

    await startSession({
      agentId: selectedAgentId,
      workspaceId: connection.workspace_id,
      connectionId: selectedConnectionId,
      connectionData: {
        id: connection.id,
        instance_name: connection.instance_name,
        phone_number: connection.phone_number,
        workspace_id: connection.workspace_id,
        metadata: connection.metadata,
        default_pipeline_id: connection.default_pipeline_id,
        default_column_id: connection.default_column_id,
        queue_id: connection.queue_id
      },
      phone: contactPhone,
      name: contactName || 'Contato de Teste',
      webhookUrl
    });
  };

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageInput.trim() || isSending) return;
    
    const content = messageInput.trim();
    setMessageInput('');
    await sendMessage(content);
  };

  // Enter para enviar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Mostrar loading enquanto verifica sessão ativa
  if (!isInitialized) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-[#f3f3f3] dark:bg-[#0f0f0f]">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Laboratório de IA
            </h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Verificando sessão ativa...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-[#f3f3f3] dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Laboratório de IA
          </h1>
          <Badge variant="outline" className="text-[10px]">
            Beta
          </Badge>
        </div>
      </div>

      {/* Config Panel (se não tiver sessão ativa) */}
      {!session && (
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Agente */}
            <div className="space-y-1.5">
              <Label className="text-xs">Agente de IA</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar agente..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingAgents ? (
                    <div className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500">
                      Nenhum agente ativo
                    </div>
                  ) : (
                    agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id} className="text-xs">
                        {agent.name} ({agent.workspaces?.name || 'N/A'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Conexão */}
            <div className="space-y-1.5">
              <Label className="text-xs">Conexão WhatsApp</Label>
              <Select 
                value={selectedConnectionId} 
                onValueChange={setSelectedConnectionId}
                disabled={loadingConnections}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={
                    loadingConnections 
                      ? "Carregando..." 
                      : "Selecionar conexão..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {loadingConnections ? (
                    <div className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : connections.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500">
                      Nenhuma conexão ativa
                    </div>
                  ) : (
                    connections.map(conn => (
                      <SelectItem key={conn.id} value={conn.id} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {conn.instance_name} ({conn.workspaces?.name || 'N/A'})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Webhook N8N</Label>
                {savedWebhookUrl && !showWebhookEdit && (
                  <button
                    type="button"
                    onClick={() => setShowWebhookEdit(true)}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Editar
                  </button>
                )}
              </div>
              
              {!savedWebhookUrl || showWebhookEdit ? (
                <div className="flex gap-1">
                  <Input
                    type="url"
                    placeholder="https://n8n.../webhook/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveWebhookUrl}
                    disabled={!webhookUrl.trim() || savingWebhook}
                    className="h-8 px-2"
                  >
                    {savingWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ) : (
                <div className="h-8 px-3 py-2 border rounded-md bg-gray-50 dark:bg-[#1b1b1b] dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 truncate flex items-center">
                  {savedWebhookUrl}
                </div>
              )}
            </div>
          </div>

          {/* Segunda linha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Telefone */}
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone de Teste</Label>
              <Input
                type="text"
                placeholder="5521999999999"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Contato</Label>
              <Input
                type="text"
                placeholder="Contato de Teste"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Botão Iniciar */}
          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleStartSession}
              disabled={!selectedAgentId || !selectedConnectionId || !contactPhone || !webhookUrl || isLoading}
              className="h-8 px-4 text-xs"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              Iniciar Sessão
            </Button>
          </div>
        </div>
      )}

      {/* Session Info (se tiver sessão ativa) */}
      {session && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Sessão Ativa
              </Badge>
              <span className="text-gray-600 dark:text-gray-400">
                Telefone: <strong>{session.contact_phone}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Nome: <strong>{session.contact_name}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Workspace: <strong>{activeWorkspaceName}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Agente: <strong>{activeAgent?.name || 'N/A'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                disabled={isLoading}
                className="h-7 px-2 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={endSession}
                className="h-7 px-2 text-xs"
              >
                Encerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel (60%) */}
        <div className="flex-[3] flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!session ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Configure e inicie uma sessão para começar</p>
                </div>
              </div>
            ) : messages.length === 0 && !isSending ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Envie uma mensagem para testar o agente</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isSending && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <div className="max-w-[80%] rounded-lg px-3 py-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Processando resposta...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {session && (
            <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0a0a0a]">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  className="flex-1 text-xs resize-none min-h-[60px] bg-white dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                  className="h-[60px] px-4"
                >
                  {isSending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions Panel (40%) */}
        <div className="flex-[2] flex flex-col bg-gray-50 dark:bg-[#0a0a0a]">
          <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              Ações Executadas
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {!session ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400 p-4">
                  <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">As ações aparecerão aqui</p>
                </div>
              </div>
            ) : actions.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400 p-4">
                  <div className="relative w-8 h-8 mx-auto mb-2">
                    <span className="absolute inset-0 rounded-full border border-[#e85a0c]/50 animate-ping" />
                    <span className="absolute inset-1 rounded-full border border-[#e85a0c]/70 animate-ping [animation-delay:150ms]" />
                    <span className="absolute inset-2 rounded-full border border-[#e85a0c]/80" />
                    <span className="absolute inset-3 rounded-full bg-[#e85a0c]/80" />
                  </div>
                  <p className="text-xs">Aguardando ações do agente...</p>
                </div>
              </div>
            ) : (
              <>
                {actions.map(action => (
                  <ActionItem key={action.id} action={action} />
                ))}
                <div ref={actionsEndRef} />
              </>
            )}
          </div>
          
          {/* Stats */}
          {session && actions.length > 0 && (
            <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111]">
              <div className="flex items-center justify-around text-[10px]">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{actions.filter(a => a.status === 'success').length}</div>
                  <div className="text-gray-500">Sucesso</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{actions.filter(a => a.status === 'error').length}</div>
                  <div className="text-gray-500">Erros</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
