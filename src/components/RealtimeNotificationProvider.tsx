import { createContext, useContext, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeNotificationContextType {
  totalUnread: number;
  notifications: any[];
  markContactAsRead: (conversationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getAvatarInitials: (name: string) => string;
  getAvatarColor: (name: string) => string;
  formatTimestamp: (timestamp: Date) => string;
}

const RealtimeNotificationContext = createContext<RealtimeNotificationContextType | undefined>(undefined);

interface RealtimeNotificationProviderProps {
  children: ReactNode;
}

export function RealtimeNotificationProvider({ children }: RealtimeNotificationProviderProps) {
  const {
    notifications,
    totalUnread,
    markContactAsRead,
    markAllAsRead,
    getAvatarInitials,
    getAvatarColor,
    formatTimestamp,
  } = useNotifications();

  return (
    <RealtimeNotificationContext.Provider
      value={{
        totalUnread,
        notifications,
        markContactAsRead,
        markAllAsRead,
        getAvatarInitials,
        getAvatarColor,
        formatTimestamp,
      }}
    >
      {children}
    </RealtimeNotificationContext.Provider>
  );
}

export function useRealtimeNotifications() {
  const context = useContext(RealtimeNotificationContext);

  if (context === undefined) {
    return {
      totalUnread: 0,
      notifications: [],
      markContactAsRead: async () => {},
      markAllAsRead: async () => {},
      getAvatarInitials: () => '',
      getAvatarColor: () => 'bg-gray-500',
      formatTimestamp: () => '',
    };
  }

  return context;
}
