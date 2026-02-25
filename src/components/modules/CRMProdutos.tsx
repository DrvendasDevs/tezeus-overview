import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, Search, Plus, Package, Download, Upload, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts, Product } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { logCreate, logUpdate, logDelete } from "@/utils/auditLog";

const DEFAULT_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;

export function CRMProdutos() {
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useProducts();
  const { selectedWorkspace } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    value: ''
  });

  // Estado para seleção (checkboxes)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginação (mesmo padrão de Contatos)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;

  const resetForm = () => {
    setFormData({ name: '', value: '' });
  };

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };

  const handleCreateProduct = async () => {
    if (!formData.name.trim()) return;
    
    try {
      const newProduct = await createProduct({
        name: formData.name.trim(),
        value: parseFloat(formData.value) || 0
      });
      
      // Registrar log de auditoria
      if (newProduct) {
        await logCreate(
          'product',
          newProduct.id,
          newProduct.name,
          { name: newProduct.name, value: newProduct.value },
          selectedWorkspace?.workspace_id
        );
      }
      
      resetForm();
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error('Erro ao criar produto:', error);
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct || !formData.name.trim()) return;
    
    try {
      const updatedProduct = await updateProduct(selectedProduct.id, {
        name: formData.name.trim(),
        value: parseFloat(formData.value) || 0
      });
      
      // Registrar log de auditoria
      if (updatedProduct) {
        await logUpdate(
          'product',
          updatedProduct.id,
          updatedProduct.name,
          { name: selectedProduct.name, value: selectedProduct.value },
          { name: updatedProduct.name, value: updatedProduct.value },
          selectedWorkspace?.workspace_id
        );
      }
      
      resetForm();
      setIsEditModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Erro ao editar produto:', error);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    try {
      await deleteProduct(productToDelete.id);
      
      // Registrar log de auditoria
      await logDelete(
        'product',
        productToDelete.id,
        productToDelete.name,
        { name: productToDelete.name, value: productToDelete.value },
        selectedWorkspace?.workspace_id
      );
      
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
    }
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      value: product.value.toString()
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Resetar página ao mudar a busca
  if (page !== 1 && searchTerm.trim() && startIndex > totalCount) {
    setPage(1);
  }

  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

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
              Produtos
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
                placeholder="Pesquisar produtos..."
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
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="text-[9px]">Novo Produto</span>
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
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Nome do Produto</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-right font-semibold text-gray-700 min-w-[100px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Preço (R$)</span>
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
              {filteredProducts.length === 0 ? (
                 <tr>
                  <td colSpan={3} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-400">
                    {isLoading ? "Carregando produtos..." : "Nenhum produto encontrado."}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                    <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle dark:border-gray-700">{product.name}</td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-right align-middle dark:border-gray-700">{formatCurrency(product.value)}</td>
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1 h-full">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(product)}
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteModal(product)}
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

      {/* Footer Sheets (Categories) */}
      <div className="flex items-center border-t border-gray-300 bg-[#f0f0f0] px-1 h-8 select-none dark:border-gray-700 dark:bg-[#141414]">
         <div className="flex items-end h-full gap-1 overflow-x-auto px-1">
            <div
              className={cn(
                "flex items-center gap-1.5 px-4 h-[26px] text-xs cursor-pointer border-t border-l border-r rounded-t-sm transition-all",
                "bg-white border-gray-300 border-b-white text-primary font-medium z-10 shadow-sm translate-y-[1px] dark:bg-[#1f1f1f] dark:border-gray-600"
              )}
            >
              <Package className="h-3 w-3" />
              <span>Produtos</span>
            </div>
         </div>
      </div>

      {/* Create Product Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-primary-foreground dark:text-gray-100">
              Novo Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Campo Nome */}
            <div>
              <Label htmlFor="productName" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Nome
              </Label>
              <Input
                id="productName"
                placeholder="Digite o nome do produto"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1 rounded-none bg-white border-gray-300 text-gray-900 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            {/* Campo Preço */}
            <div>
              <Label htmlFor="productPrice" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Preço
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  R$
                </span>
                <Input
                  id="productPrice"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 rounded-none bg-white border-gray-300 text-gray-900 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
            {/* Botões */}
            <div className="flex gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(false);
                }}
                className="flex-1 rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateProduct}
                className="flex-1 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-primary-foreground dark:text-white">
              Editar Produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Campo Nome */}
            <div>
              <Label htmlFor="editProductName" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Nome
              </Label>
              <Input
                id="editProductName"
                placeholder="Digite o nome do produto"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="mt-1 rounded-none bg-white border-gray-300 text-gray-900 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
              />
            </div>
            {/* Campo Preço */}
            <div>
              <Label htmlFor="editProductPrice" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Preço
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  R$
                </span>
                <Input
                  id="editProductPrice"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.value}
                  onChange={(e) => setFormData({...formData, value: e.target.value})}
                  className="pl-8 rounded-none bg-white border-gray-300 text-gray-900 dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
                />
              </div>
            </div>
            {/* Botões */}
            <div className="flex gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setIsEditModalOpen(false);
                  setSelectedProduct(null);
                }}
                className="flex-1 rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditProduct}
                className="flex-1 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-lg font-semibold text-primary-foreground dark:text-white">
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Tem certeza que deseja excluir o produto <strong>"{productToDelete?.name}"</strong>?
            </p>
            <div className="flex gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteProduct}
                className="flex-1 rounded-none bg-red-500 hover:bg-red-600 text-white"
              >
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
