import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WhatsAppChat } from '@/components/modules/WhatsAppChat';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  contactName: string;
  contactPhone?: string;
  contactAvatar?: string;
  contactId?: string;
}

export function ChatModal({ isOpen, onClose, conversationId }: ChatModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="h-full w-full overflow-hidden flex flex-col">
          <WhatsAppChat selectedConversationId={conversationId} onlyMessages={true} />
        </div>
      </DialogContent>
    </Dialog>
  );
}