import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Cliente {
  id: string;
  nome: string;  
  email: string;
  telefone: string;
  status: string;
  created_at: string;
  workspace_id: string;
}

export function ParceirosClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    status: "ativo"
  });
  
  // Estados para floating labels
  const [nomeIsFocused, setNomeIsFocused] = useState(false);
  const [emailIsFocused, setEmailIsFocused] = useState(false);
  const [telefoneIsFocused, setTelefoneIsFocused] = useState(false);
  const [statusIsFocused, setStatusIsFocused] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        toast.error('Erro ao carregar clientes');
        return;
      }

      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCliente = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar cliente:', error);
        toast.error('Erro ao deletar cliente');
        return;
      }

      toast.success("Cliente removido com sucesso!");
      await loadClientes(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      toast.error('Erro ao deletar cliente');
    }
  };

  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error("E-mail é obrigatório!");
      return;
    }

    try {
      const clienteData = {
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone,
        status: formData.status,
        workspace_id: selectedWorkspace?.workspace_id
      };

      const { error } = await supabase
        .from('clientes')
        .insert([clienteData]);

      if (error) {
        console.error('Erro ao salvar cliente:', error);
        if (error.message.includes('row-level security')) {
          toast.error('Erro de permissão. Verifique se você está autenticado.');
        } else {
          toast.error('Erro ao salvar cliente');
        }
        return;
      }

      toast.success("Cliente adicionado com sucesso!");
      setIsModalOpen(false);
      setFormData({ nome: "", email: "", telefone: "", status: "ativo" });
      
      // Reset floating label states
      setNomeIsFocused(false);
      setEmailIsFocused(false);
      setTelefoneIsFocused(false);
      setStatusIsFocused(false);

      await loadClientes(); // Recarrega a lista de clientes
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar cliente');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filteredClientes.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClientes = filteredClientes.slice(startIndex, endIndex);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-black">Clientes</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-yellow-400 hover:bg-yellow-500 text-black">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-black">Adicionar cliente</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSaveCliente} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Campo Nome com Floating Label */}
                <div className="relative">
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    onFocus={() => setNomeIsFocused(true)}
                    onBlur={() => setNomeIsFocused(false)}
                    className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                  />
                  <label 
                    className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                      nomeIsFocused || formData.nome ? 
                      '-top-2 text-xs text-yellow-500 font-medium' : 
                      'top-1/2 -translate-y-1/2 text-gray-500'
                    }`}
                    style={{ backgroundColor: 'white' }}
                  >
                    Nome
                  </label>
                </div>
                
                {/* Campo E-mail com Floating Label */}
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onFocus={() => setEmailIsFocused(true)}
                    onBlur={() => setEmailIsFocused(false)}
                    required
                    className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                  />
                  <label 
                    className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                      emailIsFocused || formData.email ? 
                      '-top-2 text-xs text-yellow-500 font-medium' : 
                      'top-1/2 -translate-y-1/2 text-gray-500'
                    }`}
                    style={{ backgroundColor: 'white' }}
                  >
                    E-mail *
                  </label>
                </div>
                
                {/* Campo Telefone com Floating Label */}
                <div className="relative">
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange("telefone", e.target.value)}
                    onFocus={() => setTelefoneIsFocused(true)}
                    onBlur={() => setTelefoneIsFocused(false)}
                    className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                  />
                  <label 
                    className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                      telefoneIsFocused || formData.telefone ? 
                      '-top-2 text-xs text-yellow-500 font-medium' : 
                      'top-1/2 -translate-y-1/2 text-gray-500'
                    }`}
                    style={{ backgroundColor: 'white' }}
                  >
                    Telefone
                  </label>
                </div>
                
                {/* Campo Status com Floating Label */}
                <div className="relative">
                  <select 
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value)}
                    onFocus={() => setStatusIsFocused(true)}
                    onBlur={() => setStatusIsFocused(false)}
                    className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                  >
                    <option value="" disabled hidden></option>
                    <option value="ativo">ATIVO</option>
                    <option value="inativo">INATIVO</option>
                  </select>
                  <label 
                    className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                      statusIsFocused || formData.status ? 
                      '-top-2 text-xs text-yellow-500 font-medium' : 
                      'top-1/2 -translate-y-1/2 text-gray-500'
                    }`}
                    style={{ backgroundColor: 'white' }}
                  >
                    Status
                  </label>
                  {/* Ícone de dropdown */}
                  <svg 
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsModalOpen(false)}
                  className="text-black border-gray-300"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-yellow-400 hover:bg-yellow-500 text-black"
                >
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-black" />
        <Input
          placeholder="Buscar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 text-black"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium text-black">Nome da empresa</TableHead>
              <TableHead className="font-medium text-black">E-mail</TableHead>
              <TableHead className="font-medium text-black">Situação</TableHead>
              <TableHead className="font-medium text-black">Criada em</TableHead>
              <TableHead className="font-medium text-center text-black">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentClientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell className="text-black">
                  {cliente.nome}
                </TableCell>
                <TableCell className="text-black">
                  {cliente.email}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={cliente.status === "ativo" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                  >
                    {cliente.status === "ativo" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-black">
                  {formatDate(cliente.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteCliente(cliente.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="flex items-center gap-4">
            <span className="text-sm text-black">Linhas por página:</span>
            <Select 
              value={itemsPerPage.toString()} 
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-black">
              {startIndex + 1}-{Math.min(endIndex, totalItems)} de {totalItems}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm" 
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}