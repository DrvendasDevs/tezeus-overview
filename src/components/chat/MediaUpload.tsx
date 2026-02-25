import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Paperclip, Image, FileText, Music, Video, Upload, X, Check, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Formatos permitidos por tipo de mídia
const ALLOWED_FORMATS = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime'], // .mp4 e .mov
  audio: ['audio/mpeg', 'audio/wav', 'audio/webm'],
  document: [
    'application/pdf',
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'text/plain', // .txt
    'application/octet-stream' // fallback
  ]
};

// Limites de tamanho por tipo (em bytes)
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10MB
  video: 50 * 1024 * 1024,    // 50MB
  audio: 20 * 1024 * 1024,    // 20MB
  document: 15 * 1024 * 1024  // 15MB
};

// Nomes amigáveis para exibir ao usuário
const FORMAT_NAMES: Record<string, string> = {
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
  'audio/mpeg': 'MP3',
  'audio/wav': 'WAV',
  'audio/webm': 'WebM (áudio)',
  'application/pdf': 'PDF',
  'application/vnd.ms-excel': 'Excel (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
  'text/plain': 'Texto (.txt)'
};

interface MediaUploadProps {
  onFileSelect: (file: File, type: 'image' | 'video' | 'audio' | 'document', fileUrl: string, caption?: string) => void;
  disabled?: boolean;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onFileSelect, disabled }) => {
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{
    file: File;
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    previewUrl: string;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFileType = (file: File, mediaType: 'image' | 'video' | 'audio' | 'document'): boolean => {
    const allowedTypes = ALLOWED_FORMATS[mediaType];
    
    if (!allowedTypes.includes(file.type)) {
      // Obter lista de formatos permitidos em formato amigável
      const allowedNames = allowedTypes
        .map(type => FORMAT_NAMES[type] || type)
        .join(', ');
      
      const mediaTypeLabel = mediaType === 'video' ? 'vídeo' : 
                              mediaType === 'image' ? 'imagem' : 
                              mediaType === 'audio' ? 'áudio' : 'documento';
      
      toast.error('Formato não suportado', {
        description: `Formatos de ${mediaTypeLabel} permitidos: ${allowedNames}`,
        duration: 4000,
        dismissible: true,
        closeButton: true
      });
      
      return false;
    }
    
    return true;
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video' | 'audio' | 'document') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ✅ VALIDAR FORMATO
    if (!validateFileType(file, mediaType)) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // ✅ VALIDAR TAMANHO
    const maxSize = SIZE_LIMITS[mediaType];
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      
      const mediaTypeLabel = mediaType === 'video' ? 'vídeo' : 
                              mediaType === 'image' ? 'imagem' : 
                              mediaType === 'audio' ? 'áudio' : 'documento';
      
      toast.error('Arquivo muito grande', {
        description: `Tamanho máximo para ${mediaTypeLabel}: ${maxSizeMB}MB. Seu arquivo tem ${fileSizeMB}MB.`,
        duration: 5000,
        dismissible: true,
        closeButton: true
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // ✅ Criar preview LOCAL (SEM upload ainda)
    const previewUrl = URL.createObjectURL(file);

    // ✅ Preparar estado para preview
    setPendingMedia({
      file,
      type: mediaType,
      url: '', // URL será preenchida após upload
      previewUrl
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('✅ MediaUpload - Preview preparado (sem upload ainda)');
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-8 w-8" />;
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8" />;
    if (file.type.startsWith('audio/')) return <Music className="h-8 w-8" />;
    return <FileText className="h-8 w-8" />;
  };

  const handleConfirmSend = async () => {
    if (!pendingMedia) return;
    
    setUploading(true);
    
    try {
      // 📤 FAZER UPLOAD AGORA (ao confirmar)
      const fileExt = pendingMedia.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `messages/${fileName}`;

      console.log('📤 MediaUpload - Iniciando upload:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, pendingMedia.file);

      if (uploadError) {
        console.error('❌ MediaUpload - Upload error:', uploadError);
        throw uploadError;
      }

      // ✅ Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      console.log('✅ MediaUpload - Upload concluído:', publicUrl);

      // ✅ Enviar para callback
      onFileSelect(pendingMedia.file, pendingMedia.type, publicUrl, caption || undefined);

      // ✅ Limpar estados
      URL.revokeObjectURL(pendingMedia.previewUrl);
      setPendingMedia(null);
      setCaption('');

      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('❌ MediaUpload - Erro ao enviar:', error);
      toast.error('Erro ao enviar arquivo', {
        description: 'Tente novamente',
        duration: 4000,
        dismissible: true,
        closeButton: true
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    if (pendingMedia) {
      URL.revokeObjectURL(pendingMedia.previewUrl);
    }
    setPendingMedia(null);
    setCaption('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={disabled} className="dark:text-gray-200 dark:hover:bg-gray-700">
            <Paperclip className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="dark:bg-[#2d2d2d] dark:border-gray-600">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="dark:text-gray-200 dark:focus:bg-gray-700">
            <Image className="h-4 w-4 mr-2" />
            Imagem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="dark:text-gray-200 dark:focus:bg-gray-700">
            <Video className="h-4 w-4 mr-2" />
            Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="dark:text-gray-200 dark:focus:bg-gray-700">
            <Music className="h-4 w-4 mr-2" />
            Áudio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="dark:text-gray-200 dark:focus:bg-gray-700">
            <FileText className="h-4 w-4 mr-2" />
            Documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/webm,.pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            let mediaType: 'image' | 'video' | 'audio' | 'document' = 'document';
            if (file.type.startsWith('image/')) mediaType = 'image';
            else if (file.type.startsWith('video/')) mediaType = 'video';
            else if (file.type.startsWith('audio/')) mediaType = 'audio';
            
            handleFileInputChange(e, mediaType);
          }
        }}
        disabled={uploading}
      />

      {/* Modal de preview */}
      {pendingMedia && (
        <Dialog open={!!pendingMedia} onOpenChange={uploading ? undefined : handleCancelPreview}>
          <DialogContent className="max-w-md dark:bg-[#2d2d2d] dark:border-gray-600">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-100">
                Enviar {pendingMedia.type === 'image' ? 'Imagem' : 
                        pendingMedia.type === 'video' ? 'Vídeo' : 
                        pendingMedia.type === 'audio' ? 'Áudio' : 'Documento'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Preview da mídia */}
              {pendingMedia.type === 'image' && (
                <img 
                  src={pendingMedia.previewUrl} 
                  alt="Preview" 
                  className="w-full rounded-lg max-h-[400px] object-contain bg-muted dark:bg-black/20"
                />
              )}
              
              {pendingMedia.type === 'video' && (
                <video 
                  src={pendingMedia.previewUrl} 
                  controls 
                  className="w-full rounded-lg max-h-[400px]"
                />
              )}
              
              {(pendingMedia.type === 'document' || pendingMedia.type === 'audio') && (
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg overflow-hidden dark:bg-black/20">
                  {pendingMedia.type === 'audio' ? (
                    <Music className="h-10 w-10 text-muted-foreground dark:text-gray-400" />
                  ) : (
                    <FileText className="h-10 w-10 text-muted-foreground dark:text-gray-400" />
                  )}
                  <span
                    className="text-sm flex-1 truncate dark:text-gray-200"
                    title={pendingMedia.file.name}
                  >
                    {pendingMedia.file.name.length > 20
                      ? `${pendingMedia.file.name.slice(0, 20)}...`
                      : pendingMedia.file.name}
                  </span>
                </div>
              )}
              
              {/* Campo de legenda */}
              <div>
                <Label htmlFor="caption" className="dark:text-gray-200">Legenda (opcional)</Label>
                <Input 
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Digite uma legenda..."
                  className="mt-1 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              
              {/* Botões de ação */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={handleCancelPreview}
                  disabled={uploading}
                  className="dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmSend}
                  disabled={uploading}
                  className="dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Indicador de upload */}
      {uploading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Enviando arquivo...</span>
          </div>
        </div>
      )}
    </>
  );
};