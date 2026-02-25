import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useConversationAssign } from "@/hooks/useConversationAssign";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";

interface VincularResponsavelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  conversationId?: string;
  contactId?: string;
  currentResponsibleId?: string;
  onSuccess?: () => void;
  onResponsibleUpdated?: () => void;
}

interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
}

export function VincularResponsavelModal({ 
  isOpen, 
  onClose, 
  cardId, 
  conversationId, 
  contactId,
  currentResponsibleId,
  onSuccess,
  onResponsibleUpdated
}: VincularResponsavelModalProps) {
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();
  const { assignConversation } = useConversationAssign();
  const { getHeaders } = useWorkspaceHeaders();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentResponsibleId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Atualizar selectedUserId quando o modal abre ou currentResponsibleId muda
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(currentResponsibleId || null);
    }
  }, [isOpen, currentResponsibleId]);

  useEffect(() => {
    if (isOpen && selectedWorkspace) {
      loadWorkspaceUsers();
    }
  }, [isOpen, selectedWorkspace]);


  const loadWorkspaceUsers = async () => {
    if (!selectedWorkspace) return;

    setIsLoading(true);
    try {
      console.log('🔍 Buscando usuários para workspace:', selectedWorkspace.workspace_id);
      
      // Usar a edge function que já funciona no sistema
      const { data, error } = await supabase.functions.invoke('manage-system-user', {
        body: { action: 'list', userData: {} }
      });

      console.log('📊 Resposta da edge function:', data);
      
      if (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
      }

      if (!data?.success || !data?.data) {
        console.warn('⚠️ Resposta inválida da edge function');
        setUsers([]);
        return;
      }

      // Filtrar usuários que pertencem ao workspace atual (excluindo masters)
      const workspaceUsers = data.data
        .filter((user: any) => {
          const belongsToWorkspace = user.workspaces?.some(
            (ws: any) => ws.id === selectedWorkspace.workspace_id
          );
          const isNotMasterOrSupport = user.profile !== 'master' && user.profile !== 'support';
          console.log(`User ${user.name} belongs to workspace:`, belongsToWorkspace, 'isNotMasterOrSupport:', isNotMasterOrSupport);
          return belongsToWorkspace && isNotMasterOrSupport;
        })
        .map((user: any) => ({
          id: user.id,
          name: user.name,
          email: user.email || ''
        }));

      console.log('🎯 Usuários filtrados para o workspace:', workspaceUsers);

      setUsers(workspaceUsers);
    } catch (error) {
      console.error('❌ Erro geral ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários do workspace",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedUserId) {
      toast({
        title: "Atenção",
        description: "Selecione um responsável",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log('🔄 Vinculando responsável:', {
        cardId,
        conversationId,
        contactId,
        selectedUserId,
        currentResponsibleId
      });

      // Buscar conversa do contato se não tiver conversationId mas tiver contactId
      let targetConversationId = conversationId;
      
      if (!targetConversationId && contactId) {
        console.log('🔍 Buscando conversa para o contato:', contactId);
        const { data: conversations, error: searchError } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);

        if (searchError) {
          console.error('⚠️ Erro ao buscar conversa:', searchError);
        } else if (conversations && conversations.length > 0) {
          targetConversationId = conversations[0].id;
          console.log('✅ Conversa encontrada:', targetConversationId);
        } else {
          console.log('⚠️ Nenhuma conversa aberta encontrada para o contato');
        }
      }

      // ✅ Atualizar card via Edge Function para garantir auditoria e sincronização
      console.log('📝 Atualizando card via pipeline-management com responsible_user_id:', selectedUserId);
      const headers = getHeaders();

      const { data: updatedCard, error: cardUpdateError } = await supabase.functions.invoke(
        `pipeline-management/cards?id=${cardId}`,
        {
          method: 'PUT',
          headers,
          body: {
            responsible_user_id: selectedUserId
          }
        }
      );

      if (cardUpdateError) {
        console.error('❌ Erro ao atualizar card via Edge Function:', cardUpdateError);
        throw cardUpdateError;
      }

      const updatedCardData = updatedCard as any;
      const pipelineConversationId = updatedCardData?.conversation?.id ?? updatedCardData?.conversation_id ?? null;

      console.log('✅ Card atualizado com sucesso via Edge Function:', {
        cardId,
        responsible_user_id: selectedUserId,
        pipelineConversationId
      });

      // ✅ Fallback: se o card não estiver vinculado à conversa, usar assign-conversation
      if (!pipelineConversationId && targetConversationId) {
        console.log('ℹ️ Card sem conversation_id após atualização. Usando assign-conversation como fallback:', targetConversationId);
        const result = await assignConversation(targetConversationId, selectedUserId);
        
        if (!result.success) {
          console.error('⚠️ Erro ao atribuir conversa via fallback (card já foi atualizado):', result.error);
        } else {
          console.log('✅ Conversa atribuída via fallback:', result.action);
        }
      } else if (!pipelineConversationId) {
        console.log('ℹ️ Nenhuma conversa vinculada ao card e nenhum fallback disponível');
      }

      const conversationToInvalidate = pipelineConversationId || targetConversationId;
      if (conversationToInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['conversation-assignments', conversationToInvalidate] });
      }

      toast({
        title: "Sucesso",
        description: "Responsável vinculado com sucesso"
      });

      onSuccess?.();
      onResponsibleUpdated?.();
      onClose();
    } catch (error) {
      console.error('❌ Erro geral ao vincular responsável:', error);
      toast({
        title: "Erro",
        description: "Erro ao vincular responsável",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedUserId(currentResponsibleId || null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Selecione o responsável</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Responsável</label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 border rounded-md">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedUserId || ""}
                onValueChange={(value) => setSelectedUserId(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 px-2">
                      <p className="text-sm">Nenhum usuário encontrado</p>
                      <p className="text-xs mt-1">Não há usuários cadastrados neste workspace</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving || !selectedUserId}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
