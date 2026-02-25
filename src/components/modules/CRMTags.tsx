import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Edit, Trash2, RotateCcw, X, Tag, Search, Plus, Filter, User, Check, ChevronsUpDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { CriarTagModal } from "@/components/modals/CriarTagModal";
import { EditarTagModal } from "@/components/modals/EditarTagModal";
import { DeletarTagModal } from "@/components/modals/DeletarTagModal";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CRMTags() {
  const DEFAULT_PAGE_SIZE = 100;
  const MIN_PAGE_SIZE = 10;
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{ id: string; name: string; color: string } | null>(null);
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  
  const { selectedWorkspace } = useWorkspace();
  const { userRole } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  
  const shouldFetchMembers = userRole === 'admin' || userRole === 'master';
  const { members: fetchedMembers, isLoading: loadingMembers } = useWorkspaceMembers(
    shouldFetchMembers ? (selectedWorkspace?.workspace_id || "") : ""
  );
  const members = fetchedMembers || [];
  const { tags, isLoading, error, refetch } = useTags(selectedWorkspace?.workspace_id, startDate, endDate, selectedUserId);

  // Derivados de paginação
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  const selectedUser = members.find(m => m.user_id === selectedUserId);
  
  // Filtrar usuários master e support
  const filteredMembers = members.filter(member => member.role !== 'master' && member.role !== 'support');

  const handleResetFilters = () => {
    setSelectedUserId("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };
  
  const handleEditTag = (tag: { id: string; name: string; color: string }) => {
    setSelectedTag(tag);
    setIsEditModalOpen(true);
  };
  
  const handleDeleteTag = (tag: { id: string; name: string; color: string }) => {
    setSelectedTag(tag);
    setIsDeleteModalOpen(true);
  };
  
  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0f0f0f] dark:border-gray-700 dark:text-gray-100">
      {/* Excel-like Toolbar (Ribbonish) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        {/* Title Bar / Top Menu */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-gray-900 dark:text-gray-100"
              style={{ fontSize: "1.5rem" }}
            >
              Etiquetas
            </span>
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* User Filter Group (Admin only) */}
          {(userRole === 'admin' || userRole === 'master') && (
            <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 dark:border-gray-700">
              <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserPopoverOpen}
                    className="h-7 px-2 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 justify-between w-[200px] dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                    disabled={loadingMembers}
                  >
                    <div className="flex items-center truncate">
                      <User className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                      {loadingMembers 
                        ? "Carregando..." 
                        : selectedUser 
                          ? selectedUser.user?.name 
                          : "Filtrar por usuário..."}
                    </div>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0 bg-white dark:bg-[#1a1a1a] dark:text-gray-100 dark:border-gray-700">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." className="h-8 text-xs" />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {filteredMembers.map((member) => (
                          <CommandItem
                            key={member.id}
                            value={member.user?.name || ""}
                            onSelect={() => {
                              setSelectedUserId(member.user_id === selectedUserId ? "" : member.user_id);
                              setIsUserPopoverOpen(false);
                            }}
                            className="text-xs"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-3 w-3",
                                selectedUserId === member.user_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {member.user?.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
                {selectedUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-[#2a1f1f]"
                  onClick={() => setSelectedUserId("")}
                  title="Limpar filtro de usuário"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Date Filters Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 dark:border-gray-700">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-7 px-2 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 justify-start text-left font-normal w-[130px]",
                    !startDate && "text-muted-foreground",
                    "dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-[#1a1a1a] dark:border-gray-700" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-7 px-2 text-xs border-gray-300 rounded-sm hover:bg-gray-100 text-gray-700 justify-start text-left font-normal w/[130px]",
                    !endDate && "text-muted-foreground",
                    "dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-[#1a1a1a] dark:border-gray-700" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  disabled={(date) => startDate ? date < startDate : false}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(startDate || endDate) && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 hover:bg-red-50 hover:text-red-600 dark:text-gray-300 dark:hover:bg-[#2a1f1f]"
                onClick={handleResetFilters}
                title="Limpar filtros"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost"
              className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[9px]">Nova Etiqueta</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Excel Grid Table */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505] relative">
        <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
          <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Nome</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Contatos Etiquetados</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
                      <td className="border border-[#e0e0e0] px-2 py-1 dark:border-gray-700">
                        <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                      <td className="border border-[#e0e0e0] px-2 py-1 text-center dark:border-gray-700">
                        <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-sm mx-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-8 text-red-600 dark:border-gray-700">
                    {error}
                  </td>
                </tr>
              ) : tags.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 dark:border-gray-700 dark:bg-[#1a1a1a]">
                    <div className="flex flex-col items-center gap-2">
                      <Tag className="h-8 w-8 text-gray-300" />
                      <p className="text-gray-500 font-medium">
                        Nenhuma etiqueta encontrada
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs rounded-sm"
                        onClick={() => setIsCreateModalOpen(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Criar primeira etiqueta
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                tags
                  .slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)
                  .map((tag) => (
                  <tr key={tag.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                    {/* Name */}
                    <td className="border border-[#e0e0e0] px-2 py-0 whitespace-nowrap dark:border-gray-700">
                      <Badge 
                        variant="outline" 
                        style={{ 
                          backgroundColor: tag.color ? `${tag.color}99` : 'rgba(0,0,0,0.06)',
                        }}
                        className="rounded-none px-2 py-0.5 text-[11px] font-semibold h-5 inline-flex items-center gap-1 text-black dark:text-white border-none"
                      >
                        <span className="truncate max-w-[180px]">{tag.name}</span>
                      </Badge>
                    </td>

                    {/* Count */}
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center text-gray-600 whitespace-nowrap dark:border-gray-700 dark:text-gray-200">
                      {tag.contact_count || 0}
                    </td>

                    {/* Actions */}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center dark:border-gray-700">
                      <div className="flex items-center justify-center gap-0.5 h-full">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                          onClick={() => handleEditTag(tag)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#2a1f1f]"
                          onClick={() => handleDeleteTag(tag)}
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
                Linhas {startIndex}-{endIndex} de {tags.length || 0}
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
                disabled={page === 1 || isLoading}
              >
                Anterior
              </button>
              <span>
                Página {page} / {totalPages}
              </span>
              <button
                className="px-2 py-1 border border-gray-300 rounded-sm disabled:opacity-50 dark:border-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={isLoading || page >= totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      <CriarTagModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onTagCreated={() => {
          refetch?.();
        }}
      />

      <EditarTagModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTag(null);
        }}
        onTagUpdated={() => {
          refetch?.();
        }}
        tag={selectedTag}
      />

      <DeletarTagModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedTag(null);
        }}
        onTagDeleted={() => {
          refetch?.();
        }}
        tag={selectedTag}
      />
    </div>
  );
}
