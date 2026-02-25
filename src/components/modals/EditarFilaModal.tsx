import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";
import { useQueueUsers } from "@/hooks/useQueueUsers";
import { AdicionarUsuarioFilaModal } from "./AdicionarUsuarioFilaModal";
import { QueueUsersList } from "./QueueUsersList";

interface Fila {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  color?: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  workspaces?: { name: string };
}

interface EditarFilaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: Fila | null;
  onSuccess: () => void;
}

interface AIAgent {
  id: string;
  name: string;
  is_active: boolean;
}

const distributionOptions = [
  { value: "sequencial", label: "Sequencial" },
  { value: "nao_distribuir", label: "Não distribuir" }
];
export function EditarFilaModal({ open, onOpenChange, fila, onSuccess }: EditarFilaModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dados");
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // Form state
  const [nome, setNome] = useState("");
  const [ordem, setOrdem] = useState("");
  const [distribuicao, setDistribuicao] = useState("");
  const [agenteId, setAgenteId] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const {
    users: queueUsers,
    loading: loadingUsers,
    loadQueueUsers,
    addUsersToQueue,
    removeUserFromQueue,
  } = useQueueUsers(fila?.id);

  const loadAIAgents = async () => {
    if (!fila?.workspace_id) return;
    
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('is_active', true)
        .eq('workspace_id', fila.workspace_id)
        .order('name');

      if (error) throw error;
      setAiAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    }
  };

  const resetForm = () => {
    setNome("");
    setOrdem("");
    setDistribuicao("");
    setAgenteId("");
    setWorkspaceName("");
    setActiveTab("dados");
  };

  const loadFilaData = async () => {
    if (fila) {
      setNome(fila.name);
      setOrdem(fila.order_position?.toString() || "");
      setDistribuicao(fila.distribution_type || "");
      setAgenteId(fila.ai_agent_id || "");
      
      // Se a fila já vem com o workspace, usar diretamente
      if (fila.workspaces?.name) {
        setWorkspaceName(fila.workspaces.name);
      } else if (fila.workspace_id) {
        // Fallback: buscar nome do workspace
        try {
          const { data, error } = await supabase
            .from('workspaces')
            .select('name')
            .eq('id', fila.workspace_id)
            .single();
          
          if (!error && data) {
            setWorkspaceName(data.name);
          }
        } catch (error) {
          console.error('Erro ao carregar workspace:', error);
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !fila) {
      toast.error("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('queues')
        .update({
          name: nome.trim(),
          order_position: ordem ? parseInt(ordem) : 0,
          distribution_type: distribuicao || 'aleatoria',
          ai_agent_id: agenteId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', fila.id);

      if (error) throw error;

      toast.success("Fila atualizada com sucesso!");
      onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar fila:', error);
      toast.error("Erro ao atualizar fila");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAIAgents();
      if (fila) {
        loadFilaData();
        loadQueueUsers();
      }
    } else {
      resetForm();
    }
  }, [open, fila]);

  // Carregar usuários sempre que a aba de usuários for aberta
  useEffect(() => {
    if (open && activeTab === "usuarios" && fila?.id) {
      loadQueueUsers();
    }
  }, [activeTab, open, fila?.id]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700 dark:bg-transparent">
            <DialogTitle className="text-white">Editar fila</DialogTitle>
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
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome da fila"
                    className="rounded-none text-sm border-gray-300 focus-visible:ring-primary dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace" className="text-gray-700 dark:text-gray-200">Empresa</Label>
                  <div className="relative">
                    <Input
                      id="workspace"
                      value={workspaceName}
                      disabled
                      className="pl-9 bg-muted cursor-not-allowed rounded-none text-sm dark:bg-[#1a1a1a] dark:text-gray-300"
                    />
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-200">Distribuição automática</Label>
                <Select value={distribuicao} onValueChange={setDistribuicao}>
                  <SelectTrigger className="w-full rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                    <SelectValue placeholder="Selecione a distribuição automática" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                    {distributionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
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
                    {aiAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </TabsContent>

            <TabsContent value="usuarios" className="space-y-4 mt-6">
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddUserModal(true)} className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar usuário à fila
                </Button>
              </div>

              <QueueUsersList 
                users={queueUsers}
                loading={loadingUsers}
                onRemoveUser={removeUserFromQueue}
              />
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={loading || !nome.trim()}
              className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdicionarUsuarioFilaModal
        open={showAddUserModal}
        onOpenChange={setShowAddUserModal}
        workspaceId={fila?.workspace_id}
        onAddUsers={addUsersToQueue}
        excludeUserIds={queueUsers.map(qu => qu.user_id)}
      />
    </>
  );
}
