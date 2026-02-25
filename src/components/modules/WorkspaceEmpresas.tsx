import { useState } from "react";
import { Plus, Building2, Users, Settings, Calendar, MapPin, MoreVertical, Edit, Trash2, Cable } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceLimits } from "@/hooks/useWorkspaceLimits";
import { CreateWorkspaceModal } from "@/components/modals/CreateWorkspaceModal";
import { WorkspaceConfigModal } from "@/components/modals/WorkspaceConfigModal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface WorkspaceEmpresasProps {
  onNavigateToUsers?: (workspaceId: string) => void;
  onNavigateToConfig?: (workspaceId: string) => void;
}

export function WorkspaceEmpresas({ onNavigateToUsers, onNavigateToConfig }: WorkspaceEmpresasProps) {
  const { workspaces, isLoading, deleteWorkspace, fetchWorkspaces } = useWorkspaces();
  const { isMaster, isAdmin } = useWorkspaceRole();
  const { userRole } = useAuth(); // Adicionar userRole como fallback
  const { selectedWorkspace: currentWorkspace } = useWorkspace(); // Pegar workspace atual
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedWorkspaceForConfig, setSelectedWorkspaceForConfig] = useState<{ id: string; name: string } | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<any>(null);

  const handleUsersClick = (workspace: { workspace_id: string; name: string }) => {
    navigate(`/empresa/${workspace.workspace_id}/usuarios`);
  };

  const handleConfigClick = (workspace: { workspace_id: string; name: string }) => {
    setSelectedWorkspaceForConfig({ id: workspace.workspace_id, name: workspace.name });
    setShowConfigModal(true);
  };

  const handleEditClick = async (workspace: any) => {
    console.log('📝 Opening edit modal for workspace:', workspace);
    
    try {
      // Buscar diretamente da tabela ao invés da edge function
      const { data: limitData, error } = await supabase
        .from('workspace_limits')
        .select('connection_limit, user_limit, disparador_enabled')
        .eq('workspace_id', workspace.workspace_id)
        .maybeSingle();
      
      console.log('📊 Limits from database:', limitData);
      
      if (error) {
        console.error('❌ Error fetching workspace limits:', error);
      }
      
      const connectionLimit = limitData?.connection_limit ?? 0;
      const userLimit = limitData?.user_limit ?? 0;
      const disparadorEnabled = limitData?.disparador_enabled ?? false;
      
      console.log('🔍 Final values - connectionLimit:', connectionLimit, 'userLimit:', userLimit);
      
      const workspaceData = {
        workspace_id: workspace.workspace_id,
        name: workspace.name,
        cnpj: workspace.cnpj,
        connectionLimit: connectionLimit,
        userLimit: userLimit,
        disparadorEnabled
      };
      
      console.log('✅ Setting workspace data:', workspaceData);
      
      setEditingWorkspace(workspaceData);
      setShowCreateModal(true);
    } catch (error) {
      console.error('❌ Error in handleEditClick:', error);
    }
  };

  const handleDeleteClick = (workspace: any) => {
    setWorkspaceToDelete(workspace);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (workspaceToDelete) {
      try {
        await deleteWorkspace(workspaceToDelete.workspace_id);
        setDeleteDialogOpen(false);
        setWorkspaceToDelete(null);
        // Refresh workspaces list after deletion
        fetchWorkspaces();
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const handleCreateModalClose = (open: boolean) => {
    setShowCreateModal(open);
    if (!open) {
      setEditingWorkspace(null);
      // Refresh workspaces list after modal closes to get updated limits
      console.log('🔄 Modal closed, refreshing workspaces...');
      fetchWorkspaces();
    }
  };

  // Filtrar para mostrar apenas a empresa atual quando não for master acessando o painel master
  const filteredWorkspaces = workspaces.filter(w => w.workspace_id === currentWorkspace?.workspace_id);

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-gray-100 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold" style={{ fontSize: "1.5rem" }}>Minha Empresa</h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Informações e configurações da empresa atual
          </p>
        </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse rounded-none border border-[#d4d4d4] shadow-sm bg-white dark:border-gray-700 dark:bg-[#1f1f1f]">
              <CardHeader className="pb-3 bg-[#f0f0f0] border-b border-[#d4d4d4] rounded-none dark:bg-[#2d2d2d] dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="w-32 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                  <div className="w-20 h-5 bg-gray-300 dark:bg-gray-600 rounded" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 bg-white dark:bg-[#1f1f1f] pt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="w-40 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="w-40 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                    <div className="w-36 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                  </div>
                </div>
                <div className="flex gap-2 justify-center pt-2">
                  <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded-none" />
                  <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded-none" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-gray-100 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold" style={{ fontSize: "1.5rem" }}>Minha Empresa</h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Informações e configurações da empresa atual
          </p>
        </div>
        {false && ( // Removido botão "Nova Empresa" desta página
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Empresa
          </Button>
        )}
      </div>

      {filteredWorkspaces.length === 0 ? (
        null
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWorkspaces.map((workspace) => {
            const WorkspaceLimitsDisplay = () => {
              const { limits, isLoading: limitsLoading } = useWorkspaceLimits(workspace.workspace_id);
              
              return (
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2 text-muted-foreground dark:text-gray-400">
                    <Cable className="w-4 h-4" />
                    <span>Limite de Conexões: {limitsLoading ? '...' : limits?.connection_limit || 0}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground dark:text-gray-400">
                    <Users className="w-4 h-4" />
                    <span>Limite de Usuários: {limitsLoading ? '...' : limits?.user_limit || 0}</span>
                  </div>
                  {(isMaster || userRole === 'master') && (
                    <div className="flex items-center gap-2 text-muted-foreground dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Criado {formatDistanceToNow(new Date(workspace.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <Card key={workspace.workspace_id} className="hover:shadow-lg transition-shadow rounded-none border border-[#d4d4d4] shadow-sm bg-white dark:border-gray-700 dark:bg-[#1f1f1f]">
                <CardHeader className="pb-3 bg-[#f0f0f0] border-b border-[#d4d4d4] rounded-none dark:bg-[#2d2d2d] dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <CardTitle className="text-sm font-bold line-clamp-1 text-gray-800 dark:text-gray-100">{workspace.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] rounded-none border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-transparent dark:text-gray-200">
                        conexões: {workspace.connections_count || 0}
                      </Badge>
                      {(isMaster || userRole === 'master') && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-none">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none border border-gray-200 dark:border-gray-700 dark:bg-[#1c1c1c] dark:text-gray-100">
                            <DropdownMenuItem onClick={() => handleEditClick(workspace)} className="rounded-none dark:focus:bg-[#2a2a2a]">
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(workspace)}
                              className="text-destructive rounded-none dark:focus:bg-[#2a1f1f]"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 bg-white dark:bg-[#1f1f1f] pt-4">
                  <WorkspaceLimitsDisplay />

                  {(isMaster || isAdmin(workspace.workspace_id!) || userRole === 'master' || userRole === 'admin') && (
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 bg-white dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                        onClick={() => handleUsersClick(workspace)}
                      >
                        <Users className="w-4 h-4" />
                        Usuários
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-none border-gray-300 text-gray-700 hover:bg-gray-100 bg-white dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
                        onClick={() => handleConfigClick(workspace)}
                      >
                        <Cable className="w-4 h-4" />
                        Configurações
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
      )}

      {filteredWorkspaces.length === 0 && (
        <Card className="p-8 text-center rounded-none border border-gray-200 dark:border-gray-700 dark:bg-[#111111]">
          <Building2 className="w-12 h-12 text-muted-foreground dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma empresa encontrada</h3>
          <p className="text-muted-foreground dark:text-gray-400">
            Entre em contato com o administrador para obter acesso.
          </p>
        </Card>
      )}


      <CreateWorkspaceModal 
        open={showCreateModal} 
        onOpenChange={handleCreateModalClose}
        workspace={editingWorkspace}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ Tem certeza que deseja excluir a empresa "{workspaceToDelete?.name}"?<br/>
              Esta ação não pode ser desfeita e irá deletar permanentemente TODOS os dados relacionados: conversas, contatos, conexões, configurações, tags, etc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedWorkspaceForConfig && (
        <WorkspaceConfigModal
          open={showConfigModal}
          onOpenChange={setShowConfigModal}
          workspaceId={selectedWorkspaceForConfig.id}
          workspaceName={selectedWorkspaceForConfig.name}
        />
      )}
    </div>
  );
}