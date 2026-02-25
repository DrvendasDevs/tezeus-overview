import React, { useMemo, useState, useEffect } from "react";
import { ArrowLeft, User, UserPlus, Edit, Trash } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspaceMembers, WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useToast } from "@/components/ui/use-toast";
import { AdicionarEditarUsuarioModal } from "../modals/AdicionarEditarUsuarioModal";
import type { SystemUser } from "@/hooks/useSystemUsers";
const roleLabels = {
  user: 'Usuário',
  admin: 'Administrador',
  master: 'Master'
};
const roleVariants = {
  user: 'secondary' as const,
  admin: 'default' as const,
  master: 'destructive' as const
};
const DEFAULT_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;
interface WorkspaceUsersPageProps {
  workspaceId?: string;
}
export function WorkspaceUsersPage({
  workspaceId: propWorkspaceId
}: WorkspaceUsersPageProps = {}) {
  const navigate = useNavigate();
  const {
    workspaceId: paramWorkspaceId
  } = useParams<{
    workspaceId: string;
  }>();
  const workspaceId = propWorkspaceId || paramWorkspaceId;
  const {
    workspaces
  } = useWorkspaces();
  const {
    userRole
  } = useAuth();
  const {
    isMaster,
    isAdmin
  } = useWorkspaceRole();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const workspace = workspaces.find(w => w.workspace_id === workspaceId);
  const {
    members,
    isLoading,
    removeMember,
    refreshMembers
  } = useWorkspaceMembers(workspaceId || '');
  
  const {
    toast
  } = useToast();

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, isNaN(parsed) ? DEFAULT_PAGE_SIZE : parsed);
    setPageSize(normalized);
    setPage(1);
  };

  // Check if user can manage this workspace
  const canManageWorkspace = userRole === 'master' || isMaster || isAdmin(workspaceId) || userRole === 'admin';
  if (!workspaceId) {
    navigate('/empresa');
    return null;
  }

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUserClick = (member: WorkspaceMember) => {
    if (!member.user) return;
    
    // Mapear WorkspaceMember para SystemUser
    const systemUser: SystemUser = {
      id: member.user_id,
      name: member.user.name || '',
      email: member.user.email || '',
      profile: member.user.profile || 'user',
      status: (member.user as any).status || 'active',
      avatar: member.user.avatar,
      created_at: member.created_at,
      updated_at: member.created_at,
      default_channel: (member.user as any).default_channel,
      cargo_ids: (member.user as any).cargo_ids,
      cargo_names: (member.user as any).cargo_names
    };
    
    setEditingUser(systemUser);
    setIsModalOpen(true);
  };

  const handleRemoveMemberClick = async (memberId: string) => {
    if (confirm('Tem certeza que deseja remover este membro?')) {
      try {
        await removeMember(memberId);
        toast({ title: "Sucesso", description: "Membro removido com sucesso" });
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.user?.name || "").toLowerCase();
      const email = (m.user?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, searchTerm]);

  const totalCount = filteredMembers.length;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));
  const startIndex = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = totalCount > 0 ? Math.min(page * pageSize, totalCount) : 0;
  const pagedMembers = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    return filteredMembers.slice(start, end);
  }, [filteredMembers, page, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/empresa')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <User className="w-6 h-6" />
            Usuários - {workspace?.name || 'Workspace'}
          </h1>
          <p className="text-muted-foreground">
            Gerencie os usuários deste workspace
          </p>
        </div>
      </div>

      {/* Add User Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-lg font-medium whitespace-nowrap">Membros ({members.length})</h3>
          <Input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome ou email..."
            className="h-8 w-[320px] max-w-full rounded-none text-xs dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
          />
        </div>
        {canManageWorkspace && (
          <Button onClick={handleOpenCreateUser} className="gap-2 rounded-none h-8 text-xs">
            <UserPlus className="w-4 h-4" />
            Adicionar Usuário
          </Button>
        )}
      </div>

      <AdicionarEditarUsuarioModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingUser={editingUser}
        workspaceId={workspaceId}
        lockWorkspace
        onSuccess={() => {
          refreshMembers();
          setIsModalOpen(false);
          setEditingUser(null);
        }}
      />

      {/* Members Table (padrão Excel + paginação estilo Contatos) */}
      <div className="border border-gray-300 dark:border-gray-700 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[#f3f3f3] dark:bg-[#111111] text-gray-700 dark:text-gray-200">
              <tr>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[72px]">Avatar</th>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left">Nome</th>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left">Email</th>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[120px]">Perfil</th>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[140px]">Adicionado em</th>
                <th className="border border-[#e0e0e0] dark:border-gray-700 px-1 py-1 text-center w-[72px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="border border-[#e0e0e0] dark:border-gray-700 px-3 py-8 text-center text-gray-600 dark:text-gray-300" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : totalCount === 0 ? (
                <tr>
                  <td className="border border-[#e0e0e0] dark:border-gray-700 px-3 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Nenhum membro encontrado
                  </td>
                </tr>
              ) : (
                pagedMembers.map((member) => {
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                          {member.user?.avatar ? (
                            <img
                              src={member.user.avatar}
                              alt={member.user.name || "Avatar"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </td>

                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111] font-medium">
                        {member.user?.name || "N/A"}
                      </td>
                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                        {member.user?.email || "N/A"}
                      </td>
                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                        <Badge variant="outline" className="rounded-none">
                          {roleLabels[(member.user?.profile as any) || "user"] || (member.user?.profile || "user")}
                        </Badge>
                      </td>
                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-300">
                        {new Date(member.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="border border-[#e0e0e0] dark:border-gray-700 px-1 py-0 text-center bg-white dark:bg-[#111111]">
                        <div className="flex items-center justify-center gap-0.5 h-full">
                          {canManageWorkspace ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                                onClick={() => handleEditUserClick(member)}
                                title="Editar usuário"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#2a1f1f]"
                                onClick={() => handleRemoveMemberClick(member.id)}
                                title="Remover membro"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">Leitura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer fixo com paginação */}
        <div className="sticky bottom-0 left-0 right-0 bg-[#f8f9fa] dark:bg-[#141414] border-t border-gray-300 dark:border-gray-700 px-4 py-2 z-20">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Linhas {startIndex}-{endIndex} de {totalCount || 0}
              </span>
              <div className="flex items-center gap-1">
                <span>Linhas/página:</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="h-7 w-24 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["10", "25", "50", "100", "200"].map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 rounded-none"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
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
                disabled={isLoading || page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}