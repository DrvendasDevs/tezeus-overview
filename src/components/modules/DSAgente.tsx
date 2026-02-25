import { useState, useEffect } from "react";
import { Bot, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CriarAgenteModal } from "../modals/CriarAgenteModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
}

export function DSAgente() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar agentes:', error);
        toast.error('Erro ao carregar agentes');
        return;
      }

      setAgents(data || []);
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
      toast.error('Erro ao carregar agentes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId);

      if (error) {
        console.error('Erro ao deletar agente:', error);
        toast.error('Erro ao deletar agente');
        return;
      }

      toast.success('Agente deletado com sucesso');
      loadAgents();
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      toast.error('Erro ao deletar agente');
    }
  };

  const handleAddAgent = () => {
    setShowCreateModal(true);
  };

  const handleEditAgent = (agentId: string) => {
    // Navegar para página de edição
    window.location.hash = `#editar-agente/${agentId}`;
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    loadAgents();
  };

  useEffect(() => {
    loadAgents();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Carregando agentes...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agentes de IA</h1>
            <p className="text-muted-foreground">Configure e gerencie seus agentes de IA</p>
          </div>
        </div>
        <Button onClick={handleAddAgent} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Agente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agentes Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum agente cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro agente de IA para começar a automatizar conversas
              </p>
              <Button onClick={handleAddAgent}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Agente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Máximo Tokens Resposta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        {agent.description && (
                          <div className="text-sm text-muted-foreground">
                            {agent.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{agent.max_tokens}</TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? "default" : "secondary"}>
                        {agent.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAgent(agent.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CriarAgenteModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onAgentCreated={handleCreateModalClose}
      />
    </div>
  );
}