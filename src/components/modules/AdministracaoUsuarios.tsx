import { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Search, Edit, Trash2, Plus, Loader2, UserCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdicionarEditarUsuarioModal } from "@/components/modals/AdicionarEditarUsuarioModal";
import { DeletarUsuarioModal } from "@/components/modals/DeletarUsuarioModal";
import { AdministracaoCargos } from "./AdministracaoCargos";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { cn } from "@/lib/utils";
import { useSyncUserContext } from "@/hooks/useUserContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logDelete } from "@/utils/auditLog";

export interface AdministracaoUsuariosRef {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleAddUser: () => void;
  handleGerenciarCargos: () => void;
}

export const AdministracaoUsuarios = forwardRef<AdministracaoUsuariosRef>((props, ref) => {
  // Sincroniza o contexto do usuário para auditoria
  useSyncUserContext();
  
  const { loading, listUsers, createUser, updateUser, deleteUser } = useSystemUsers();
  const { user: currentUser, userRole } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | undefined>(undefined);
  const [showCargos, setShowCargos] = useState(false);

  const refreshUsers = async () => {
    const result = await listUsers();
    if (result.data) {
      setUsers(result.data);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);
  const filteredUsers = users.filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setEditingUser(user);
      setIsAddEditModalOpen(true);
    }
  };
  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Support não pode deletar a si mesmo
    if (userRole === 'support' && currentUser?.id === userId) {
      toast({
        title: "Ação não permitida",
        description: "Você não pode excluir seu próprio usuário.",
        variant: "destructive"
      });
      return;
    }
    
    // Support não pode deletar usuários master ou support
    if (userRole === 'support' && (user.profile === 'master' || user.profile === 'support')) {
      toast({
        title: "Ação não permitida",
        description: "Você não tem permissão para excluir este tipo de usuário.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (selectedUser) {
      const result = await deleteUser(selectedUser.id);
      if (result.success) {
        await logDelete(
          'user',
          selectedUser.id,
          selectedUser.name || 'Usuário',
          {
            name: selectedUser.name,
            email: selectedUser.email,
            profile: selectedUser.profile,
            status: selectedUser.status,
            default_channel: selectedUser.default_channel || null
          },
          null
        );
        await refreshUsers();
      }
    }
    setIsDeleteModalOpen(false);
    setSelectedUser(undefined);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setIsAddEditModalOpen(true);
  };
  const handleModalSuccess = () => {
    refreshUsers();
    setIsAddEditModalOpen(false);
    setEditingUser(null);
  };
  const handleGerenciarCargos = () => {
    setShowCargos(true);
  };
  const handleBackFromCargos = () => {
    setShowCargos(false);
  };

  useImperativeHandle(ref, () => ({
    searchTerm,
    setSearchTerm,
    handleAddUser,
    handleGerenciarCargos
  }));

  if (showCargos) {
    return <AdministracaoCargos onBack={handleBackFromCargos} />;
  }
  return <div className="h-full flex flex-col">
      {/* Excel-style Table */}
      <div className="flex-1 overflow-auto p-4 bg-white dark:bg-[#050505]">
        {loading ? (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            <div className="grid grid-cols-7 bg-[#f3f3f3] border-b border-[#d4d4d4] dark:bg-[#161616] dark:border-gray-700">
              {['Nome', 'Email', 'Perfil', 'Empresa', 'Criado por', 'Status', 'Ações'].map((header) => (
                <div key={header} className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] last:border-r-0 dark:text-gray-200 dark:border-gray-700">
                  {header}
                </div>
              ))}
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-7 border-b border-[#d4d4d4] animate-pulse dark:border-gray-700">
                {[...Array(7)].map((_, j) => (
                  <div key={j} className="px-3 py-2.5 border-r border-[#d4d4d4] last:border-r-0 dark:border-gray-700">
                    <div className="h-4 bg-gray-200 rounded dark:bg-gray-800" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border-2 border-dashed border-[#d4d4d4] dark:bg-[#111111] dark:border-gray-700">
            <UserCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2 dark:text-gray-100">Nenhum usuário encontrado</h3>
            <p className="text-gray-500 mb-4 dark:text-gray-400">
              {searchTerm ? "Tente uma busca diferente" : "Comece adicionando um novo usuário"}
            </p>
            {!searchTerm && (
              <Button 
                onClick={handleAddUser}
                className="h-7 px-3 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar usuário
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#d4d4d4] shadow-sm dark:bg-[#111111] dark:border-gray-700">
            {/* Table Header */}
            <div className="grid grid-cols-7 bg-[#f3f3f3] border-b border-[#d4d4d4] sticky top-0 z-10 dark:bg-[#161616] dark:border-gray-700">
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Nome
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Email
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Perfil
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Empresa
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Criado por
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-[#d4d4d4] dark:text-gray-200 dark:border-gray-700">
                Status
              </div>
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                Ações
              </div>
            </div>

            {/* Table Body */}
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-7 border-b border-[#d4d4d4] hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-900/60"
              >
                {/* Nome */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center gap-2 dark:border-gray-700 dark:text-gray-100 overflow-hidden">
                  <UserCircle className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span className="font-medium truncate" title={user.name}>{user.name}</span>
                </div>

                {/* Email */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] text-gray-600 dark:text-gray-300 dark:border-gray-700 overflow-hidden">
                  <span className="block truncate" title={user.email}>{user.email}</span>
                </div>

                {/* Perfil */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 dark:text-gray-200">
                  <span className="capitalize">{user.profile}</span>
                </div>

                {/* Empresa */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 dark:text-gray-200 overflow-hidden">
                  <span className="block truncate" title={(user.profile === 'master' || user.profile === 'support') ? 'Todas' : (user.empresa || (user.workspaces?.map(w => w.name).join(", ") || "-"))}>
                    {(user.profile === 'master' || user.profile === 'support') ? 'Todas' : (user.empresa || (user.workspaces?.map(w => w.name).join(", ") || "-"))}
                  </span>
                </div>

                {/* Criado por */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] text-gray-600 dark:text-gray-300 dark:border-gray-700 overflow-hidden">
                  <span className="block truncate" title={user.created_by_name || "-"}>{user.created_by_name || "-"}</span>
                </div>

                {/* Status */}
                <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] flex items-center dark:border-gray-700">
                  <Badge 
                    variant={user.status === 'active' ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-5 dark:bg-green-600 dark:text-white"
                  >
                    {user.status === 'active' ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {/* Ações */}
                <div className="px-3 py-2.5 text-xs flex items-center gap-1 dark:text-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditUser(user.id)}
                    className="h-6 px-2 text-[10px] hover:bg-gray-200 dark:hover:bg-gray-800"
                    title="Editar"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id)}
                    className="h-6 px-2 text-[10px] hover:bg-gray-200 hover:text-red-600"
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

      {/* Modal de adicionar/editar usuário */}
      <AdicionarEditarUsuarioModal 
        open={isAddEditModalOpen} 
        onOpenChange={setIsAddEditModalOpen}
        editingUser={editingUser}
        onSuccess={handleModalSuccess}
      />


      {/* Modal de deletar usuário */}
      <DeletarUsuarioModal isOpen={isDeleteModalOpen} onClose={() => {
      setIsDeleteModalOpen(false);
      setSelectedUser(undefined);
    }} onConfirm={handleConfirmDelete} userName={selectedUser?.name || ""} />
    </div>;
});

AdministracaoUsuarios.displayName = 'AdministracaoUsuarios';