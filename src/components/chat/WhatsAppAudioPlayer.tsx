import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MessageStatusIndicator } from '@/components/ui/message-status-indicator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WhatsAppAudioPlayerProps {
  audioUrl: string;
  fileName?: string;
  senderType: 'agent' | 'contact' | 'system' | 'ia' | 'user';
  senderAvatar?: string;
  senderName?: string;
  messageStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  onDownload?: () => void;
  metadata?: {
    waveform?: Record<string, number>;
    duration_seconds?: number;
  };
}

export const WhatsAppAudioPlayer: React.FC<WhatsAppAudioPlayerProps> = ({
  audioUrl,
  fileName,
  senderType,
  senderAvatar,
  senderName = 'Usuário',
  messageStatus = 'sent',
  timestamp,
  onDownload,
  metadata,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlayerMode, setIsPlayerMode] = useState(false); // Controla se mostra avatar ou botão de velocidade
  
  // Waveform real do WhatsApp - usa metadata.waveform se disponível
  const [waveformBars] = useState(() => {
    if (metadata?.waveform) {
      // Convert {0: 0, 1: 3, ...} to [0, 3, ...]
      const waveformArray = Object.values(metadata.waveform);
      // Normalize to 0-1 range
      const maxValue = Math.max(...waveformArray, 1);
      return waveformArray.map(v => (v / maxValue) * 0.7 + 0.3);
    }
    return Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3);
  });

  const isOutgoing = senderType !== 'contact';

  // Detecta cliques fora do componente para voltar ao modo inicial
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPlayerMode(false);
      }
    };

    if (isPlayerMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlayerMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Função para desenhar a waveform
  const drawWaveform = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 3;
    const gap = 2;
    const barCount = waveformBars.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    // Limpa o canvas
    ctx.clearRect(0, 0, width, height);

    // Desenha as barrinhas
    waveformBars.forEach((amplitude, index) => {
      const x = index * (barWidth + gap);
      const barHeight = amplitude * height * 0.6; // Limita altura máxima a 60%
      const y = (height - barHeight) / 2;
      
      // Calcula se essa barra já foi tocada
      const barProgress = index / barCount;
      const isPlayed = barProgress < progress;
      
      // Cor: usa primária se já tocou, muted se não tocou
      ctx.fillStyle = isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted))';
      
      // Desenha a barra (retângulo com cantos arredondados)
      const radius = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, y + barHeight - radius);
      ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
      ctx.lineTo(x + radius, y + barHeight);
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    });

    // Desenha UM pontinho branco na posição atual
    if (progress > 0 && progress < 1) {
      const dotX = progress * width;
      const dotY = height / 2;
      
      // Círculo usando cores do sistema
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fill();
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [currentTime, duration, waveformBars]);

  // Loop de animação com requestAnimationFrame (60fps)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const animate = () => {
      if (audio && !audio.paused && !audio.ended) {
        setCurrentTime(audio.currentTime);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      // Inicia o loop de animação
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Para o loop de animação
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  // Redesenha a waveform quando currentTime, duration ou waveformBars mudam
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      setIsPlayerMode(true); // Ativa modo player quando apertar play
    }
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = percentage * duration;
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="relative">
      {/* Message Tail */}
      <div className={cn(
        "absolute top-0 w-2 h-3",
        isOutgoing ? "right-0 -mr-1" : "left-0 -ml-1"
      )}>
        <svg viewBox="0 0 8 13" height="13" width="8" className={cn(
          isOutgoing ? "scale-x-[-1]" : ""
        )}>
          <path 
            fill="currentColor" 
            className={isOutgoing ? "text-primary/10" : "text-secondary"}
            d="M5.188,0H0v11.193l6.467-8.625C7.526,1.156,6.958,0,5.188,0z"
          />
        </svg>
      </div>

      {/* Main Container */}
      <div 
        ref={containerRef}
        className={cn(
          "rounded-lg p-2 max-w-[340px] relative",
          isOutgoing 
            ? "bg-primary/10 ml-auto" 
            : "bg-secondary"
        )}
      >
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className={cn(
              "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
              isOutgoing
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" fill="currentColor" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
            )}
          </button>

          {/* Waveform do WhatsApp */}
          <div className="flex-1 min-w-0 relative">
            <canvas
              ref={canvasRef}
              width={200}
              height={20}
              className="cursor-pointer"
              onClick={handleProgressClick}
              style={{ width: '200px', height: '20px' }}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>{isPlayerMode ? formatTime(currentTime) : formatTime(duration)}</span>
              <span className="flex items-center gap-1">
                {timestamp && (
                  <span>{new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
                {isOutgoing && messageStatus && (
                  <MessageStatusIndicator status={messageStatus} className="ml-1" />
                )}
              </span>
            </div>
          </div>

          {/* Speed Control (aparece só no modo player) */}
          {isPlayerMode && (
            <button
              onClick={cycleSpeed}
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                isOutgoing
                  ? "bg-primary/20 text-primary-foreground hover:bg-primary/30"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {playbackSpeed}×
            </button>
          )}

          {/* Avatar and PTT Badge (aparece só quando NÃO está no modo player) */}
          {!isPlayerMode && (
            <div className="flex-shrink-0 relative self-stretch flex items-center">
              <Avatar className="w-12 h-12">
                <AvatarImage src={senderAvatar} alt={senderName} />
                <AvatarFallback className="bg-muted text-xs">
                  {getInitials(senderName)}
                </AvatarFallback>
              </Avatar>
              {/* PTT Badge */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg viewBox="0 0 19 26" height="14" width="10" className="text-primary-foreground">
                  <path 
                    fill="currentColor"
                    d="M9.367,15.668c1.527,0,2.765-1.238,2.765-2.765V5.265c0-1.527-1.238-2.765-2.765-2.765 S6.603,3.738,6.603,5.265v7.638C6.603,14.43,7.84,15.668,9.367,15.668z M14.655,12.91h-0.3c-0.33,0-0.614,0.269-0.631,0.598 c0,0,0,0-0.059,0.285c-0.41,1.997-2.182,3.505-4.298,3.505c-2.126,0-3.904-1.521-4.304-3.531C5.008,13.49,5.008,13.49,5.008,13.49 c-0.016-0.319-0.299-0.579-0.629-0.579h-0.3c-0.33,0-0.591,0.258-0.579,0.573c0,0,0,0,0.04,0.278 c0.378,2.599,2.464,4.643,5.076,4.978v3.562c0,0.33,0.27,0.6,0.6,0.6h0.3c0.33,0,0.6-0.27,0.6-0.6V18.73 c2.557-0.33,4.613-2.286,5.051-4.809c0.057-0.328,0.061-0.411,0.061-0.411C15.243,13.18,14.985,12.91,14.655,12.91z"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
