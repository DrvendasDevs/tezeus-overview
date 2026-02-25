import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';

interface MediaErrorFallbackProps {
  fileName?: string;
  fileUrl?: string;
  errorMessage?: string;
  onDownload?: () => void;
  onRetry?: () => void;
  className?: string;
}

export const MediaErrorFallback: React.FC<MediaErrorFallbackProps> = ({
  fileName,
  fileUrl,
  errorMessage,
  onDownload,
  onRetry,
  className = ""
}) => {
  return (
    <div className={`flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg max-w-[300px] ${className}`}>
      <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-destructive mb-1">
          Erro ao carregar mídia
        </h4>
        <p className="text-sm text-muted-foreground mb-2">
          {fileName || 'Arquivo de mídia'}
        </p>
        
        {fileUrl && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">URL:</p>
            <code className="text-xs bg-muted p-1 rounded break-all">
              {fileUrl.length > 60 ? `${fileUrl.substring(0, 60)}...` : fileUrl}
            </code>
          </div>
        )}
        
        {errorMessage && (
          <details className="mb-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Ver detalhes do erro
            </summary>
            <pre className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded whitespace-pre-wrap overflow-x-auto">
              {errorMessage}
            </pre>
          </details>
        )}
        
        <div className="flex gap-2">
          {onRetry && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onRetry}
              className="text-xs h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Tentar novamente
            </Button>
          )}
          {onDownload && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onDownload}
              className="text-xs h-7"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};