import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ImpersonateWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImpersonateWorkspaceModal({ open, onOpenChange }: ImpersonateWorkspaceModalProps) {
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(selectedWorkspace?.workspace_id || '');

  // Atualizar selectedWorkspaceId quando o modal abrir ou o workspace atual mudar
  useEffect(() => {
    if (open && selectedWorkspace?.workspace_id) {
      setSelectedWorkspaceId(selectedWorkspace.workspace_id);
    }
  }, [open, selectedWorkspace?.workspace_id]);

  const handleConfirm = () => {
    const workspace = workspaces.find(w => w.workspace_id === selectedWorkspaceId);
    if (workspace) {
      // Salva no localStorage
      localStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
      
      // Atualiza o contexto
      setSelectedWorkspace(workspace);
      
      // Fecha o modal
      onOpenChange(false);
      
      // Navega para o dashboard sem reload
      navigate('/relatorios');
    }
  };

  const handleCancel = () => {
    setSelectedWorkspaceId(selectedWorkspace?.workspace_id || '');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Personificar Empresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecione a empresa:</label>
            <Select 
              value={selectedWorkspaceId} 
              onValueChange={setSelectedWorkspaceId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione uma empresa"} />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.name}
                    {workspace.cnpj && (
                      <span className="text-muted-foreground ml-2">({workspace.cnpj})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedWorkspaceId}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}