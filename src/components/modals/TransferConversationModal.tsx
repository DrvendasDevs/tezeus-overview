import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { WhatsAppConversation } from "@/hooks/useWhatsAppConversations";
import { WorkspaceMember } from "@/hooks/useWorkspaceMembers";
import { Queue } from "@/hooks/useQueues";
import { WorkspaceConnection } from "@/hooks/useWorkspaceConnections";
import { useConversationAssign } from "@/hooks/useConversationAssign";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AssignmentEntry } from "@/hooks/useConversationAssignments";

type TransferConversationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversation | null;
  users: WorkspaceMember[];
  queues: Queue[];
  connections: WorkspaceConnection[];
  isLoadingConnections?: boolean;
  isLoadingQueues?: boolean;
  onTransferSuccess?: (params: {
    conversationId: string;
    assignedUserId: string | null;
    assignedUserName?: string | null;
    connectionId: string;
    queueId?: string | null;
  }) => void;
};

export function TransferConversationModal({
  open,
  onOpenChange,
  conversation,
  users,
  queues,
  connections,
  isLoadingConnections,
  isLoadingQueues,
  onTransferSuccess,
}: TransferConversationModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("none");
  const [selectedQueueId, setSelectedQueueId] = useState<string>("none");
  const [selectedConnectionId, setSelectedConnectionId] =
    useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { assignConversation, isAssigning } = useConversationAssign();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const userOptions = useMemo(() => {
    return users
      .map((member) => {
        const userId = member.user?.id || member.user_id;
        if (!userId) return null;
        return {
          id: userId,
          name: member.user?.name || "Usuário sem nome",
        };
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, [users]);

  const queueOptions = useMemo(() => {
    return queues.map((queue) => ({
      id: queue.id,
      name: queue.name,
    }));
  }, [queues]);

  const connectionOptions = useMemo(() => {
    return connections.map((connection) => ({
      id: connection.id,
      name: connection.instance_name,
    }));
  }, [connections]);

  useEffect(() => {
    if (!open) {
      setSelectedUserId("none");
      setSelectedQueueId("none");
      setSelectedConnectionId("");
      setIsSubmitting(false);
      return;
    }

    if (conversation) {
      setSelectedUserId(conversation.assigned_user_id || "none");
      setSelectedQueueId(
        (conversation.queue_id as string | null | undefined) || "none"
      );
      setSelectedConnectionId(conversation.connection_id || "");
    }
  }, [open, conversation?.id]);

  const handleSubmit = async () => {
    if (!conversation) return;

    const hasResponsible =
      selectedUserId !== "" && selectedUserId !== null && selectedUserId !== "none";
    const hasQueue = selectedQueueId && selectedQueueId !== "none";

    if (!hasResponsible && !hasQueue) {
      toast({
        title: "Selecione um responsável ou uma fila",
        description:
          "Escolha um responsável ou uma fila para concluir a transferência.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedConnectionId) {
      toast({
        title: "Selecione uma conexão",
        description: "Escolha a conexão para onde o atendimento será movido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const normalizedUserId = hasResponsible ? selectedUserId : null;
      const previousUserId = conversation.assigned_user_id || null;
      const previousUserName =
        (previousUserId &&
          (userOptions.find((option) => option.id === previousUserId)?.name ||
            conversation.assigned_user_name)) ||
        "Não atribuído";

      const assignResult = await assignConversation(
        conversation.id,
        normalizedUserId
      );

      if (!assignResult.success) {
        throw new Error(
          assignResult.error || "Falha ao atribuir este atendimento."
        );
      }

      const updates: Record<string, string | null> = {
        connection_id: selectedConnectionId,
      };

      if (selectedQueueId === "none") {
        updates.queue_id = null;
      } else if (selectedQueueId) {
        updates.queue_id = selectedQueueId;
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update(updates)
        .eq("id", conversation.id);

      if (updateError) {
        throw updateError;
      }

      const assignedUserNameResolved = hasResponsible
        ? userOptions.find((option) => option.id === selectedUserId)?.name || null
        : null;

      toast({
        title: "Atendimento transferido",
        description: "As alterações foram aplicadas com sucesso.",
      });

      queryClient.invalidateQueries({
        queryKey: ["conversation-assignments", conversation.id],
      });

      const actionType =
        assignResult.action ??
        (hasResponsible
          ? previousUserId
            ? "transfer"
            : "assign"
          : previousUserId
          ? "unassign"
          : "assign");

      const optimisticAssignedUserName =
        assignedUserNameResolved ??
        conversation.assigned_user_name ??
        "Sem responsável";

      const optimisticEntry: AssignmentEntry = {
        id: `temp_${Date.now()}`,
        action: actionType,
        changed_at: new Date().toISOString(),
        changed_by: user?.id || null,
        from_assigned_user_id: previousUserId,
        to_assigned_user_id: normalizedUserId,
        from_user_name: previousUserName,
        to_user_name: optimisticAssignedUserName,
        changed_by_name: user?.name || null,
      };

      queryClient.setQueryData<AssignmentEntry[] | undefined>(
        ["conversation-assignments", conversation.id],
        (oldData) => {
          if (!oldData) {
            return [optimisticEntry];
          }
          return [optimisticEntry, ...oldData];
        }
      );

      onTransferSuccess?.({
        conversationId: conversation.id,
        assignedUserId: normalizedUserId,
        assignedUserName: assignedUserNameResolved,
        connectionId: selectedConnectionId,
        queueId:
          selectedQueueId === "none" ? null : (selectedQueueId as string),
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao transferir atendimento:", error);
      toast({
        title: "Erro ao transferir",
        description:
          error?.message || "Não foi possível concluir a transferência.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isProcessing =
    isSubmitting || (isAssigning ? isAssigning === conversation?.id : false);

  const isUserSelectDisabled =
    isProcessing ||
    (selectedQueueId !== "none" && selectedQueueId !== "");

  const isQueueSelectDisabled =
    isProcessing ||
    isLoadingQueues ||
    (selectedUserId !== "" &&
      selectedUserId !== null &&
      selectedUserId !== "none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm rounded-none">
        <DialogHeader className="bg-primary text-white p-4 m-0 rounded-none border-b border-[#d4d4d4] dark:border-gray-700 dark:bg-transparent">
          <DialogTitle className="text-base font-bold text-white">Transferir Atendimento</DialogTitle>
          <DialogDescription className="text-white/90 text-xs dark:text-gray-300">
            Escolha o novo responsável, fila (opcional) e conexão para este
            atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6 dark:bg-[#0f0f0f]">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Usuário responsável <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isUserSelectDisabled}
            >
              <SelectTrigger className="w-full h-8 text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d] dark:text-gray-200 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Selecione um usuário" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d]">
                <SelectItem value="none" className="text-xs rounded-none cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700">Sem responsável</SelectItem>
                {userOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled className="text-xs rounded-none dark:text-gray-400">
                    Nenhum usuário disponível
                  </SelectItem>
                ) : (
                  userOptions.map((user) => (
                    <SelectItem key={user.id} value={user.id} className="text-xs rounded-none cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700">
                      {user.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Fila (opcional)
            </Label>
            <Select
              value={selectedQueueId}
              onValueChange={setSelectedQueueId}
              disabled={isQueueSelectDisabled}
            >
              <SelectTrigger className="w-full h-8 text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d] dark:text-gray-200 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Selecione uma fila (opcional)" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d]">
                <SelectItem value="none" className="text-xs rounded-none cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700">Sem fila</SelectItem>
                {queueOptions.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id} className="text-xs rounded-none cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700">
                    {queue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">
              Conexão <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedConnectionId}
              onValueChange={setSelectedConnectionId}
              disabled={isProcessing || isLoadingConnections}
            >
              <SelectTrigger className="w-full h-8 text-xs rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d] dark:text-gray-200 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d]">
                {connectionOptions.length === 0 ? (
                  <SelectItem value="__empty" disabled className="text-xs rounded-none dark:text-gray-400">
                    Nenhuma conexão disponível
                  </SelectItem>
                ) : (
                  connectionOptions.map((connection) => (
                    <SelectItem key={connection.id} value={connection.id} className="text-xs rounded-none cursor-pointer dark:text-gray-200 dark:focus:bg-gray-700">
                      {connection.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="bg-gray-50 dark:bg-[#1a1a1a] border-t border-[#d4d4d4] dark:border-gray-700 p-4 m-0 rounded-none gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="h-8 text-xs rounded-none dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#2a2a2a] dark:bg-[#1a1a1a]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className="h-8 text-xs rounded-none min-w-[120px]"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transferindo...
              </span>
            ) : (
              "Transferir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

