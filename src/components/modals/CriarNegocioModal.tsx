import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceUsers } from "@/hooks/useWorkspaceUsers";
import { useProducts } from "@/hooks/useProducts";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineColumns } from "@/hooks/usePipelineColumns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";

interface CriarNegocioModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onCreateBusiness?: (business: any) => void;
  isDarkMode?: boolean;
  preSelectedContactId?: string;
  preSelectedContactName?: string;
  onResponsibleUpdated?: () => void;
}

export function CriarNegocioModal({ 
  isOpen, 
  open, 
  onClose, 
  onOpenChange, 
  onCreateBusiness, 
  isDarkMode = false,
  preSelectedContactId,
  preSelectedContactName,
  onResponsibleUpdated
}: CriarNegocioModalProps) {
  const modalOpen = open ?? isOpen ?? false;
  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const [selectedLead, setSelectedLead] = useState(preSelectedContactId || "");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [value, setValue] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [responsiblePopoverOpen, setResponsiblePopoverOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [responsibleSearch, setResponsibleSearch] = useState("");
  
  const { selectedWorkspace } = useWorkspace();
  const { pipelines } = usePipelines();
  const { columns, fetchColumns } = usePipelineColumns(selectedPipeline || null);
  
  // Estabilizar o array de filtros para evitar loop infinito
  const profileFilters = useMemo<('user' | 'admin' | 'master')[]>(() => ['user', 'admin'], []);
  
  const { users, isLoading: isLoadingUsers } = useWorkspaceUsers(
    selectedWorkspace?.workspace_id, 
    profileFilters
  );
  const { products, isLoading: isLoadingProducts } = useProducts();

  // Buscar contatos
  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedWorkspace) return;
      
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone, email')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');
      
      if (!error && data) {
        setContacts(data);
      }
    };
    
    fetchContacts();
  }, [selectedWorkspace]);

  const selectedLeadLabel = useMemo(() => {
    if (preSelectedContactId && preSelectedContactName) return preSelectedContactName;
    const c = contacts.find((x) => x.id === selectedLead);
    if (!c) return "";
    return `${c.name || "Sem nome"}${c.phone ? ` - ${c.phone}` : c.email ? ` - ${c.email}` : ""}`;
  }, [contacts, preSelectedContactId, preSelectedContactName, selectedLead]);

  const filteredContacts = useMemo(() => {
    const q = (leadSearch || "").toLowerCase().trim();
    if (!q) return contacts.slice(0, 50);
    const results = contacts.filter((c) => {
      const name = String(c?.name || "").toLowerCase();
      const phone = String(c?.phone || "").toLowerCase();
      const email = String(c?.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
    return results.slice(0, 50);
  }, [contacts, leadSearch]);

  const selectedResponsibleLabel = useMemo(() => {
    const u = users.find((x) => x.id === selectedResponsible);
    return u?.name || "";
  }, [users, selectedResponsible]);

  const filteredUsers = useMemo(() => {
    const q = (responsibleSearch || "").toLowerCase().trim();
    if (!q) return users.slice(0, 50);
    const results = users.filter((u) => String(u?.name || "").toLowerCase().includes(q));
    return results.slice(0, 50);
  }, [users, responsibleSearch]);


  // Pré-selecionar contato quando fornecido
  useEffect(() => {
    if (preSelectedContactId) {
      setSelectedLead(preSelectedContactId);
    }
  }, [preSelectedContactId]);

  // Preencher valor automaticamente ao selecionar produto
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find(p => p.id === selectedProduct);
      if (product) {
        setValue(product.value.toString());
      }
    }
  }, [selectedProduct, products]);

  // Carregar colunas quando pipeline for selecionado
  useEffect(() => {
    if (selectedPipeline) {
      fetchColumns();
    }
  }, [selectedPipeline]);

  // Atualizar primeira coluna quando colunas mudarem
  useEffect(() => {
    if (columns.length > 0 && !selectedColumn) {
      setSelectedColumn(columns[0].id);
    }
  }, [columns]);

  // Validar se pode habilitar botão criar
  const canCreate = selectedLead && selectedResponsible && selectedPipeline && selectedColumn;

  const handleSubmit = async () => {
    if (!canCreate) return;
    
    const newBusiness = {
      lead: selectedLead,
      responsible: selectedResponsible,
      pipeline: selectedPipeline,
      product: selectedProduct || null,
      column: selectedColumn,
      value: value ? parseFloat(value) : 0
    };
    
    if (onCreateBusiness) {
      try {
        await onCreateBusiness(newBusiness);
        
        if (onResponsibleUpdated) {
          onResponsibleUpdated();
        }
        
        // Reset form apenas se sucesso
        setSelectedLead(preSelectedContactId || "");
        setSelectedResponsible("");
        setSelectedPipeline("");
        setSelectedProduct("");
        setSelectedColumn("");
        setValue("");
        
        handleClose();
      } catch (error: any) {
        // Erro já foi tratado no contexto com toast
        console.error('Erro ao criar negócio:', error);
      }
    }
  };

  return (
    <Dialog open={modalOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-md p-0 gap-0 border border-[#d4d4d4] shadow-sm rounded-none bg-white text-gray-900 dark:bg-[#1f1f1f] dark:border-gray-700 dark:text-gray-100"
      )}>
        <DialogHeader className={cn(
          "p-4 m-0 rounded-none border-b bg-primary border-[#d4d4d4] dark:border-gray-700"
        )}>
          <DialogTitle className={cn(
            "text-base font-bold text-white dark:text-gray-100"
          )}>
            Criar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {/* Seleção de Lead */}
          <div>
            <Label className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">Lead</Label>
            <Popover
              open={leadPopoverOpen && !preSelectedContactId}
              onOpenChange={(v) => {
                if (preSelectedContactId) return;
                setLeadPopoverOpen(v);
                if (!v) setLeadSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  disabled={!!preSelectedContactId}
                  className={cn(
                    "h-8 w-full justify-between rounded-none px-3 text-xs focus:ring-0",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200"
                  )}
                >
                  <span className="line-clamp-1 text-left">
                    {selectedLeadLabel || preSelectedContactName || "Selecione o Lead"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[398px] p-2 rounded-none border-[#d4d4d4] bg-white dark:bg-[#2d2d2d] dark:border-gray-600"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput
                    placeholder="Digite o nome, número ou email..."
                    value={leadSearch}
                    onValueChange={setLeadSearch}
                  />
                  <CommandList className="max-h-56 overflow-y-auto">
                    <CommandEmpty>
                      {contacts.length === 0 ? "Carregando leads..." : "Nenhum lead encontrado"}
                    </CommandEmpty>
                    {filteredContacts.map((contact) => {
                      const label = `${contact.name || "Sem nome"} - ${contact.phone || contact.email || "Sem contato"}`;
                      const isSelected = selectedLead === contact.id;
                      return (
                        <CommandItem
                          key={contact.id}
                          value={label}
                          onSelect={() => {
                            setSelectedLead(contact.id);
                            setLeadPopoverOpen(false);
                            setLeadSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                          <span className="text-xs">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Seleção de responsável */}
          <div>
            <Label className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">Responsável</Label>
            <Popover
              open={responsiblePopoverOpen}
              onOpenChange={(v) => {
                setResponsiblePopoverOpen(v);
                if (!v) setResponsibleSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  disabled={isLoadingUsers || users.length === 0}
                  className={cn(
                    "h-8 w-full justify-between rounded-none px-3 text-xs focus:ring-0",
                    "bg-white border-gray-300 text-gray-900",
                    "dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200"
                  )}
                >
                  <span className="line-clamp-1 text-left">
                    {selectedResponsibleLabel ||
                      (isLoadingUsers
                    ? "Carregando usuários..." 
                    : users.length === 0 
                      ? "Nenhum usuário disponível" 
                          : "Selecione o responsável")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[398px] p-2 rounded-none border-[#d4d4d4] bg-white dark:bg-[#2d2d2d] dark:border-gray-600"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command>
                  <CommandInput
                    placeholder="Digite o nome do responsável..."
                    value={responsibleSearch}
                    onValueChange={setResponsibleSearch}
                  />
                  <CommandList className="max-h-56 overflow-y-auto">
                    <CommandEmpty>
                      {isLoadingUsers ? "Carregando usuários..." : "Nenhum usuário encontrado"}
                    </CommandEmpty>
                    {filteredUsers.map((user) => {
                      const isSelected = selectedResponsible === user.id;
                      return (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => {
                            setSelectedResponsible(user.id);
                            setResponsiblePopoverOpen(false);
                            setResponsibleSearch("");
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                          <span className="text-xs">{user.name}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Seleção de pipeline */}
          <div>
            <Label className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">Pipeline</Label>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="h-8 text-xs rounded-none focus:ring-0 bg-white border-gray-300 text-gray-900 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200">
                <SelectValue placeholder="Selecione o pipeline" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-auto z-50 rounded-none bg-white border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-600">
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id} className="text-xs rounded-none cursor-pointer text-gray-700 dark:text-gray-200 dark:focus:bg-gray-700">
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de coluna */}
          <div>
            <Label className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">Coluna</Label>
            <Select 
              value={selectedColumn} 
              onValueChange={setSelectedColumn}
              disabled={!selectedPipeline || columns.length === 0}
            >
              <SelectTrigger className="h-8 text-xs rounded-none focus:ring-0 bg-white border-gray-300 text-gray-900 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200">
                <SelectValue placeholder={
                  !selectedPipeline 
                    ? "Selecione um pipeline primeiro" 
                    : columns.length === 0 
                      ? "Nenhuma coluna disponível" 
                      : "Selecione a coluna"
                } />
              </SelectTrigger>
              {columns.length > 0 && (
                <SelectContent className="max-h-48 overflow-auto z-50 rounded-none bg-white border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-600">
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id} className="text-xs rounded-none cursor-pointer text-gray-700 dark:text-gray-200 dark:focus:bg-gray-700">
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Seleção de produto (opcional) */}
          <div>
            <Label className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">Produto (Opcional)</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={isLoadingProducts}>
              <SelectTrigger className="h-8 text-xs rounded-none focus:ring-0 bg-white border-gray-300 text-gray-900 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200">
                <SelectValue placeholder={
                  isLoadingProducts 
                    ? "Carregando produtos..." 
                    : products.length === 0 
                      ? "Nenhum produto disponível" 
                      : "Selecione o produto"
                } />
              </SelectTrigger>
              {products.length > 0 && (
                <SelectContent className="max-h-48 overflow-auto z-50 rounded-none bg-white border-gray-300 dark:bg-[#2d2d2d] dark:border-gray-600">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id} className="text-xs rounded-none cursor-pointer text-gray-700 dark:text-gray-200 dark:focus:bg-gray-700">
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>

          {/* Campo de preço */}
          <div>
            <Label htmlFor="value" className="text-xs font-bold mb-1.5 block text-gray-700 dark:text-gray-200">
              Preço (Opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-medium text-gray-500 dark:text-gray-400">
                R$
              </span>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="pl-8 h-8 text-xs rounded-none focus-visible:ring-0 bg-white border-gray-300 text-gray-900 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 p-4 border-t mt-0 bg-gray-50 border-[#d4d4d4] dark:bg-[#1a1a1a] dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-8 text-xs rounded-none bg-white border-gray-300 hover:bg-gray-100 text-gray-700 dark:bg-[#2d2d2d] dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canCreate}
            className={cn(
              "h-8 text-xs rounded-none transition-opacity bg-primary hover:bg-primary/90 text-primary-foreground",
              !canCreate && "opacity-50 cursor-not-allowed"
            )}
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}