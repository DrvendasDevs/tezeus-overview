import { X, Reply, Video, Mic, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WhatsAppMessage {
  id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type: 'contact' | 'agent' | 'system' | 'ia' | 'user';
  file_url?: string;
  file_name?: string;
}

interface ReplyPreviewProps {
  message: WhatsAppMessage;
  contactName: string;
  onCancel: () => void;
}

export function ReplyPreview({ message, contactName, onCancel }: ReplyPreviewProps) {
  const getSenderName = () => {
    switch (message.sender_type) {
      case 'contact':
        return contactName;
      case 'system':
        return 'Sistema';
      case 'ia':
        return 'Assistente IA';
      default:
        return 'Você';
    }
  };

  const renderMediaPreview = () => {
    const messageType = message.message_type;

    // Imagem
    if (messageType === 'image' && message.file_url) {
      return (
        <div className="flex items-center gap-2">
          <img 
            src={message.file_url} 
            className="w-12 h-12 rounded object-cover border border-border flex-shrink-0"
            alt="Preview"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="text-xs text-muted-foreground truncate">
            📷 Imagem
          </span>
        </div>
      );
    }

    // Vídeo
    if (messageType === 'video') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center border border-border flex-shrink-0">
            <Video className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground truncate">
            🎥 Vídeo
          </span>
        </div>
      );
    }

    // Áudio
    if (messageType === 'audio') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center border border-border flex-shrink-0">
            <Mic className="h-6 w-6 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground">
            🎵 Mensagem de voz
          </span>
        </div>
      );
    }

    // Documento
    if (messageType === 'document') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center border border-border flex-shrink-0">
            <FileText className="h-6 w-6 text-destructive" />
          </div>
          <span className="text-xs text-muted-foreground truncate">
            📄 Documento
          </span>
        </div>
      );
    }

    // Texto (fallback)
    return (
      <p className="text-sm text-muted-foreground truncate">
        {message.content.length > 50 
          ? message.content.substring(0, 50) + '...' 
          : message.content}
      </p>
    );
  };

  return (
    <div className="flex items-start gap-3 px-4 py-2 bg-muted/50 border-l-4 border-primary">
      <Reply className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary mb-1">
          {getSenderName()}
        </p>
        {renderMediaPreview()}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-6 w-6 flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
