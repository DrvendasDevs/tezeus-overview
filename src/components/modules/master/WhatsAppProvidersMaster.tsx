import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { WhatsAppProvidersConfig } from '@/components/modules/WhatsAppProvidersConfig';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { Loader2, Building2 } from 'lucide-react';

export function WhatsAppProvidersMaster() {
  const { workspaces, isLoading } = useWorkspaces();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  useEffect(() => {
    // Auto-selecionar primeira workspace ativa
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      const activeWorkspace = workspaces.find(w => w.is_active !== false);
      if (activeWorkspace) {
        setSelectedWorkspaceId(activeWorkspace.workspace_id);
      }
    }
  }, [workspaces, selectedWorkspaceId]);

  const selectedWorkspace = workspaces.find(w => w.workspace_id === selectedWorkspaceId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#f0f0f0] dark:bg-[#2d2d2d] border border-[#d4d4d4] dark:border-gray-700 p-3">
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 text-gray-700 dark:text-gray-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-700 dark:text-gray-300">
            Configure os provedores WhatsApp (Evolution API e Z-API) para cada empresa do sistema.
            As configurações são específicas por empresa.
          </p>
        </div>
      </div>

      <div className="border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
        <div className="px-4 py-3 border-b border-[#d4d4d4] dark:border-gray-700 bg-[#f3f3f3] dark:bg-[#2d2d2d]">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Selecionar Empresa</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Escolha a empresa para configurar os provedores WhatsApp
          </p>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-select" className="text-xs font-medium text-gray-700 dark:text-gray-300">Empresa</Label>
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="workspace-select" className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                <SelectValue placeholder="Selecione uma empresa..." />
              </SelectTrigger>
              <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                    {workspace.name} {workspace.cnpj ? `(${workspace.cnpj})` : ''} 
                    {workspace.is_active === false && ' - INATIVA'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedWorkspace && (
        <WhatsAppProvidersConfig 
          workspaceId={selectedWorkspace.workspace_id}
          workspaceName={selectedWorkspace.name}
        />
      )}

      {!selectedWorkspace && selectedWorkspaceId && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-xs text-red-700 dark:text-red-300">
            Empresa não encontrada. Selecione outra empresa.
          </p>
        </div>
      )}
    </div>
  );
}
