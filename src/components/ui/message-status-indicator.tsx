import { Check, CheckCheck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
}

export const MessageStatusIndicator = ({ status, className }: MessageStatusIndicatorProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3.5 h-3.5 text-white/70 animate-spin" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-gray-600" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-600" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'failed':
        return <X className="w-3.5 h-3.5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex items-center justify-end", className)}>
      {getStatusIcon()}
    </div>
  );
};
