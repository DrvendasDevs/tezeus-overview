import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotificationMessage } from '@/hooks/useNotifications';
import { MessageCircle, Image, Video, Headphones, FileText } from 'lucide-react';

interface NotificationTooltipProps {
  notifications: NotificationMessage[];
  totalUnread: number;
  getAvatarInitials: (name: string) => string;
  getAvatarColor: (name: string) => string;
  formatTimestamp: (timestamp: Date) => string;
  onNotificationClick: (conversationId: string) => void;
  onMarkAllAsRead: () => void;
  onMarkContactAsRead?: (conversationId: string) => void;
}

export function NotificationTooltip({
  notifications,
  totalUnread,
  getAvatarInitials,
  getAvatarColor,
  formatTimestamp,
  onNotificationClick,
  onMarkAllAsRead,
  onMarkContactAsRead
}: NotificationTooltipProps) {
  const getMessageIcon = (messageType: string) => {
    switch (messageType) {
      case 'image':
        return <Image className="w-3 h-3" />;
      case 'video':
        return <Video className="w-3 h-3" />;
      case 'audio':
        return <Headphones className="w-3 h-3" />;
      case 'document':
        return <FileText className="w-3 h-3" />;
      default:
        return <MessageCircle className="w-3 h-3" />;
    }
  };

  return (
    <div className="w-80 bg-white text-gray-900 dark:bg-[#1f1f1f] dark:text-gray-100">
      {/* Header */}
      <div className="p-3 border-b border-[#d4d4d4] bg-primary text-primary-foreground dark:bg-[#2d2d2d] dark:text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Notificações</h3>
          <Badge
            variant="secondary"
            className="bg-white text-primary border-none rounded-none h-5 px-1.5 text-[10px] font-bold dark:bg-gray-900 dark:text-white"
          >
            {totalUnread}
          </Badge>
        </div>
      </div>

      {/* Lista de notificações */}
      <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
        <div>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs dark:text-gray-400">
              Nenhuma notificação nova
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="border-b border-[#d4d4d4] last:border-b-0 group dark:border-gray-700"
              >
                <Button
                  variant="ghost"
                  className="w-full p-3 h-auto justify-start rounded-none hover:bg-[#e6f2ff] dark:hover:bg-gray-800"
                  onClick={() => onNotificationClick(notification.conversationId)}
                >
                  <div className="flex items-start gap-3 w-full">
                    {/* Avatar */}
                    <Avatar className="w-8 h-8 flex-shrink-0 rounded-full border border-gray-200 dark:border-gray-600">
                      <AvatarImage src="" alt={notification.contactName} />
                      <AvatarFallback 
                        className={`${getAvatarColor(notification.contactName)} text-primary-foreground text-[10px] font-bold`}
                      >
                        {getAvatarInitials(notification.contactName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-xs text-gray-800 truncate dark:text-gray-100">
                          {notification.contactName}
                        </span>
                        <div className="flex items-center gap-2">
                          {typeof (notification as any).unreadCount === 'number' && (notification as any).unreadCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                              {(notification as any).unreadCount > 99 ? '99+' : (notification as any).unreadCount}
                            </span>
                          )}
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {formatTimestamp(notification.timestamp)}
                        </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        {React.cloneElement(getMessageIcon(notification.messageType) as React.ReactElement, { className: "w-3 h-3" })}
                        <span className="text-[11px] truncate">
                          {notification.isMedia ? 'Imagem' : notification.content}
                        </span>
                      </div>
                    </div>
                  </div>
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#d4d4d4] bg-gray-50 dark:border-gray-700 dark:bg-[#111111]">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full h-7 text-xs rounded-none border-gray-300 bg-white hover:bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-[#1f1f1f] dark:text-gray-200 dark:hover:bg-gray-800"
          onClick={onMarkAllAsRead}
          disabled={notifications.length === 0}
        >
          Marcar todas como lidas
        </Button>
      </div>
    </div>
  );
}
