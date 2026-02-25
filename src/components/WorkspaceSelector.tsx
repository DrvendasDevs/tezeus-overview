import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useParams } from "react-router-dom";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useMemo } from "react";

export function WorkspaceSelector() {
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
  const { workspaces, isLoading } = useWorkspaces();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  const { isMaster } = useWorkspaceRole();

  // Para usuários master, escondemos a identificação de master; apenas usamos workspace selecionado
  const displayWorkspace = useMemo(() => {
    if (isMaster && urlWorkspaceId) {
      const urlWorkspace = workspaces.find(w => w.workspace_id === urlWorkspaceId);
      if (urlWorkspace) {
        return urlWorkspace;
      }
    }
    return selectedWorkspace;
  }, [isMaster, urlWorkspaceId, workspaces, selectedWorkspace]);

  const handleWorkspaceChange = (workspace: typeof workspaces[0]) => {
    // Salva DIRETAMENTE no localStorage de forma síncrona
    localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    
    // Força refresh completo da página e vai para o dashboard
    window.location.href = '/relatorios';
  };


  if (isLoading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Building2 className="w-4 h-4" />
        Carregando...
      </Button>
    );
  }

  if (workspaces.length === 0) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Building2 className="w-4 h-4" />
        Nenhuma empresa
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 max-w-[200px]">
          <Building2 className="w-4 h-4" />
          <span className="truncate">
            {displayWorkspace?.name || "Selecionar empresa"}
          </span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.workspace_id}
            onClick={() => handleWorkspaceChange(workspace)}
            className={displayWorkspace?.workspace_id === workspace.workspace_id ? "bg-accent" : ""}
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{workspace.name}</span>
              {workspace.cnpj && (
                <span className="text-xs text-muted-foreground">
                  {workspace.cnpj}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}