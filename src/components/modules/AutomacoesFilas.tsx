import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Plus, Search, Filter, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { toast } from "sonner";
import { AdicionarFilaModal } from "@/components/modals/AdicionarFilaModal";
import { EditarFilaModal } from "@/components/modals/EditarFilaModal";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Fila {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  order_position?: number;
  distribution_type?: string;
  ai_agent_id?: string;
  greeting_message?: string;
  workspace_id?: string;
  user_count?: number;
}

const distributionLabels: Record<string, string> = {
  sequencial: "Sequencial",
  nao_distribuir: "Não distribuir",
  aleatoria: "Aleatória",
};

const getDistributionLabel = (type?: string | null) => {
  if (!type) return "-";
  return distributionLabels[type] || type;
};

export function AutomacoesFilas() {
  const DEFAULT_PAGE_SIZE = 100;
  const MIN_PAGE_SIZE = 10;
  const { selectedWorkspace } = useWorkspace();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFila, setSelectedFila] = useState<Fila | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadFilas = async () => {
    if (!selectedWorkspace?.workspace_id) return;

    try {
      // Buscar filas
      const { data: queuesData, error: queuesError } = await supabase
        .from('queues')
        .select('*')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('created_at', { ascending: false });

      if (queuesError) throw queuesError;

      // Buscar contagem de usuários para cada fila usando a edge function
      const filasComContagem = await Promise.all(
        (queuesData || []).map(async (fila) => {
          try {
            const { data: usersData, error: usersError } = await supabase.functions.invoke(
              'manage-queue-users',
              {
                body: { action: 'list', queueId: fila.id },
                headers: getWorkspaceHeaders(selectedWorkspace?.workspace_id),
              }
            );

            if (usersError) {
              console.error(`❌ Erro ao buscar usuários da fila ${fila.name}:`, usersError);
              return { ...fila, user_count: 0 };
            }

            const userCount = usersData?.users?.length || 0;
            return { ...fila, user_count: userCount };
          } catch (err) {
            console.error(`❌ Erro ao processar fila ${fila.name}:`, err);
            return { ...fila, user_count: 0 };
          }
        })
      );

      setFilas(filasComContagem);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
      toast.error('Erro ao carregar filas');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFila = async (filaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fila?')) return;

    try {
      const { error } = await supabase
        .from('queues')
        .delete()
        .eq('id', filaId);

      if (error) throw error;
      
      toast.success('Fila excluída com sucesso');
      loadFilas();
    } catch (error) {
      console.error('Erro ao excluir fila:', error);
      toast.error('Erro ao excluir fila');
    }
  };

  const handleEditFila = (fila: Fila) => {
    setSelectedFila(fila);
    setShowEditModal(true);
  };

  useEffect(() => {
    loadFilas();
  }, [selectedWorkspace?.workspace_id]);

  const filteredFilas = filas.filter(fila => 
    fila.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fila.id && fila.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalCount = filteredFilas.length;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0f0f0f] dark:border-gray-700 dark:text-gray-100">
      {/* Excel-like Toolbar (Ribbon) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Filas de Atendimento
            </span>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* Search Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 dark:border-gray-700">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3 dark:text-gray-400" />
              <Input
                placeholder="Pesquisar fila..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[9px]">Nova Fila</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505] relative">
        <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
          <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 w-[80px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>ID</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Usuários</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Distribuição</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px] dark:border-gray-700 dark:text-gray-200">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr>
                  <td colSpan={5} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-400">
                    Carregando filas...
                  </td>
                </tr>
              ) : filteredFilas.length === 0 ? (
                 <tr>
                  <td colSpan={5} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-400">
                    Nenhuma fila encontrada.
                  </td>
                </tr>
              ) : (
                filteredFilas
                  .slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
                  .map((fila) => (
                  <tr key={fila.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                    <td className="border border-[#e0e0e0] px-2 py-0 font-mono text-[10px] align-middle text-muted-foreground dark:border-gray-700 dark:text-gray-400">
                      {fila.id.substring(0, 8)}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle dark:border-gray-700 dark:text-gray-100">
                      <div className="flex items-center">{fila.name}</div>
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700 dark:text-gray-100">
                      {fila.user_count || 0}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 max-w-[300px] truncate align-middle text-muted-foreground dark:border-gray-700 dark:text-gray-300">
                      {getDistributionLabel(fila.distribution_type)}
                    </td>
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1 h-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditFila(fila)}
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFila(fila.id)}
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#2a1f1f]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer fixo com paginação */}
        <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Linhas {startIndex}-{endIndex} de {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <span>Linhas/página:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-7 w-24 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["10", "25", "50", "100", "200"].map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                Anterior
              </button>
              <span>
                Página {page} / {totalPages}
              </span>
              <button
                className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      <AdicionarFilaModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => {
          setShowAddModal(false);
          loadFilas();
        }}
      />

      <EditarFilaModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        fila={selectedFila}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedFila(null);
          loadFilas();
        }}
      />
    </div>
  );
}
