import React, { useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConversationAccept } from '@/hooks/useConversationAccept';
import { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';
import { SelectAgentOnAcceptModal } from '@/components/modals/SelectAgentOnAcceptModal';

interface AcceptConversationButtonProps {
  conversation: WhatsAppConversation;
  onAccept?: (conversationId: string) => void;
  className?: string;
}

export function AcceptConversationButton({ conversation, onAccept, className }: AcceptConversationButtonProps) {
  const { acceptConversation, isAccepting } = useConversationAccept();
  const [showAgentModal, setShowAgentModal] = useState(false);

  // Só mostra o botão se assigned_user_id for null
  if (conversation.assigned_user_id !== null) {
    return null;
  }

  const handleAcceptClick = () => {
    // Abrir modal de seleção de agente
    setShowAgentModal(true);
  };

  const handleConfirmAccept = async (agentId: string | null) => {
    const result = await acceptConversation(conversation.id, agentId);
    
    if (result.success) {
      setShowAgentModal(false);
      // Notificar o componente pai sobre o sucesso
      onAccept?.(conversation.id);
    }
    
    // Se já foi atribuída, também notifica para atualizar a UI
    if (result.alreadyAssigned) {
      setShowAgentModal(false);
      onAccept?.(conversation.id);
    }
  };

  const isCurrentlyAccepting = isAccepting === conversation.id;

  return (
    <>
      <Button
        onClick={handleAcceptClick}
        disabled={isCurrentlyAccepting}
        size="sm"
        className={`gap-2 ${className}`}
        variant="default"
      >
        {isCurrentlyAccepting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle className="w-4 h-4" />
        )}
        {isCurrentlyAccepting ? 'Aceitando...' : 'Aceitar'}
      </Button>

      <SelectAgentOnAcceptModal 
        open={showAgentModal}
        onOpenChange={setShowAgentModal}
        onConfirm={handleConfirmAccept}
        isAccepting={isCurrentlyAccepting}
      />
    </>
  );
}