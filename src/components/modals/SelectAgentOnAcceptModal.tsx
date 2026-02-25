import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Bot } from 'lucide-react';

interface SelectAgentOnAcceptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (agentId: string | null) => void;
  isAccepting: boolean;
}

export const SelectAgentOnAcceptModal = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  isAccepting
}: SelectAgentOnAcceptModalProps) => {
  const { selectedWorkspace } = useWorkspace();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('none');

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['workspace-agents', selectedWorkspace?.workspace_id],
    queryFn: async () => {
      if (!selectedWorkspace?.workspace_id) return [];
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('id, name, is_active')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkspace?.workspace_id && open,
  });

  const handleConfirm = () => {
    // Se nenhum agente selecionado, passar null
    const agentId = selectedAgentId === 'none' ? null : selectedAgentId;
    onConfirm(agentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Ativar Agente IA (Opcional)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Deseja ativar um agente IA para esta conversa?
            </label>
            <Select 
              value={selectedAgentId} 
              onValueChange={setSelectedAgentId}
              disabled={isLoadingAgents || isAccepting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não ativar agente</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isAccepting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isAccepting || isLoadingAgents}
          >
            {isAccepting ? 'Aceitando...' : 'Aceitar Conversa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
