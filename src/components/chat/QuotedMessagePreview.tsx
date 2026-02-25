import { Video, Mic, FileText, Reply } from 'lucide-react';

interface QuotedMessage {
  id: string;
  content?: any;
  sender_type: 'agent' | 'contact' | 'system' | 'ia' | 'user';
  message_type?: string;
  file_url?: string;
  file_name?: string;
}

interface QuotedMessagePreviewProps {
  quotedMessage: QuotedMessage;
  senderName: string;
  onQuoteClick?: () => void;
}

export function QuotedMessagePreview({ quotedMessage, senderName, onQuoteClick }: QuotedMessagePreviewProps) {
  const renderMediaPreview = () => {
    const messageType = quotedMessage.message_type;
    const safeContent = typeof quotedMessage?.content === "string" ? quotedMessage.content : (quotedMessage?.content ? String(quotedMessage.content) : "");

    // Imagem
    if (messageType === 'image' && quotedMessage.file_url) {
      return (
        <div className="flex items-center gap-2">
          <img 
            src={quotedMessage.file_url} 
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
        {safeContent.length > 50
          ? safeContent.substring(0, 50) + "..."
          : (safeContent || "-")}
      </p>
    );
  };

  return (
    <div 
      className="flex items-start gap-3 px-4 py-2 bg-muted/50 border-l-4 border-primary mb-2 cursor-pointer hover:bg-muted/70 transition-colors" 
      onClick={onQuoteClick}
      title="Clique para ver a mensagem citada"
    >
      <Reply className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
      
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary mb-1">
          {senderName}
        </p>
        {renderMediaPreview()}
      </div>
    </div>
  );
}
