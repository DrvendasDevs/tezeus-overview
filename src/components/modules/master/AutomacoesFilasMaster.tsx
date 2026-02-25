import { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Plus, ListOrdered, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdicionarFilaModal } from "../../modals/AdicionarFilaModal";
import { EditarFilaModal } from "../../modals/EditarFilaModal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSyncUserContext } from "@/hooks/useUserContext";

export interface AutomacoesFilasMasterRef {
  handleAddFila: () => void;
}

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
  user_count?: number;
}

export const AutomacoesFilasMaster = forwardRef<AutomacoesFilasMasterRef>((props, ref) => {
  // Sincroniza o contexto do usuário para auditoria
  useSyncUserContext();
  
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedFila, setSelectedFila] = useState<Fila | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredFilas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return filas;
    return filas.filter((fila) => {
      const nameMatch = (fila.name || "").toLowerCase().includes(term);
      const workspaceMatch = (fila.workspaces?.name || "").toLowerCase().includes(term);
      const idMatch = (fila.id || "").toLowerCase().includes(term);
      return nameMatch || workspaceMatch || idMatch;
    });
  }, [filas, searchTerm]);

  const totalCount = filteredFilas.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;
  const paginatedFilas = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFilas.slice(start, start + pageSize);
  }, [filteredFilas, page, pageSize]);

  const handleAddFila = () => {
    setShowAddModal(true);
  };

  useImperativeHandle(ref, () => ({
    handleAddFila
  }));

  const loadFilas = async () => {
    try {
      // Usar edge function com service_role para contornar RLS
      const { data, error } = await supabase.functions.invoke('get-queues-with-workspaces');

      if (error) {
        console.error('Erro ao carregar filas:', error);
        toast.error('Erro ao carregar filas');
        setLoading(false);
        return;
      }

      setFilas(data || []);
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
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
      {/* Excel-style Table */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar fila, empresa ou ID..."
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
        {loading ? (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            <div className="grid grid-cols-5 bg-[#f3f3f3] border-b border-[#d4d4d4] dark:bg-[#161616] dark:border-gray-700">
              {['Id', 'Nome', 'Usuários', 'Empresas', 'Ações'].map((header) => (
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
        ) : filas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <ListOrdered className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhuma fila encontrada</h3>
            <p className="text-gray-500 mb-4 dark:text-gray-400">
              Clique em "Adicionar fila" para criar sua primeira fila.
            </p>
            <Button 
              onClick={handleAddFila}
              className="h-7 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Adicionar fila
            </Button>
          </div>
        ) : filteredFilas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <ListOrdered className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhuma fila encontrada</h3>
            <p className="text-gray-500 mb-4 dark:text-gray-400">
              Tente ajustar o termo de busca.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            {/* Table Header */}
            <div className="grid grid-cols-5 bg-[#f3f3f3] border-b border-[#d4d4d4] sticky top-0 z-10 dark:bg-[#161616] dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Id
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Nome
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Usuários
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Empresas
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                Ações
              </div>
            </div>

            {/* Table Body */}
            {paginatedFilas.map((fila) => (
              <div
                key={fila.id}
                className="grid grid-cols-5 border-b border-[#d4d4d4] hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-900/60"
              >
                {/* Id */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] font-mono text-gray-600 dark:text-gray-400 dark:border-gray-700">
                  {fila.id.substring(0, 8)}
                </div>

                {/* Nome */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center gap-2 dark:border-gray-700 dark:text-gray-100">
                  <span className="font-medium">{fila.name}</span>
                </div>

                {/* Usuários */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 dark:text-gray-200">
                  {fila.user_count || 0}
                </div>

                {/* Empresas */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 dark:text-gray-200">
                  {fila.workspaces?.name || 'Sem empresa'}
                </div>

                {/* Ações */}
                <div className="px-3 py-2.5 text-xs flex items-center gap-1 dark:text-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditFila(fila)}
                    className="h-6 px-2 text-[10px] hover:bg-gray-200 dark:hover:bg-gray-800"
                    title="Editar"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFila(fila.id)}
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

      {!loading && filas.length > 0 && filteredFilas.length > 0 && (
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
});

AutomacoesFilasMaster.displayName = 'AutomacoesFilasMaster';
