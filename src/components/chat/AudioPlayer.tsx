import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AudioPlayerProps {
  audioUrl: string;
  fileName?: string;
  onDownload?: () => void;
  messageId?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  fileName,
  onDownload,
  messageId
}) => {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedData = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      console.error('Audio URL:', audioUrl);
      console.error('Audio element error:', audio.error);
      setHasError(true);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      console.log('Audio can play:', audioUrl);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log('Audio load started:', audioUrl);
      setIsLoading(true);
    };

    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const clickRatio = clickX / progressBarWidth;
    const newTime = clickRatio * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleRetry = async () => {
    if (!messageId || isRetrying) return;
    
    setIsRetrying(true);
    setHasError(false);
    setIsLoading(true);
    
    try {
      // URLs do whatsapp-media bucket são permanentes, apenas recarregar
      console.log("Tentando recarregar áudio:", audioUrl);
      
      // Force a reload of the audio element
      const audio = audioRef.current;
      if (audio) {
        audio.load();
      }
      
      toast({
        title: "Tentando novamente...",
        description: "Recarregando o áudio",
      });
    } catch (error) {
      console.error('Retry failed:', error);
      setHasError(true);
      toast({
        title: "Erro ao reprocessar",
        description: "Não foi possível carregar o áudio",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 max-w-[300px] p-2 bg-muted/30 rounded-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />
      
      <Button
        size="sm"
        variant="ghost"
        onClick={togglePlayPause}
        disabled={isLoading || hasError}
        className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex-shrink-0"
      >
        {hasError ? (
          <span className="text-xs">!</span>
        ) : isLoading ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : isPlaying ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        {fileName && (
          <p className="text-sm text-foreground truncate">
            {fileName}
          </p>
        )}
      </div>

      {hasError && messageId && (
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleRetry}
          disabled={isRetrying}
          className="text-orange-500 hover:text-orange-600 flex-shrink-0 h-6 w-6"
        >
          {isRetrying ? (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      )}

      {onDownload && (
        <Button size="sm" variant="ghost" onClick={onDownload} className="flex-shrink-0 h-6 w-6">
          <Download className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};