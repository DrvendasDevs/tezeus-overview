import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, AlertCircle, Loader2, Eye } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { WhatsAppAudioPlayer } from './WhatsAppAudioPlayer';
import { ImageModal } from './ImageModal';
import { PdfModal } from './PdfModal';
import { VideoModal } from './VideoModal';
import { MessageStatusIndicator } from '@/components/ui/message-status-indicator';

interface MediaViewerProps {
  fileUrl: string;
  fileName?: string;
  messageType: string;
  className?: string;
  senderType?: 'agent' | 'contact' | 'system' | 'ia' | 'user';
  senderAvatar?: string;
  senderName?: string;
  messageStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  caption?: string;
  metadata?: {
    waveform?: Record<string, number>;
    duration_seconds?: number;
  };
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  fileUrl,
  fileName,
  messageType,
  className = '',
  senderType = 'contact',
  senderAvatar,
  senderName,
  messageStatus,
  timestamp,
  caption,
  metadata,
}) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Detectar tipos de arquivos - PRIORIZAR messageType e extensões específicas
  const isAudioFile = messageType === 'audio' ||
                      (messageType !== 'document' && messageType !== 'image' && messageType !== 'video' && 
                       /\.(mp3|wav|ogg|aac|flac|webm|m4a|opus)$/i.test(fileName || fileUrl || ''));
  
  // Verificar tipos específicos de documentos PRIMEIRO (antes do PDF genérico)
  const isExcelFile = /\.(xlsx|xls|csv)$/i.test(fileName || '') || /\.(xlsx|xls|csv)$/i.test(fileUrl);
  const isWordFile = /\.(docx|doc)$/i.test(fileName || '') || /\.(docx|doc)$/i.test(fileUrl);
  const isPowerPointFile = /\.(pptx|ppt)$/i.test(fileName || '') || /\.(pptx|ppt)$/i.test(fileUrl);
  const isOfficeFile = isExcelFile || isWordFile || isPowerPointFile;
                      
  // PDF só se for realmente PDF (não todos os documentos)
  const isPdfFile = !isOfficeFile && 
                    (/\.pdf$/i.test(fileName || '') || /\.pdf$/i.test(fileUrl) || 
                     (messageType === 'document' && (fileName?.toLowerCase().includes('pdf') || fileUrl?.toLowerCase().includes('pdf'))));
                      
  const isImageFile = messageType === 'image' ||
                      (messageType !== 'audio' && messageType !== 'document' && messageType !== 'video' &&
                       /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName || fileUrl || ''));
                       
  const isVideoFile = messageType === 'video' ||
                      (messageType !== 'audio' && messageType !== 'document' && messageType !== 'image' &&
                       /\.(mp4|avi|mov|wmv|flv|webm)$/i.test(fileName || fileUrl || ''));

  const renderNeutralBadge = (label: string) => (
    <div className="relative">
      <div className="w-10 h-10 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-200 flex items-center justify-center text-[10px] font-semibold uppercase">
        {label}
      </div>
    </div>
  );

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Image load error:', fileUrl);
    setImageError('Erro ao carregar imagem');
    setIsLoading(false);
  }, [fileUrl]);

  // VERIFICAÇÕES POR PRIORIDADE: ESPECÍFICOS ANTES DO GENÉRICO
  
  // PRIMEIRA VERIFICAÇÃO: Excel (específico)
  if (isExcelFile) {
    return (
      <div className={className}>
        <div className="relative inline-block">
          <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-border" 
               onClick={handleDownload}>
            {renderNeutralBadge('XLS')}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Planilha Excel'}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para baixar
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          {timestamp && (
            <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
        {caption && (
          <p className="text-sm mt-1 break-words">{caption}</p>
        )}
      </div>
    );
  }

  // SEGUNDA VERIFICAÇÃO: Word (específico)
  if (isWordFile) {
    return (
      <div className={className}>
        <div className="relative inline-block">
          <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-border" 
               onClick={handleDownload}>
            {renderNeutralBadge('DOC')}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Documento Word'}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para baixar
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          {timestamp && (
            <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
        {caption && (
          <p className="text-sm mt-1 break-words">{caption}</p>
        )}
      </div>
    );
  }

  // TERCEIRA VERIFICAÇÃO: PowerPoint (específico)
  if (isPowerPointFile) {
    return (
      <div className={className}>
        <div className="relative inline-block">
          <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-border" 
               onClick={handleDownload}>
            {renderNeutralBadge('PPT')}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Apresentação PowerPoint'}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para baixar
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          {timestamp && (
            <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
        {caption && (
          <p className="text-sm mt-1 break-words">{caption}</p>
        )}
      </div>
    );
  }

  // QUARTA VERIFICAÇÃO: PDF (genérico para documentos) e outros documentos
  if (isPdfFile || isOfficeFile) {
    const label = (fileName?.split('.').pop() || 'file').slice(0,4).toUpperCase();
    return (
      <div className={className}>
        <div className="relative inline-block">
          <div 
            className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-border" 
            onClick={() => setIsPdfModalOpen(true)}
          >
            {renderNeutralBadge(label)}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {fileName || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Clique para visualizar
              </p>
            </div>
          </div>
          {/* Timestamp sobreposto */}
          {timestamp && (
            <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>
        {caption && (
          <p className="text-sm mt-1 break-words">{caption}</p>
        )}
        <PdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          pdfUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // QUINTA VERIFICAÇÃO: IMAGEM
  if (isImageFile || messageType === 'image') {
    return (
      <div className={className}>
        <div className="relative inline-block rounded-lg overflow-hidden">
          {!imageError && (
            <>
              {/* Skeleton/placeholder enquanto carrega */}
              {isLoading && (
                <div className="absolute inset-0 bg-muted animate-pulse max-w-[300px] max-h-[200px]" 
                     style={{ width: '300px', height: '200px' }} />
              )}
              
              <img
                src={fileUrl}
                alt={fileName || 'Imagem'}
                className="max-w-[300px] max-h-[200px] object-cover cursor-pointer block"
                onClick={() => setIsImageModalOpen(true)}
                onError={handleImageError}
                onLoad={() => {
                  setImageError(null);
                  setIsLoading(false);
                }}
                onLoadStart={() => {
                  setIsLoading(true);
                }}
              />
              
              {/* Caption dentro do container da imagem */}
              {caption && (
                <div className="px-2 py-1.5 bg-primary">
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-sm break-words text-primary-foreground flex-1">{caption}</p>
                    {timestamp && !isLoading && (
                      <div className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                        <span>
                          {new Date(timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {messageStatus && senderType !== 'contact' && (
                          <MessageStatusIndicator status={messageStatus} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Timestamp e status sobreposto na imagem quando NÃO houver caption */}
              {!caption && timestamp && !isLoading && (
                <div className="absolute bottom-1 right-1 bg-black/50 text-white px-1.5 py-0.5 rounded flex items-center gap-1" style={{ fontSize: '11px' }}>
                  <span>
                    {new Date(timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  {messageStatus && senderType !== 'contact' && (
                    <MessageStatusIndicator status={messageStatus} />
                  )}
                </div>
              )}
            </>
          )}
          
          {imageError && (
            <div 
              className="flex items-center gap-3 p-3 bg-muted max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-destructive/20"
              onClick={handleDownload}
            >
              <AlertCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {fileName || 'Imagem'}
                </p>
                <p className="text-xs text-destructive">
                  Erro ao carregar - Clique para baixar
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          )}
        </div>
        
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // SEXTA VERIFICAÇÃO: VÍDEO
  if (isVideoFile || messageType === 'video') {
    return (
      <div className={className}>
        <div className="relative inline-block rounded-lg overflow-hidden max-w-[300px]">
          <video
            src={fileUrl}
            controls
            className="w-full cursor-pointer block"
            style={{ maxHeight: '200px' }}
            onClick={() => setIsVideoModalOpen(true)}
          >
            Seu navegador não suporta o elemento de vídeo.
          </video>
          
          {/* Caption dentro do container do vídeo */}
          {caption && (
            <div className="px-2 py-1.5 bg-primary">
              <div className="flex items-end justify-between gap-2">
                <p className="text-sm break-words text-primary-foreground flex-1">{caption}</p>
                {timestamp && (
                  <div className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    <span>
                      {new Date(timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {messageStatus && senderType !== 'contact' && (
                      <MessageStatusIndicator status={messageStatus} />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Timestamp e status sobreposto quando NÃO houver caption */}
          {!caption && timestamp && (
            <div className="absolute bottom-1 right-1 bg-black/50 text-white px-1.5 py-0.5 rounded pointer-events-none flex items-center gap-1" style={{ fontSize: '11px' }}>
              <span>
                {new Date(timestamp).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {messageStatus && senderType !== 'contact' && (
                <MessageStatusIndicator status={messageStatus} />
              )}
            </div>
          )}
        </div>
        
        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          videoUrl={fileUrl}
          fileName={fileName}
        />
      </div>
    );
  }

  // SÉTIMA VERIFICAÇÃO: ÁUDIO
  if (isAudioFile || messageType === 'audio') {
    return (
      <div className={className}>
        <WhatsAppAudioPlayer
          audioUrl={fileUrl}
          fileName={fileName}
          senderType={senderType}
          senderAvatar={senderAvatar}
          senderName={senderName}
          messageStatus={messageStatus}
          timestamp={timestamp}
          onDownload={handleDownload}
          metadata={metadata}
        />
      </div>
    );
  }

  // PADRÃO: ARQUIVO GENÉRICO
  return (
    <div className={className}>
      <div className="relative inline-block">
        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg max-w-[300px] cursor-pointer hover:bg-muted/80 transition-colors border border-border" 
             onClick={handleDownload}>
          <div className="relative">
            <FileText className="h-10 w-10 text-gray-600" />
            <div className="absolute -top-1 -right-1 bg-gray-600 text-white text-xs px-1 rounded font-medium">
              FILE
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {fileName || 'Arquivo'}
            </p>
            <p className="text-xs text-muted-foreground">
              Clique para baixar
            </p>
          </div>
          <Download className="h-4 w-4 text-muted-foreground" />
        </div>
        {timestamp && (
          <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
            {new Date(timestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
      {caption && (
        <p className="text-sm mt-1 break-words">{caption}</p>
      )}
    </div>
  );
};
