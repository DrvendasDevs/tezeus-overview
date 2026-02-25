import React from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePipelinesContext } from '@/contexts/PipelinesContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export const PipelineDebugPanel = () => {
  const { selectedWorkspace, workspaces } = useWorkspace();
  const { pipelines, isLoading, fetchPipelines } = usePipelinesContext();

  const getCurrentUser = () => {
    try {
      const userData = localStorage.getItem('currentUser');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();

  const getStatus = (condition: boolean, label: string) => (
    <div className="flex items-center gap-2">
      {condition ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={condition ? 'text-green-600' : 'text-red-600'}>
        {label}
      </span>
    </div>
  );

  return (
    <Card className="w-full max-w-2xl mx-auto mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Pipeline Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authentication Status */}
        <div className="space-y-2">
          <h4 className="font-semibold">Autenticação</h4>
          {getStatus(!!currentUser?.id, 'Usuário autenticado')}
          {getStatus(!!currentUser?.email, 'Email do usuário')}
          {currentUser && (
            <div className="text-sm text-muted-foreground ml-6">
              ID: {currentUser.id}<br />
              Email: {currentUser.email}
            </div>
          )}
        </div>

        {/* Workspace Status */}
        <div className="space-y-2">
          <h4 className="font-semibold">Workspace</h4>
          {getStatus(!!selectedWorkspace, 'Workspace selecionado')}
          {getStatus(workspaces.length > 0, 'Workspaces carregados')}
          {selectedWorkspace && (
            <div className="text-sm text-muted-foreground ml-6">
              ID: {selectedWorkspace.workspace_id}<br />
              Nome: {selectedWorkspace.name}
            </div>
          )}
        </div>

        {/* Pipeline Status */}
        <div className="space-y-2">
          <h4 className="font-semibold">Pipelines</h4>
          {getStatus(!isLoading, 'Não está carregando')}
          {getStatus(pipelines.length > 0, 'Pipelines encontrados')}
          <div className="text-sm text-muted-foreground ml-6">
            Total: {pipelines.length} pipelines
          </div>
        </div>

        {/* Network Status */}
        <div className="space-y-2">
          <h4 className="font-semibold">Status da Rede</h4>
          {getStatus(navigator.onLine, 'Conexão com internet')}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t">
          <Button 
            onClick={fetchPipelines} 
            disabled={isLoading}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Recarregar Pipelines
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Badge variant="secondary" className="w-full justify-center">
            Carregando pipelines...
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};