import React, { useEffect, useMemo, useState } from "react";
import { Edit, Trash, User, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { useWorkspaceMembers, type WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { AdicionarEditarUsuarioModal } from "./AdicionarEditarUsuarioModal";
import { DeletarUsuarioModal } from "./DeletarUsuarioModal";

interface WorkspaceUsersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

const roleLabels = {
  user: "Usuário",
  admin: "Administrador",
  master: "Master",
} as const;

const DEFAULT_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 10;

export function WorkspaceUsersModal({ open, onOpenChange, workspaceId, workspaceName }: WorkspaceUsersModalProps) {
  const { toast } = useToast();
  const { deleteUser } = useSystemUsers();
  const { members, isLoading, removeMember, fetchMembers } = useWorkspaceMembers(workspaceId);

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<SystemUser | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string; memberId: string } | null>(null);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = (members || []).filter((m) => m.user?.profile !== "master" && m.user?.profile !== "support");
    if (!q) return base;
    return base.filter((m) => {
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

  const handlePageSizeChange = (value: string) => {
    const parsed = Number(value);
    const normalized = Math.max(MIN_PAGE_SIZE, Number.isFinite(parsed) ? parsed : DEFAULT_PAGE_SIZE);
    setPageSize(normalized);
    setPage(1);
  };

  const openCreate = () => {
    setUserToEdit(null);
    setIsEditModalOpen(true);
  };

  const openEdit = (member: WorkspaceMember) => {
    if (!member.user) return;

    const systemUser: SystemUser = {
      id: member.user_id,
      name: member.user.name || "",
      email: member.user.email || "",
      profile: member.user.profile || "user",
      status: (member.user as any)?.status || "active",
      avatar: member.user.avatar || undefined,
      cargo_id: (member.user as any)?.cargo_id,
      cargo_ids: (member.user as any)?.cargo_ids,
      cargo_names: (member.user as any)?.cargo_names,
      default_channel: (member.user as any)?.default_channel,
      created_at: (member.user as any)?.created_at || member.created_at,
      updated_at: (member.user as any)?.updated_at || member.created_at,
      workspaces: [{ id: workspaceId, name: workspaceName, role: member.role }],
      empresa: workspaceName,
    };

    setUserToEdit(systemUser);
    setIsEditModalOpen(true);
  };

  const onEditSuccess = () => {
    setIsEditModalOpen(false);
    setUserToEdit(null);
    fetchMembers();
  };

  const requestDelete = (member: WorkspaceMember) => {
    setUserToDelete({
      id: member.user_id,
      name: member.user?.name || "N/A",
      memberId: member.id,
    });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      // 1) Remove do workspace (evita FK/relacionamentos dependentes)
      await removeMember(userToDelete.memberId);
      // 2) Deleta o usuário do sistema (dados do usuário)
      const res = await deleteUser(userToDelete.id);
      if ((res as any)?.error) {
        throw new Error((res as any).error);
      }
      setUserToDelete(null);
      fetchMembers();
      toast({ title: "Sucesso", description: "Usuário excluído com sucesso" });
    } catch (e) {
      // Erros já mostram toast nos hooks, mas garantimos feedback caso venha como Error aqui.
      const msg = (e as any)?.message;
      if (msg) toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Usuários do Workspace: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <AdicionarEditarUsuarioModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          editingUser={userToEdit}
          workspaceId={workspaceId}
          lockWorkspace
          onSuccess={onEditSuccess}
        />

        <DeletarUsuarioModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          userName={userToDelete?.name || "N/A"}
          onConfirm={confirmDelete}
          isDarkMode={typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false}
        />

        <div className="space-y-4">
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

            <Button onClick={openCreate} className="gap-2 rounded-none h-8 text-xs">
              <UserPlus className="w-4 h-4" />
              Adicionar Usuário
            </Button>
          </div>

          <div className="border border-gray-300 dark:border-gray-700 overflow-hidden">
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#f3f3f3] dark:bg-[#111111] text-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left">Nome</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left">Email</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[120px]">Perfil</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left">Cargo</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[110px]">Status</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 text-left w-[140px]">Adicionado em</th>
                    <th className="border border-[#e0e0e0] dark:border-gray-700 px-1 py-1 text-center w-[72px]">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        className="border border-[#e0e0e0] dark:border-gray-700 px-3 py-8 text-center text-gray-600 dark:text-gray-300"
                        colSpan={7}
                      >
                        Carregando...
                      </td>
                    </tr>
                  ) : totalCount === 0 ? (
                    <tr>
                      <td
                        className="border border-[#e0e0e0] dark:border-gray-700 px-3 py-8 text-center text-gray-500 dark:text-gray-400"
                        colSpan={7}
                      >
                        Nenhum membro encontrado
                      </td>
                    </tr>
                  ) : (
                    pagedMembers.map((member) => {
                      const status = (member.user as any)?.status;
                      const cargoNames = ((member.user as any)?.cargo_names || []) as string[];

                      return (
                        <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-[#1a1a1a]">
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111] font-medium">
                            {member.user?.name || "N/A"}
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-300">
                            {member.user?.email || "N/A"}
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                            <Badge variant="outline" className="rounded-none">
                              {roleLabels[(member.user?.profile as any) || "user"] || (member.user?.profile || "user")}
                            </Badge>
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                            {cargoNames.length > 0 ? cargoNames.join(", ") : "—"}
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111]">
                            <Badge
                              variant={status === "active" ? "secondary" : "outline"}
                              className={
                                status === "active"
                                  ? "bg-brand-yellow text-black hover:bg-brand-yellow-hover rounded-full px-3 py-1"
                                  : "border-destructive text-destructive rounded-full px-3 py-1"
                              }
                            >
                              {status === "active" ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-2 py-1 bg-white dark:bg-[#111111] text-gray-600 dark:text-gray-300">
                            {new Date(member.created_at).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="border border-[#e0e0e0] dark:border-gray-700 px-1 py-0 text-center bg-white dark:bg-[#111111]">
                            <div className="flex items-center justify-center gap-0.5 h-full">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600 dark:text-gray-200 dark:hover:bg-[#243447]"
                                onClick={() => openEdit(member)}
                                title="Editar usuário"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600 dark:hover:bg-[#2a1f1f]"
                                onClick={() => requestDelete(member)}
                                title="Excluir usuário"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

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
      </DialogContent>
    </Dialog>
  );
}


