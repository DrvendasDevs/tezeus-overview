import { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from "react";
import { Bot, Plus, Edit, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CriarAgenteModal } from "../../modals/CriarAgenteModal";
import { EditarAgenteModal } from "../../modals/EditarAgenteModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSyncUserContext } from "@/hooks/useUserContext";
import { logDelete } from "@/utils/auditLog";

export interface DSAgenteMasterRef {
  handleAddAgent: () => void;
}

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  max_tokens: number;
  is_active: boolean;
  created_at: string;
  workspace_id?: string;
  workspace?: {
    id: string;
    name: string;
  };
}

export const DSAgenteMaster = forwardRef<DSAgenteMasterRef>(function DSAgenteMasterComponent(_, ref) {
  // Sincroniza o contexto do usuário para auditoria
  useSyncUserContext();
  
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => {
      const nameMatch = (agent.name || "").toLowerCase().includes(term);
      const workspaceMatch = (agent.workspace?.name || "").toLowerCase().includes(term);
      return nameMatch || workspaceMatch;
    });
  }, [agents, searchTerm]);

  const totalCount = filteredAgents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;
  const paginatedAgents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, page, pageSize]);

  const handleAddAgent = () => setShowCreateModal(true);

  useImperativeHandle(ref, () => ({
    handleAddAgent
  }));

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-agents-with-workspaces');
      if (error) {
        console.error('Erro ao carregar agentes:', error);
        toast.error('Erro ao carregar agentes');
        setIsLoading(false);
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
    if (!confirm('Tem certeza que deseja deletar este agente?')) return;
    try {
      // Buscar dados do agente antes de deletar para auditoria
      const { data: agentData } = await supabase
        .from('ai_agents')
        .select('name, workspace_id, model, is_active')
        .eq('id', agentId)
        .single();

      const { error } = await supabase.from('ai_agents').delete().eq('id', agentId);
      if (error) {
        console.error('Erro ao deletar agente:', error);
        toast.error('Erro ao deletar agente');
        return;
      }
      
      // Registrar auditoria
      await logDelete(
        'ai_agent',
        agentId,
        agentData?.name || 'Agente',
        agentData,
        agentData?.workspace_id
      );
      
      toast.success('Agente deletado com sucesso');
      loadAgents();
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      toast.error('Erro ao deletar agente');
    }
  };

  const handleEditAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    setShowEditModal(true);
  };

  const handleCreateModalClose = () => {
    setShowCreateModal(false);
    loadAgents();
  };

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar agente ou empresa..."
              className="h-8 pl-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200"
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
            <span>Linhas/página:</span>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) || 10)}>
              <SelectTrigger className="h-7 w-20 rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {isLoading ? (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            <div className="grid grid-cols-5 bg-[#f3f3f3] border-b border-[#d4d4d4] dark:bg-[#161616] dark:border-gray-700">
              {['Nome', 'Empresa', 'Máximo Tokens Resposta', 'Status', 'Ações'].map((header) => (
                <div key={header} className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] last:border-r-0 dark:text-gray-200 dark:border-gray-700">
                  {header}
                </div>
              ))}
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-5 border-b border-[#d4d4d4] animate-pulse dark:border-gray-700">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="px-3 py-2.5 border-r border-[#d4d4d4] last:border-r-0 dark:border-gray-700">
                    <div className="h-4 bg-gray-200 rounded dark:bg-gray-800" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <Bot className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhum agente cadastrado</h3>
            <p className="text-gray-500 mb-4 text-center max-w-md dark:text-gray-400">
              Crie seu primeiro agente de IA para começar a automatizar conversas
            </p>
            <Button onClick={handleAddAgent} className="h-7 px-3 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Criar Primeiro Agente
            </Button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <Bot className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhum agente encontrado</h3>
            <p className="text-gray-500 mb-4 text-center max-w-md dark:text-gray-400">
              Tente ajustar o termo de busca.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            <div className="grid grid-cols-5 bg-[#f3f3f3] border-b border-[#d4d4d4] sticky top-0 z-10 dark:bg-[#161616] dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">Nome</div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">Empresa</div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">Máximo Tokens Resposta</div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">Status</div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Ações</div>
            </div>

            {paginatedAgents.map((agent) => (
              <div key={agent.id} className="grid grid-cols-5 border-b border-[#d4d4d4] hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-900/60">
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700">
                  <div className="font-medium text-gray-800 dark:text-gray-100">{agent.name}</div>
                  {agent.description && (
                    <div className="text-[10px] text-gray-500 mt-0.5 dark:text-gray-400">{agent.description}</div>
                  )}
                </div>
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] text-gray-600 dark:text-gray-300 dark:border-gray-700">
                  {agent.workspace?.name || "-"}
                </div>
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] text-gray-800 dark:text-gray-200 dark:border-gray-700">
                  {agent.max_tokens}
                </div>
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center dark:border-gray-700">
                  <Badge
                    variant={agent.is_active ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5 dark:bg-green-600 dark:text-white"
                  >
                    {agent.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="px-3 py-2.5 text-xs flex items-center gap-1 dark:text-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditAgent(agent.id)}
                    className="h-6 px-2 text-[10px] hover:bg-gray-200 dark:hover:bg-gray-800"
                    title="Editar"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="h-6 px-2 text-[10px] hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-800"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isLoading && agents.length > 0 && filteredAgents.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
            <span>
              {startIndex}–{endIndex} de {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span>
                Página {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      <CriarAgenteModal open={showCreateModal} onOpenChange={setShowCreateModal} onAgentCreated={handleCreateModalClose} />

      <EditarAgenteModal
        open={showEditModal && !!selectedAgentId}
        onOpenChange={(open) => {
          setShowEditModal(open);
          if (!open) setSelectedAgentId(null);
        }}
        agentId={selectedAgentId || ""}
        onAgentUpdated={() => {
          setShowEditModal(false);
          setSelectedAgentId(null);
          loadAgents();
        }}
      />
    </div>
  );
});

DSAgenteMaster.displayName = "DSAgenteMaster";

