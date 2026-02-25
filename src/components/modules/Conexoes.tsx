import React from 'react';
import { ConexoesNova } from './ConexoesNova';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function Conexoes() {
  const { selectedWorkspace } = useWorkspace();
  
  // Only proceed if a workspace is selected
  const workspaceId = selectedWorkspace?.workspace_id;
  
  // Conexoes component initialized
  
  if (!workspaceId) {
    return <div className="p-4 text-center text-muted-foreground">Selecione um workspace para continuar</div>;
  }
  
  return <ConexoesNova workspaceId={workspaceId} />;
}