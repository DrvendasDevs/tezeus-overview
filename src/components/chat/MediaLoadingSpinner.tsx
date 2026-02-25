import React from 'react';
import { Loader2 } from 'lucide-react';

interface MediaLoadingSpinnerProps {
  message?: string;
  className?: string;
}

export const MediaLoadingSpinner: React.FC<MediaLoadingSpinnerProps> = ({
  message = "Carregando mídia...",
  className = ""
}) => {
  return (
    <div className={`flex items-center justify-center p-4 bg-muted/10 rounded-lg border border-dashed border-muted-foreground/20 ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">{message}</p>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};