import { Building2, Users, Briefcase, LogIn, BarChart3, Eye, Settings, MoreVertical, Edit, Trash2, BanIcon, CheckCircle, Cable } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceStats } from '@/hooks/useWorkspaceStats';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkspaceCardProps {
  workspace: Workspace;
  onLogin: (workspace: Workspace) => void;
  onViewReports: (workspace: Workspace) => void;
  onViewWorkspace: (workspace: Workspace) => void;
  onViewConfig?: (workspace: Workspace) => void;
  onEdit?: (workspace: Workspace) => void;
  onDelete?: (workspace: Workspace) => void;
  onToggleActive?: (workspace: Workspace) => void;
}

export function WorkspaceCard({
  workspace,
  onLogin,
  onViewReports,
  onViewWorkspace,
  onViewConfig,
  onEdit,
  onDelete,
  onToggleActive
}: WorkspaceCardProps) {
  const { stats, isLoading } = useWorkspaceStats(workspace.workspace_id);
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{workspace.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={workspace.is_active !== false ? 'default' : 'destructive'}
              className="text-xs"
            >
              {workspace.is_active !== false ? 'Ativa' : 'Inativa'}
            </Badge>
            {(onEdit || onDelete || onToggleActive) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(workspace)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {onToggleActive && (
                    <DropdownMenuItem 
                      onClick={() => onToggleActive(workspace)}
                      className={workspace.is_active !== false ? 'text-orange-600' : 'text-green-600'}
                    >
                      {workspace.is_active !== false ? (
                        <>
                          <BanIcon className="mr-2 h-4 w-4" />
                          Inativar
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Ativar
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={() => onDelete(workspace)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {workspace.cnpj && (
          <CardDescription className="text-xs">
            CNPJ: {workspace.cnpj}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cable className="h-4 w-4" />
              <span>{workspace.connections_count || 0} conexões</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{stats.usersCount} usuários</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              <span>{stats.activeDealsCount} negócios ativos</span>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={() => onLogin(workspace)}
          variant="default"
          className="w-full"
          size="sm"
        >
          <Eye className="h-4 w-4 mr-2" />
          Visualizar
        </Button>
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            onClick={() => onViewReports(workspace)}
            variant="outline"
            size="sm"
          >
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </Button>
          <Button
            onClick={() => onViewConfig?.(workspace)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Config
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
