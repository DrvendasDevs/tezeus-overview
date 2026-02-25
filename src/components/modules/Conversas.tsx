// Novo componente de conversas WhatsApp
import { WhatsAppChat } from './WhatsAppChat';
import { useWorkspaceStatusCheck } from '@/hooks/useWorkspaceStatusCheck';
import { useMemo } from 'react';

interface ConversasProps {
  isDarkMode?: boolean;
  selectedConversationId?: string | null;
}

export function Conversas({ isDarkMode = false, selectedConversationId }: ConversasProps) {
  // Monitorar status do workspace
  useWorkspaceStatusCheck();

  const containerClasses = useMemo(
    () =>
      "flex-1 flex flex-col h-screen overflow-hidden",
    []
  );

  return (
    <div className={containerClasses}>
      <div className="flex flex-col h-full bg-white dark:bg-[#0e0e0e] font-sans text-xs dark:text-gray-100">
        {/* Headline */}
        <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Conversas</span>
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-hidden">
          <WhatsAppChat isDarkMode={isDarkMode} selectedConversationId={selectedConversationId} />
        </div>
      </div>
    </div>
  );
}