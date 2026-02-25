import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ScrollText, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Building2, 
  Bot, 
  Wifi, 
  ListOrdered, 
  Workflow, 
  Users, 
  Trash2,
  Plus,
  Edit,
  Power,
  RefreshCw,
  X,
  Tag,
  Package,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useAuditLogs, 
  actionLabels, 
  entityTypeLabels, 
  getActionColor,
  type AuditLogsFilters 
} from '@/hooks/useAuditLogs';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { cn } from '@/lib/utils';

export function AuditLogsTab() {
  const { workspaces } = useWorkspaces();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  
  // Filtros
  const [filters, setFilters] = useState<AuditLogsFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Aplicar filtros
  const activeFilters = useMemo(() => ({
    ...filters,
    search: searchQuery || undefined,
    startDate: startDate ? startDate.toISOString() : undefined,
    endDate: endDate ? new Date(endDate.setHours(23, 59, 59, 999)).toISOString() : undefined,
  }), [filters, searchQuery, startDate, endDate]);

  const { data, isLoading, refetch, isFetching } = useAuditLogs(activeFilters, page, pageSize);

  const totalPages = Math.ceil((data?.count || 0) / pageSize);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'ai_agent': return <Bot className="w-3.5 h-3.5" />;
      case 'user': return <User className="w-3.5 h-3.5" />;
      case 'connection': return <Wifi className="w-3.5 h-3.5" />;
      case 'queue': return <ListOrdered className="w-3.5 h-3.5" />;
      case 'pipeline': return <Workflow className="w-3.5 h-3.5" />;
      case 'contact': return <Users className="w-3.5 h-3.5" />;
      case 'automation': return <RefreshCw className="w-3.5 h-3.5" />;
      case 'workspace': return <Building2 className="w-3.5 h-3.5" />;
      case 'tag': return <Tag className="w-3.5 h-3.5" />;
      case 'product': return <Package className="w-3.5 h-3.5" />;
      case 'quick_message': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'quick_audio': return <Mic className="w-3.5 h-3.5" />;
      case 'quick_media': return <Image className="w-3.5 h-3.5" />;
      case 'quick_document': return <FileText className="w-3.5 h-3.5" />;
      case 'quick_funnel': return <GitBranch className="w-3.5 h-3.5" />;
      default: return <ScrollText className="w-3.5 h-3.5" />;
    }
  };

  const getActionIcon = (action: string) => {
    const actionType = action.split('.')[1];
    switch (actionType) {
      case 'created': return <Plus className="w-3 h-3" />;
      case 'updated': return <Edit className="w-3 h-3" />;
      case 'deleted': return <Trash2 className="w-3 h-3" />;
      case 'connected':
      case 'disconnected':
      case 'status_changed': return <Power className="w-3 h-3" />;
      default: return null;
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setPage(1);
  };

  const hasActiveFilters = searchQuery || filters.workspaceId || filters.action || filters.entityType || startDate || endDate;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
      {/* Toolbar */}
      <div className="bg-[#f3f3f3] border-b border-[#d4d4d4] px-3 py-1.5 shrink-0 dark:bg-[#0f0f0f] dark:border-gray-700">
        <div className="flex w-full items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-gray-500" />
            <Input
              type="text"
              placeholder="Buscar por entidade ou usuário..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-7 h-7 text-xs bg-white border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          <div className="h-4 w-px bg-gray-300 mx-1 dark:bg-gray-700" />

          {/* Filtro por Workspace */}
          <Select 
            value={filters.workspaceId || 'all'} 
            onValueChange={(value) => {
              setFilters(prev => ({ ...prev, workspaceId: value === 'all' ? undefined : value }));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[180px] text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a]">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Todas empresas" />
            </SelectTrigger>
            <SelectContent className="rounded-none dark:bg-[#1a1a1a] dark:border-gray-700">
              <SelectItem value="all" className="text-xs">Todas empresas</SelectItem>
              {workspaces.map(w => (
                <SelectItem key={w.workspace_id} value={w.workspace_id} className="text-xs">
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Tipo de Recurso */}
          <Select 
            value={filters.entityType || 'all'} 
            onValueChange={(value) => {
              setFilters(prev => ({ ...prev, entityType: value === 'all' ? undefined : value }));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[150px] text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a]">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="rounded-none dark:bg-[#1a1a1a] dark:border-gray-700">
              <SelectItem value="all" className="text-xs">Todos os recursos</SelectItem>
              <SelectItem value="ai_agent" className="text-xs">Agente IA</SelectItem>
              <SelectItem value="user" className="text-xs">Usuário</SelectItem>
              <SelectItem value="connection" className="text-xs">Conexão</SelectItem>
              <SelectItem value="queue" className="text-xs">Fila</SelectItem>
              <SelectItem value="pipeline" className="text-xs">Pipeline</SelectItem>
              <SelectItem value="contact" className="text-xs">Contato</SelectItem>
              <SelectItem value="automation" className="text-xs">Automação</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Ação */}
          <Select 
            value={filters.action || 'all'} 
            onValueChange={(value) => {
              setFilters(prev => ({ ...prev, action: value === 'all' ? undefined : value }));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-[150px] text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a]">
              <SelectValue placeholder="Ação" />
            </SelectTrigger>
            <SelectContent className="rounded-none dark:bg-[#1a1a1a] dark:border-gray-700 max-h-[300px]">
              <SelectItem value="all" className="text-xs">Todas as ações</SelectItem>
              {Object.entries(actionLabels).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Data */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-7 px-2 text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a]"
              >
                <Calendar className="w-3 h-3 mr-1" />
                {startDate || endDate ? (
                  <span>
                    {startDate ? format(startDate, 'dd/MM', { locale: ptBR }) : '...'} 
                    {' - '} 
                    {endDate ? format(endDate, 'dd/MM', { locale: ptBR }) : '...'}
                  </span>
                ) : (
                  'Período'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-none dark:bg-[#1a1a1a] dark:border-gray-700" align="start">
              <div className="flex">
                <div className="border-r dark:border-gray-700">
                  <div className="p-2 text-xs font-medium text-center border-b dark:border-gray-700">Data Inicial</div>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ptBR}
                    className="p-2"
                  />
                </div>
                <div>
                  <div className="p-2 text-xs font-medium text-center border-b dark:border-gray-700">Data Final</div>
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ptBR}
                    className="p-2"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-xs rounded-none hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              <X className="w-3 h-3 mr-1" />
              Limpar
            </Button>
          )}

          <div className="flex-1" />

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2 text-xs rounded-none hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", isFetching && "animate-spin")} />
            Atualizar
          </Button>

          {/* Title */}
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Logs de Auditoria ({data?.count || 0})
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-none" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <ScrollText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhum log encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {hasActiveFilters ? "Tente ajustar os filtros" : "Os logs de auditoria aparecerão aqui"}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_180px_180px_180px_100px_160px] bg-[#f3f3f3] border-b border-[#d4d4d4] sticky top-0 z-10 dark:bg-[#161616] dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Recurso
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Ação
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Empresa
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Executor
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Origem
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                Data/Hora
              </div>
            </div>

            {/* Table Body */}
            {data?.data.map((log) => {
              const isExpanded = expandedRows.has(log.id);
              const hasDetails = log.old_data || log.new_data;
              
              return (
                <div key={log.id}>
                  <div
                    className={cn(
                      "grid grid-cols-[1fr_180px_180px_180px_100px_160px] border-b border-[#d4d4d4] hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-900/60",
                      hasDetails && "cursor-pointer"
                    )}
                    onClick={() => hasDetails && toggleRowExpansion(log.id)}
                  >
                    {/* Recurso */}
                    <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center gap-2 dark:border-gray-700">
                      <div className="text-gray-500 dark:text-gray-400">
                        {getEntityIcon(log.entity_type)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {log.entity_name || 'N/A'}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {entityTypeLabels[log.entity_type] || log.entity_type}
                        </span>
                      </div>
                      {hasDetails && (
                        <div className="ml-auto text-gray-400">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </div>

                    {/* Ação */}
                    <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center dark:border-gray-700">
                      <Badge className={cn("text-[10px] px-1.5 py-0.5 h-5 rounded-none gap-1", getActionColor(log.action))}>
                        {getActionIcon(log.action)}
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </div>

                    {/* Empresa */}
                    <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center dark:border-gray-700 dark:text-gray-200">
                      {log.workspace?.name ? (
                        <span className="font-medium">{log.workspace.name}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </div>

                    {/* Executor */}
                    <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700">
                      <div className="flex items-center gap-1">
                        {log.user_name ? (
                          <>
                            <User className="w-3 h-3 text-blue-500" />
                            <span className="text-gray-900 dark:text-gray-100 truncate font-medium">
                              {log.user_name}
                            </span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-500 dark:text-gray-400 truncate italic">
                              Desconhecido
                            </span>
                          </>
                        )}
                      </div>
                      {log.user_email && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {log.user_email}
                        </div>
                      )}
                    </div>

                    {/* Origem */}
                    <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center dark:border-gray-700">
                      {(log as any).source === 'frontend' ? (
                        <Badge className="text-[10px] px-1.5 py-0.5 h-5 rounded-none bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Sistema
                        </Badge>
                      ) : (log as any).source === 'trigger' ? (
                        <Badge className="text-[10px] px-1.5 py-0.5 h-5 rounded-none bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                          Banco
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] px-1.5 py-0.5 h-5 rounded-none bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Histórico
                        </Badge>
                      )}
                    </div>

                    {/* Data/Hora */}
                    <div className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                    </div>
                  </div>

                  {/* Detalhes Expandidos */}
                  {isExpanded && hasDetails && (
                    <div className="bg-gray-50 border-b border-[#d4d4d4] p-4 dark:bg-[#0a0a0a] dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-4">
                        {log.old_data && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Estado Anterior
                            </h4>
                            <pre className="text-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 rounded-none overflow-auto max-h-40 text-red-800 dark:text-red-200">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_data && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                              Novo Estado
                            </h4>
                            <pre className="text-[10px] bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-2 rounded-none overflow-auto max-h-40 text-green-800 dark:text-green-200">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Página {page} de {totalPages} • {data?.count || 0} registros
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-7 px-2 text-xs rounded-none"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-7 px-2 text-xs rounded-none"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
