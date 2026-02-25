import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AdicionarUsuarioFilaModal } from "./AdicionarUsuarioFilaModal";
import { QueueUsersList } from "./QueueUsersList";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuth } from "@/hooks/useAuth";
interface AdicionarFilaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
interface AIAgent {
  id: string;
  name: string;
  is_active: boolean;
}
const distributionOptions = [{
  value: "sequencial",
  label: "Sequencial"
}, {
  value: "nao_distribuir",
  label: "Não distribuir"
}];
export function AdicionarFilaModal({
  open,
  onOpenChange,
  onSuccess
}: AdicionarFilaModalProps) {
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    user
  } = useAuth();
  const {
    workspaces
  } = useWorkspaces();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [showError, setShowError] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [queueUsers, setQueueUsers] = useState<Array<{
    id: string;
    queue_id: string;
    user_id: string;
    order_position: number;
    created_at: string;
    system_users?: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      profile: string;
    };
  }>>([]);

  // Form state
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("");
  const [distribuicao, setDistribuicao] = useState("");
  const [agenteId, setAgenteId] = useState("");
  const [mensagemSaudacao, setMensagemSaudacao] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const loadAIAgents = async () => {
    try {
      const workspaceToUse = selectedWorkspaceId || selectedWorkspace?.workspace_id;
      if (!workspaceToUse) {
        setAiAgents([]);
        return;
      }

      const {
        data,
        error
      } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('workspace_id', workspaceToUse)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setAiAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      setAiAgents([]);
    }
  };
  const resetForm = () => {
    setNome("");
    setOrdem("");
    setDistribuicao("");
    setAgenteId("");
    setMensagemSaudacao("");
    setSelectedWorkspaceId("");
    setActiveTab("dados");
    setShowError(false);
    setQueueUsers([]);
  };
  const handleSubmit = async () => {
    if (!nome.trim()) {
      setShowError(true);
      toast.error("Nome é obrigatório");
      return;
    }
    const workspaceToUse = selectedWorkspaceId || selectedWorkspace?.workspace_id;
    if (!workspaceToUse) {
      toast.error("Selecione uma empresa");
      return;
    }
    setShowError(false);
    setLoading(true);
    try {
      const {
        data: newQueue,
        error
      } = await supabase.from('queues').insert({
        name: nome.trim(),
        description: mensagemSaudacao.trim() || null,
        order_position: ordem ? parseInt(ordem) : 0,
        distribution_type: distribuicao || 'aleatoria',
        ai_agent_id: agenteId || null,
        greeting_message: mensagemSaudacao.trim() || null,
        workspace_id: workspaceToUse,
        is_active: true
      }).select().single();
      if (error) throw error;

      // Adicionar usuários selecionados à fila
      if (newQueue && queueUsers.length > 0) {
        const queueUsersData = queueUsers.map(qu => ({
          queue_id: newQueue.id,
          user_id: qu.user_id,
          order_position: qu.order_position
        }));
        const {
          error: usersError
        } = await supabase.from('queue_users').insert(queueUsersData);
        if (usersError) {
          console.error('Erro ao adicionar usuários:', usersError);
          toast.error("Fila criada, mas houve erro ao adicionar usuários");
        }
      }
      toast.success("Fila criada com sucesso!");
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Erro ao criar fila:', error);
      toast.error("Erro ao criar fila");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open) {
      // Se há um workspace selecionado no contexto, pré-selecionar
      if (selectedWorkspace?.workspace_id) {
        setSelectedWorkspaceId(selectedWorkspace.workspace_id);
      }
    } else {
      resetForm();
    }
  }, [open, selectedWorkspace?.workspace_id]);

  // Recarregar agentes quando o workspace selecionado mudar
  useEffect(() => {
    if (open) {
      loadAIAgents();
    }
  }, [open, selectedWorkspaceId, selectedWorkspace?.workspace_id]);
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="px-4 py-2 bg-primary text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-transparent">
          <DialogTitle className="text-white">Adicionar fila</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-[#1a1a1a] rounded-none">
            <TabsTrigger value="dados" className="rounded-none data-[state=active]:bg-white data-[state=active]:text-primary dark:data-[state=active]:bg-[#111111] dark:data-[state=active]:text-gray-100">
              Dados da Fila
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="rounded-none data-[state=active]:bg-white data-[state=active]:text-primary dark:data-[state=active]:bg-[#111111] dark:data-[state=active]:text-gray-100">Usuários da Fila</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gray-700 dark:text-gray-200">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={e => {
                    setNome(e.target.value);
                    setShowError(false);
                  }}
                  placeholder="Nome da fila"
                  className={`rounded-none text-sm ${
                    showError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-300 focus-visible:ring-primary"
                  } dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100`}
                />
                {showError && <span className="text-xs text-red-500 dark:text-red-400">Nome é obrigatório</span>}
              </div>

              {user?.profile === 'master' && <div className="space-y-2">
                  <Label htmlFor="workspace" className="text-gray-700 dark:text-gray-200">
                    Empresa <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                    <SelectTrigger id="workspace" className="w-full rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                      <SelectValue placeholder="Selecione a empresa">
                        {selectedWorkspaceId && workspaces.find(w => w.workspace_id === selectedWorkspaceId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                      {workspaces.map(workspace => <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {workspace.name}
                          </div>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>}

            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-200">Distribuição automática</Label>
              <Select value={distribuicao} onValueChange={setDistribuicao}>
                <SelectTrigger className="w-full rounded-none bg-warning/10 border-warning/20 dark:bg-[#1a1a1a] dark:border-warning/30 dark:text-gray-100">
                  <SelectValue placeholder="Selecione a distribuição automática" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                  {distributionOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-200">Agentes de IA</Label>
              <Select value={agenteId} onValueChange={setAgenteId}>
                <SelectTrigger className="w-full rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="Selecione um agente" />
                  
                </SelectTrigger>
                <SelectContent className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                  {aiAgents.map(agent => <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            
          </TabsContent>

            <TabsContent value="usuarios" className="space-y-4 mt-6">
            <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddUserModal(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-none">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar usuário à fila
                </Button>
              </div>

              <QueueUsersList users={queueUsers} onRemoveUser={userId => {
              setQueueUsers(prev => prev.filter(qu => qu.user_id !== userId));
            }} />
            </TabsContent>
        </Tabs>

          <div className="flex justify-end space-x-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !nome.trim()} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
              {loading ? "Criando..." : "Adicionar"}
            </Button>
          </div>
      </DialogContent>
    </Dialog>

    <AdicionarUsuarioFilaModal open={showAddUserModal} onOpenChange={setShowAddUserModal} workspaceId={selectedWorkspaceId || selectedWorkspace?.workspace_id} onAddUsers={async userIds => {
      // Buscar os dados dos usuários do workspace
      const {
        data: usersData
      } = await supabase.from('system_users').select('id, name, email, avatar, profile').in('id', userIds);
      const newUsers = userIds.map((userId, index) => {
        const userData = usersData?.find(u => u.id === userId);
        return {
          id: `temp-${userId}`,
          // ID temporário
          queue_id: '',
          // Será preenchido ao criar a fila
          user_id: userId,
          order_position: queueUsers.length + index,
          created_at: new Date().toISOString(),
          system_users: userData ? {
            id: userData.id,
            name: userData.name || '',
            email: userData.email || '',
            avatar: userData.avatar,
            profile: userData.profile || 'user'
          } : undefined
        };
      });
      setQueueUsers(prev => [...prev, ...newUsers]);
      setShowAddUserModal(false);
    }} excludeUserIds={queueUsers.map(qu => qu.user_id)} />
    </>;
}